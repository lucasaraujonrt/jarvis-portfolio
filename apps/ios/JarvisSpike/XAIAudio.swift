import AVFoundation
import Observation

@Observable
@MainActor
final class XAIAudio {
  private(set) var isListening = false
  private(set) var isSpeaking = false
  private(set) var signal = VoiceSignal.silence
  private(set) var pulse = 0
  private(set) var inputRate = 16_000
  private(set) var formatDescription = "Áudio ainda não iniciado"
  var onFailure: ((String) -> Void)?

  @ObservationIgnored private var engine = AVAudioEngine()
  @ObservationIgnored private var player = AVAudioPlayerNode()
  @ObservationIgnored private var generation = UUID()
  @ObservationIgnored private var playbackGeneration = UUID()
  @ObservationIgnored private var pendingBuffers = 0
  @ObservationIgnored private var queuedFrames = 0
  @ObservationIgnored private var hasTap = false
  @ObservationIgnored private var observers: [NSObjectProtocol] = []

  init() {
    observers.append(NotificationCenter.default.addObserver(forName: AVAudioSession.interruptionNotification, object: nil, queue: nil) { [weak self] notification in
      guard let type = notification.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt,
        type == AVAudioSession.InterruptionType.began.rawValue else { return }
      Task { @MainActor in self?.handleInterruption("O áudio foi interrompido pelo iPhone.") }
    })
    observers.append(NotificationCenter.default.addObserver(forName: AVAudioSession.routeChangeNotification, object: nil, queue: nil) { [weak self] notification in
      guard let reason = notification.userInfo?[AVAudioSessionRouteChangeReasonKey] as? UInt,
        reason == AVAudioSession.RouteChangeReason.oldDeviceUnavailable.rawValue else { return }
      Task { @MainActor in self?.handleInterruption("Os óculos foram desconectados do áudio.") }
    })
  }

  func prepare() throws {
    stop()
    let session = AVAudioSession.sharedInstance()
    try session.setCategory(.playAndRecord, mode: .voiceChat, options: [.allowBluetoothHFP])
    try session.setActive(true)
    if let input = session.availableInputs?.first(where: { $0.portType == .bluetoothHFP }) {
      try session.setPreferredInput(input)
    }
    guard session.currentRoute.inputs.contains(where: { $0.portType == .bluetoothHFP }),
      session.currentRoute.outputs.contains(where: { $0.portType == .bluetoothHFP }) else {
      throw AudioProbeError.bluetoothAudioUnavailable
    }
    engine = AVAudioEngine()
    player = AVAudioPlayerNode()
    engine.attach(player)
    guard let format = AVAudioFormat(standardFormatWithSampleRate: Double(XAIVoiceProtocol.outputRate), channels: 1) else {
      throw XAIVoiceError.invalidAudio
    }
    engine.connect(player, to: engine.mainMixerNode, format: format)
    inputRate = Int(engine.inputNode.inputFormat(forBus: 0).sampleRate)
    refreshFormatDescription()
    guard [8000, 16000, 22050, 24000, 32000, 44100, 48000].contains(inputRate) else {
      throw AudioProbeError.noInput
    }
  }

  func startCapture(consume: @escaping @Sendable (Data) -> Void) throws {
    let captureID = generation
    let monitor = XAIMicrophoneMonitor { [weak self] data, signal in
      consume(data)
      Task { @MainActor in
        guard let self, self.generation == captureID, self.isListening else { return }
        self.signal = signal
      }
    }
    let input = engine.inputNode
    let format = input.inputFormat(forBus: 0)
    guard format.commonFormat == .pcmFormatFloat32, format.channelCount > 0 else { throw AudioProbeError.noInput }
    guard format.sampleRate == Double(inputRate) else {
      refreshFormatDescription()
      throw XAIVoiceError.unavailable("A taxa do microfone mudou durante a conexão. Reinicie a conversa. \(formatDescription)")
    }
    input.installTap(onBus: 0, bufferSize: 1024, format: format, block: Self.tap(monitor))
    hasTap = true
    engine.prepare()
    try engine.start()
    isListening = true
    refreshFormatDescription()
  }

  func enqueue(_ data: Data) throws {
    let samples = try XAIVoiceProtocol.decodePCM(data)
    guard queuedFrames + samples.count <= XAIVoiceProtocol.outputRate * 180,
      let format = AVAudioFormat(standardFormatWithSampleRate: Double(XAIVoiceProtocol.outputRate), channels: 1),
      let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: AVAudioFrameCount(samples.count)),
      let channel = buffer.floatChannelData?[0] else { throw XAIVoiceError.invalidAudio }
    samples.withUnsafeBufferPointer { pointer in
      if let source = pointer.baseAddress { channel.update(from: source, count: samples.count) }
    }
    buffer.frameLength = AVAudioFrameCount(samples.count)
    if !engine.isRunning { engine.prepare(); try engine.start() }
    let playbackID = playbackGeneration
    let frameCount = samples.count
    queuedFrames += frameCount
    pendingBuffers += 1
    isSpeaking = true
    pulse += 1
    player.scheduleBuffer(buffer, completionCallbackType: .dataPlayedBack, completionHandler: Self.completion { [weak self] in
      Task { @MainActor in
        guard let self, self.playbackGeneration == playbackID else { return }
        self.pendingBuffers -= 1
        self.queuedFrames -= frameCount
        self.isSpeaking = self.pendingBuffers > 0
        self.pulse += 1
      }
    })
    if !player.isPlaying { player.play() }
  }

  func stopOutput() {
    playbackGeneration = UUID()
    player.stop()
    pendingBuffers = 0
    queuedFrames = 0
    isSpeaking = false
  }

  func stop() {
    generation = UUID()
    stopOutput()
    if hasTap { engine.inputNode.removeTap(onBus: 0); hasTap = false }
    engine.stop()
    isListening = false
    signal = .silence
  }

  private func refreshFormatDescription() {
    let input = engine.inputNode.inputFormat(forBus: 0)
    let output = engine.outputNode.inputFormat(forBus: 0)
    formatDescription = "Microfone: \(Int(input.sampleRate)) Hz / \(input.channelCount) canal(is) · xAI: entrada \(inputRate) Hz, saída \(XAIVoiceProtocol.outputRate) Hz · Dispositivo: \(Int(output.sampleRate)) Hz"
  }

  private func handleInterruption(_ message: String) {
    guard isListening || isSpeaking else { return }
    stop()
    onFailure?(message)
  }

  nonisolated private static func tap(_ monitor: XAIMicrophoneMonitor) -> AVAudioNodeTapBlock {
    { buffer, _ in monitor.submit(buffer) }
  }

  nonisolated private static func completion(_ finished: @escaping @Sendable () -> Void) -> @Sendable (AVAudioPlayerNodeCompletionCallbackType) -> Void {
    { _ in finished() }
  }
}

private final class XAIMicrophoneMonitor: @unchecked Sendable {
  private let queue = DispatchQueue(label: "jarvis.xai.microphone", qos: .userInitiated)
  private let slot = DispatchSemaphore(value: 1)
  private let consume: @Sendable (Data, VoiceSignal) -> Void
  private var analyzer = VoiceSignalAnalyzer()

  init(consume: @escaping @Sendable (Data, VoiceSignal) -> Void) { self.consume = consume }

  func submit(_ buffer: AVAudioPCMBuffer) {
    guard let channel = buffer.floatChannelData?[0], buffer.frameLength > 0,
      buffer.frameLength <= 8192, slot.wait(timeout: .now()) == .success else { return }
    let samples = (0..<Int(buffer.frameLength)).map { channel[$0 * buffer.stride] }
    let rate = buffer.format.sampleRate
    queue.async { [self] in
      defer { slot.signal() }
      consume(XAIVoiceProtocol.encodePCM(samples), analyzer.process(samples, sampleRate: rate))
    }
  }
}
