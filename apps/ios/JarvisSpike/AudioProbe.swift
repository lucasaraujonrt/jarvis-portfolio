import AVFoundation
import Observation
import Speech

@Observable
@MainActor
final class AudioProbe: NSObject, AVSpeechSynthesizerDelegate {
  var transcript = ""
  var inputRoute = "nenhuma"
  var outputRoute = "nenhuma"
  var isBluetoothHFPDuplex = false
  var isListening = false
  var isSpeaking: Bool { synthesizer.isSpeaking }
  private(set) var voiceSignal = VoiceSignal.silence
  private(set) var speechVisual = SpeechVisualState()

  @ObservationIgnored private let audioEngine = AVAudioEngine()
  @ObservationIgnored private let recognizer = SFSpeechRecognizer(locale: Locale(identifier: "pt-BR"))
  @ObservationIgnored private let synthesizer = AVSpeechSynthesizer()
  @ObservationIgnored private var recognitionRequest: SFSpeechAudioBufferRecognitionRequest?
  @ObservationIgnored private var recognitionTask: SFSpeechRecognitionTask?
  @ObservationIgnored private var listeningID = UUID()

  override init() {
    super.init()
    synthesizer.delegate = self
  }

  func startListening() async throws {
    guard !isListening else { return }
    let speechAuthorization = await Self.requestSpeechAuthorization()
    guard speechAuthorization == .authorized else { throw AudioProbeError.speechPermission }
    guard await AVAudioApplication.requestRecordPermission() else { throw AudioProbeError.microphonePermission }
    guard let recognizer, recognizer.isAvailable else { throw AudioProbeError.recognizerUnavailable }

    try Task.checkCancellation()
    stopListening()
    try configureSession()
    guard isBluetoothHFPDuplex else { throw AudioProbeError.bluetoothAudioUnavailable }

    transcript = ""
    let request = SFSpeechAudioBufferRecognitionRequest()
    request.shouldReportPartialResults = true
    request.requiresOnDeviceRecognition = false
    recognitionRequest = request

    let inputNode = audioEngine.inputNode
    let requestBox = SpeechRequestBox(request)
    let captureID = listeningID
    let monitor = VoiceSignalMonitor { [weak self] signal in
      Task { @MainActor in
        guard let self, self.isListening, self.listeningID == captureID else { return }
        self.voiceSignal = signal
      }
    }
    let format = inputNode.inputFormat(forBus: 0)
    guard format.sampleRate > 0, format.channelCount > 0 else { throw AudioProbeError.noInput }
    print("Jarvis audio session: \(audioDiagnostics(inputNode: inputNode))")
    audioEngine.reset()
    inputNode.installTap(
      onBus: 0,
      bufferSize: 1024,
      format: format,
      block: Self.makeTapHandler(requestBox: requestBox, monitor: monitor)
    )

    do {
      recognitionTask = recognizer.recognitionTask(with: request) { [weak self] result, error in
        Task { @MainActor in
          guard self?.listeningID == captureID else { return }
          if let result { self?.transcript = result.bestTranscription.formattedString }
          if error != nil || result?.isFinal == true { self?.stopListening() }
        }
      }
      audioEngine.prepare()
      try audioEngine.start()
    } catch {
      let diagnostics = audioDiagnostics(inputNode: inputNode)
      print("Jarvis audio start failed: \(error.localizedDescription); \(diagnostics)")
      stopListening()
      throw AudioProbeError.audioEngine("\(error.localizedDescription) [\(diagnostics)]")
    }
    isListening = true
    refreshRoute()
  }

  func stopListening() {
    listeningID = UUID()
    voiceSignal = .silence
    if audioEngine.isRunning { audioEngine.stop() }
    audioEngine.inputNode.removeTap(onBus: 0)
    recognitionRequest?.endAudio()
    recognitionRequest = nil
    recognitionTask = nil
    isListening = false
    refreshRoute()
  }

  func speak(_ text: String) {
    guard !text.isEmpty else { return }
    stopListening()
    do {
      try configureSession()
    } catch {
      return
    }
    let utterance = AVSpeechUtterance(string: text)
    utterance.voice = AVSpeechSynthesisVoice(language: "pt-BR")
    utterance.rate = 0.5
    synthesizer.stopSpeaking(at: .immediate)
    speechVisual.prepare(ObjectIdentifier(utterance))
    synthesizer.speak(utterance)
    refreshRoute()
  }

  func playAcknowledgement() {
    speak("Sim?")
  }

  func stopSpeaking() {
    synthesizer.stopSpeaking(at: .immediate)
    if let id = speechVisual.utteranceID { speechVisual.receive(.ended, for: id) }
  }

  nonisolated func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didStart utterance: AVSpeechUtterance) {
    receiveSpeechEvent(.started, utterance: utterance)
  }

  nonisolated func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didFinish utterance: AVSpeechUtterance) {
    receiveSpeechEvent(.ended, utterance: utterance)
  }

  nonisolated func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didCancel utterance: AVSpeechUtterance) {
    receiveSpeechEvent(.ended, utterance: utterance)
  }

  nonisolated func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didPause utterance: AVSpeechUtterance) {
    receiveSpeechEvent(.paused, utterance: utterance)
  }

  nonisolated func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didContinue utterance: AVSpeechUtterance) {
    receiveSpeechEvent(.resumed, utterance: utterance)
  }

  nonisolated func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, willSpeakRangeOfSpeechString characterRange: NSRange, utterance: AVSpeechUtterance) {
    receiveSpeechEvent(.word, utterance: utterance)
  }

  nonisolated private func receiveSpeechEvent(_ event: SpeechVisualEvent, utterance: AVSpeechUtterance) {
    let id = ObjectIdentifier(utterance)
    Task { @MainActor [weak self] in self?.speechVisual.receive(event, for: id) }
  }

  func refreshRoute() {
    let route = AVAudioSession.sharedInstance().currentRoute
    inputRoute = route.inputs.map { "\($0.portName) [\($0.portType.rawValue)]" }.joined(separator: ", ")
    outputRoute = route.outputs.map { "\($0.portName) [\($0.portType.rawValue)]" }.joined(separator: ", ")
    if inputRoute.isEmpty { inputRoute = "nenhuma" }
    if outputRoute.isEmpty { outputRoute = "nenhuma" }
    isBluetoothHFPDuplex = route.inputs.contains { $0.portType == .bluetoothHFP }
      && route.outputs.contains { $0.portType == .bluetoothHFP }
  }

  private func configureSession() throws {
    let session = AVAudioSession.sharedInstance()
    try session.setCategory(.playAndRecord, mode: .voiceChat, options: [.allowBluetoothHFP])
    try session.setActive(true)
    if let hfpInput = session.availableInputs?.first(where: { $0.portType == .bluetoothHFP }) {
      try session.setPreferredInput(hfpInput)
    }
    refreshRoute()
  }

  private func audioDiagnostics(inputNode: AVAudioInputNode) -> String {
    let session = AVAudioSession.sharedInstance()
    let input = inputNode.inputFormat(forBus: 0)
    let output = inputNode.outputFormat(forBus: 0)
    return "session=\(session.sampleRate)Hz, input=\(input.sampleRate)Hz/\(input.channelCount)ch, output=\(output.sampleRate)Hz/\(output.channelCount)ch"
  }

  nonisolated private static func requestSpeechAuthorization()
    async -> SFSpeechRecognizerAuthorizationStatus
  {
    await withCheckedContinuation { continuation in
      SFSpeechRecognizer.requestAuthorization { status in
        continuation.resume(returning: status)
      }
    }
  }

  nonisolated private static func makeTapHandler(requestBox: SpeechRequestBox, monitor: VoiceSignalMonitor)
    -> AVAudioNodeTapBlock
  {
    { buffer, _ in
      requestBox.request.append(buffer)
      monitor.submit(buffer)
    }
  }
}

private final class VoiceSignalMonitor: @unchecked Sendable {
  private let queue = DispatchQueue(label: "jarvis.voice-signal", qos: .userInitiated)
  private let slot = DispatchSemaphore(value: 1)
  private let publish: @Sendable (VoiceSignal) -> Void
  private var analyzer = VoiceSignalAnalyzer()
  private var lastPublished = 0.0

  init(publish: @escaping @Sendable (VoiceSignal) -> Void) {
    self.publish = publish
  }

  func submit(_ buffer: AVAudioPCMBuffer) {
    guard let channel = buffer.floatChannelData?[0], buffer.frameLength > 0,
      buffer.frameLength <= 8192, slot.wait(timeout: .now()) == .success
    else { return }
    let samples = (0..<Int(buffer.frameLength)).map { channel[$0 * buffer.stride] }
    let sampleRate = buffer.format.sampleRate
    queue.async { [self] in
      defer { slot.signal() }
      let signal = analyzer.process(samples, sampleRate: sampleRate)
      let now = ProcessInfo.processInfo.systemUptime
      guard now - lastPublished >= 0.045 else { return }
      lastPublished = now
      publish(signal)
    }
  }
}

private final class SpeechRequestBox: @unchecked Sendable {
  let request: SFSpeechAudioBufferRecognitionRequest

  init(_ request: SFSpeechAudioBufferRecognitionRequest) {
    self.request = request
  }
}

enum AudioProbeError: LocalizedError {
  case speechPermission
  case microphonePermission
  case recognizerUnavailable
  case bluetoothAudioUnavailable
  case noInput
  case audioEngine(String)

  var errorDescription: String? {
    switch self {
    case .speechPermission: "Permissão de reconhecimento de fala negada."
    case .microphonePermission: "Permissão de microfone negada."
    case .recognizerUnavailable: "Reconhecimento de fala em pt-BR indisponível."
    case .bluetoothAudioUnavailable: "Bluetooth HFP ainda não está disponível. Atualize a rota e tente novamente."
    case .noInput: "A rota atual não oferece entrada de áudio."
    case .audioEngine(let detail): "O áudio não iniciou nessa rota: \(detail)"
    }
  }
}
