import AVFoundation
import MWDATCamera
import MWDATCore
import Observation
import UIKit

@Observable
@MainActor
final class SpikeViewModel {
  var registrationStatus: String
  var deviceStatus = "Nenhum dispositivo DAT"
  var sessionStatus = "idle"
  var cameraStatus = "stopped"
  var latestFrame: UIImage?
  var gatewayURL = "" {
    didSet {
      if settingsLoaded { gatewaySettings.saveURL(gatewayURL) }
    }
  }
  var gatewayToken = "" {
    didSet {
      guard settingsLoaded, gatewayToken != oldValue else { return }
      do { try gatewaySettings.saveToken(gatewayToken) }
      catch { fail("Token não salvo. \(error.localizedDescription)") }
    }
  }
  var selectedAgent: TerminalAgent = .codex
  var agentActivity = ""
  var pendingApprovals: [AgentApproval] = []
  var submittingApprovals: Set<String> = []
  var canCancelTurn = false
  var attachLatestFrame = true
  var responseText = ""
  var isSending = false {
    didSet { if !isSending { activateVoiceForStartedSession() } }
  }
  var showError = false
  var errorMessage = ""
  var jarvisModeEnabled = false
  var jarvisModeState: JarvisModeState = .off
  let audio = AudioProbe()
  let realtime = XAIRealtimeSession()
  let speechAudio = XAIAudio()
  var preparingSpeech = false
  var isVoiceSpeaking: Bool { realtime.audio.isSpeaking || speechAudio.isSpeaking }
  var isVoiceListening: Bool { realtime.audio.isListening || audio.isListening }
  var voiceSignal: VoiceSignal { realtime.isActive ? realtime.audio.signal : audio.voiceSignal }
  var speechPulse: Int { realtime.audio.pulse + speechAudio.pulse }
  @ObservationIgnored private var voiceRunID = UUID()
  @ObservationIgnored private var speechID = UUID()
  @ObservationIgnored private var speechTask: Task<Void, Never>?

  let isPreview: Bool
  var taskHistory = JarvisTaskHistory()
  var presentedTaskID: String?
  var previewListening = false
  var previewConnected = true
  var previewSpeaking = false
  var previewVoiceSignal = VoiceSignal.silence
  var previewSpeechPulse = 0
  @ObservationIgnored var previewAudioTask: Task<Void, Never>?

  @ObservationIgnored private let wearables: WearablesInterface?
  @ObservationIgnored private let selector: AutoDeviceSelector?
  @ObservationIgnored private let sessionTokens = ListenerTokenBag()
  @ObservationIgnored private let cameraTokens = ListenerTokenBag()
  @ObservationIgnored private var registrationTask: Task<Void, Never>?
  @ObservationIgnored private var devicesTask: Task<Void, Never>?
  @ObservationIgnored private var session: DeviceSession?
  @ObservationIgnored private var shouldActivateVoiceForSession = false
  @ObservationIgnored private var camera: MWDATCamera.Camera?
  @ObservationIgnored private var activeGateway: (url: URL, token: String, requestId: String)?
  @ObservationIgnored private var turnTask: Task<String, Error>?
  @ObservationIgnored private var turnWasCancelled = false
  @ObservationIgnored private var jarvisLoopTask: Task<Void, Never>?
  @ObservationIgnored private let gatewaySettings = GatewaySettings()
  @ObservationIgnored private var settingsLoaded = false

  init(wearables: WearablesInterface?, startupError: String?, preview: Bool = false) {
    #if DEBUG && targetEnvironment(simulator)
    isPreview = preview
    #else
    isPreview = false
    #endif
    self.wearables = wearables
    self.selector = wearables.map { AutoDeviceSelector(wearables: $0) }
    self.registrationStatus = wearables?.registrationState.description ?? "SDK indisponível"
    if let startupError {
      errorMessage = "MWDAT configure falhou: \(startupError)"
      showError = true
    }
    if !isPreview {
      restoreGatewaySettings()
      observeWearables()
    }
  }

  private func restoreGatewaySettings() {
    gatewayURL = gatewaySettings.url ?? gatewayURL
    do {
      let savedToken = try gatewaySettings.loadToken()
      gatewayToken = savedToken ?? ""
      #if DEBUG
      let environment = ProcessInfo.processInfo.environment
      if gatewaySettings.url == nil, let url = environment["JARVIS_GATEWAY_URL"] {
        gatewayURL = url
        gatewaySettings.saveURL(url)
      }
      if savedToken == nil, let token = environment["JARVIS_GATEWAY_TOKEN"], !token.isEmpty {
        try gatewaySettings.saveToken(token)
        gatewayToken = token
      }
      #endif
    } catch {
      fail("Configuração do gateway não recuperada. \(error.localizedDescription)")
    }
    settingsLoaded = true
  }

  var canRegister: Bool {
    wearables?.registrationState == .available
  }

  var canStartSession: Bool {
    wearables?.registrationState == .registered && session == nil && !(wearables?.devices.isEmpty ?? true)
  }

  var hasSession: Bool { session != nil }
  var canActivateVoice: Bool { hasSession && sessionStatus == sessionLabel(.started) }
  var hasCamera: Bool { camera != nil }
  var canStartCamera: Bool { session?.state == .started && camera == nil }

  func connectGlasses() {
    guard let wearables else { return }
    Task {
      do {
        try await wearables.startRegistration()
      } catch {
        fail("Registro DAT falhou: \(error.localizedDescription)")
      }
    }
  }

  func handleDATURL(_ url: URL) async {
    guard let wearables else { return }
    guard URLComponents(url: url, resolvingAgainstBaseURL: false)?
      .queryItems?.contains(where: { $0.name == "metaWearablesAction" }) == true
    else { return }
    do {
      _ = try await wearables.handleUrl(url)
    } catch {
      fail("Callback DAT falhou: \(error.localizedDescription)")
    }
  }

  func startDeviceSession() {
    guard let wearables, let selector, session == nil else { return }
    do {
      let newSession = try wearables.createSession(deviceSelector: selector)
      session = newSession
      newSession.statePublisher.listen { [weak self, weak newSession] state in
        Task { @MainActor in
          guard let self, let newSession, self.session === newSession else { return }
          self.handleSessionState(state)
        }
      }.store(in: sessionTokens)
      newSession.errorPublisher.listen { [weak self, weak newSession] error in
        Task { @MainActor in
          guard let self, let newSession, self.session === newSession else { return }
          self.fail("Sessão DAT: \(error.localizedDescription)")
        }
      }.store(in: sessionTokens)
      sessionStatus = "starting"
      shouldActivateVoiceForSession = true
      try newSession.start()
    } catch {
      session = nil
      sessionTokens.clear()
      shouldActivateVoiceForSession = false
      fail("Não foi possível iniciar a sessão DAT: \(error.localizedDescription)")
    }
  }

  func stopDeviceSession() {
    setJarvisModeEnabled(false)
    camera?.stop()
    session?.stop()
    camera = nil
    session = nil
    latestFrame = nil
    cameraStatus = "stopped"
    sessionStatus = "stopped"
    cameraTokens.clear()
    sessionTokens.clear()
  }

  func startCamera() async {
    guard let wearables, let activeSession = session, activeSession.state == .started, camera == nil else { return }
    do {
      let status = try await wearables.checkPermissionStatus(.camera)
      if status != .granted {
        guard try await wearables.requestPermission(.camera) == .granted else {
          if self.session === activeSession { fail("A permissão de câmera foi negada no Meta AI.") }
          return
        }
      }
      guard self.session === activeSession, activeSession.state == .started, camera == nil else { return }
      let config = StreamConfiguration(videoCodec: .raw, resolution: .low, frameRate: 15)
      guard let newCamera = try activeSession.addCamera(config: config) else {
        fail("O SDK não criou a câmera DAT.")
        return
      }
      camera = newCamera
      observeCamera(newCamera)
      cameraStatus = "starting"
      newCamera.stream.start()
    } catch {
      if self.session === activeSession { fail("Câmera DAT falhou: \(error.localizedDescription)") }
    }
  }

  func stopCamera() {
    camera?.stop()
    camera = nil
    latestFrame = nil
    cameraStatus = "stopped"
    cameraTokens.clear()
  }

  func startListening() async {
    guard canActivateVoice, !isSending else { return }
    setJarvisModeEnabled(false)
    let id = voiceRunID
    jarvisLoopTask = Task { [weak self] in
      guard let self else { return }
      do { try await runRealtimeConversation() }
      catch { if voiceRunID == id, !Task.isCancelled { fail(error.localizedDescription) } }
    }
  }

  func setJarvisModeEnabled(_ enabled: Bool) {
    guard !enabled || (canActivateVoice && !isSending) else { return }
    shouldActivateVoiceForSession = false
    voiceRunID = UUID()
    jarvisLoopTask?.cancel()
    jarvisLoopTask = nil
    realtime.stop()
    stopSpeaking()
    audio.stopListening()
    jarvisModeEnabled = enabled
    jarvisModeState = enabled ? .waitingForWakeWord : .off
    guard enabled else { return }
    let id = voiceRunID
    jarvisLoopTask = Task { [weak self] in await self?.runJarvisLoop(id: id) }
  }

  func stopSpeaking() {
    speechID = UUID()
    speechTask?.cancel()
    speechTask = nil
    preparingSpeech = false
    speechAudio.stop()
    audio.stopSpeaking()
    if realtime.isActive { realtime.interruptResponse() }
  }

  func speakResponse(_ text: String) {
    guard !text.isEmpty else { return }
    if realtime.isActive {
      realtime.say(text)
      return
    }
    setJarvisModeEnabled(false)
    let id = speechID
    preparingSpeech = true
    speechTask = Task { [weak self] in
      guard let self else { return }
      defer { if speechID == id { preparingSpeech = false } }
      do {
        let url = try voiceGatewayURL()
        let data = try await GatewayClient.speakXAI(baseURL: url, token: gatewayToken, text: text)
        try Task.checkCancellation()
        guard speechID == id else { return }
        try speechAudio.prepare()
        try speechAudio.enqueue(data)
      } catch {
        if speechID == id, !Task.isCancelled { fail(error.localizedDescription) }
      }
    }
  }

  private func voiceGatewayURL() throws -> URL {
    guard let url = URL(string: gatewayURL), ["http", "https"].contains(url.scheme ?? ""), url.host != nil,
      !gatewayToken.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
      throw XAIVoiceError.unavailable("Confira endereço e token do gateway em Conexões.")
    }
    return url
  }

  private func runRealtimeConversation() async throws {
    guard await AVAudioApplication.requestRecordPermission() else { throw AudioProbeError.microphonePermission }
    try Task.checkCancellation()
    audio.stopListening()
    realtime.executeTask = { [weak self] message in
      guard let self, !isSending else { return "Já há uma tarefa em andamento. Aguarde sua conclusão." }
      let previousID = presentedTaskID
      audio.transcript = message
      await stopAndSend(speakResult: false)
      guard presentedTaskID != previousID, let entry = taskHistory.entries.first(where: { $0.id == presentedTaskID }) else {
        return "A tarefa não foi iniciada. Confira o erro exibido no iPhone."
      }
      return "Estado: \(entry.status.rawValue). Resultado: \(entry.response). Atividade: \(entry.activity)"
    }
    realtime.onResponse = { [weak self] request, response in
      guard let self, !request.isEmpty else { return }
      let id = UUID().uuidString
      taskHistory.start(id: id, request: request, agent: "xAI · Zagan")
      presentedTaskID = id
      updatePresentedTask(status: .completed, activity: "Conversa por voz", response: response)
      responseText = response
    }
    try await realtime.run(baseURL: voiceGatewayURL(), token: gatewayToken)
  }

  func stopAndSend(speakResult: Bool = true) async {
    guard !isSending else { return }
    isSending = true
    defer {
      isSending = false
      canCancelTurn = false
      activeGateway = nil
      turnTask = nil
      pendingApprovals = []
      submittingApprovals = []
    }
    audio.stopListening()
    do { try await Task.sleep(for: .milliseconds(350)) }
    catch { return }
    let message = audio.transcript.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !message.isEmpty else {
      fail("Nenhuma fala foi reconhecida.")
      return
    }
    guard let url = URL(string: gatewayURL), ["http", "https"].contains(url.scheme ?? ""), url.host != nil else {
      fail("URL do gateway inválida.")
      return
    }
    guard !gatewayToken.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
      fail("Informe o token do gateway antes de executar tarefas.")
      return
    }
    let token = gatewayToken
    let requestId = UUID().uuidString
    let agent = selectedAgent
    presentedTaskID = requestId
    taskHistory.start(id: requestId, request: message, agent: agent.label)
    activeGateway = (url, token, requestId)
    turnWasCancelled = false
    responseText = ""
    agentActivity = "Conectando ao \(agent.label)…"
    let imageData = attachLatestFrame ? latestFrame?.jpegData(compressionQuality: 0.65) : nil
    let task = Task { [weak self] in
      try await GatewayClient.performTurn(
        baseURL: url, token: token, requestId: requestId, agent: agent,
        message: message, jpegData: imageData,
        onSnapshot: { snapshot in self?.handleTurnSnapshot(snapshot) },
        onReconnecting: {
          self?.agentActivity = "Reconectando à tarefa no Mac…"
          self?.pendingApprovals = []
          self?.updatePresentedTask(status: .reconnecting, activity: "Aguardando conexão com o Mac. O andamento pode estar desatualizado.")
        }
      )
    }
    turnTask = task
    do {
      let finalText = try await task.value
      guard !turnWasCancelled, !Task.isCancelled else { return }
      responseText = finalText
      agentActivity = "Concluído"
      updatePresentedTask(status: .completed, activity: "Concluída no Mac", response: finalText)
      if speakResult { speakResponse(finalText) }
    } catch {
      if turnWasCancelled || Task.isCancelled {
        agentActivity = "Interrompido. Alterações já feitas podem permanecer."
        updatePresentedTask(status: .cancelled, activity: agentActivity)
      } else {
        agentActivity = "Tarefa não concluída"
        updatePresentedTask(status: .failed, activity: "Não foi possível confirmar a conclusão. \(error.localizedDescription)")
        fail("Gateway/\(agent.label) falhou: \(error.localizedDescription)")
      }
    }
  }

  func answerApproval(_ approval: AgentApproval, approved: Bool) async {
    guard let active = activeGateway, !submittingApprovals.contains(approval.id) else { return }
    submittingApprovals.insert(approval.id)
    defer { submittingApprovals.remove(approval.id) }
    do {
      try await GatewayClient.approve(baseURL: active.url, token: active.token,
        requestId: active.requestId, approvalId: approval.id, approved: approved)
      guard activeGateway?.requestId == active.requestId else { return }
      pendingApprovals.removeAll { $0.id == approval.id }
      updatePresentedTask(status: pendingApprovals.isEmpty ? .running : .needsApproval, activity: "Decisão enviada ao agente")
    } catch {
      if activeGateway?.requestId == active.requestId { fail(error.localizedDescription) }
    }
  }

  func cancelTurn() async {
    guard let active = activeGateway, canCancelTurn else { return }
    canCancelTurn = false
    turnWasCancelled = true
    do {
      try await GatewayClient.cancel(baseURL: active.url, token: active.token, requestId: active.requestId)
      guard activeGateway?.requestId == active.requestId else { return }
      turnWasCancelled = true
      turnTask?.cancel()
      agentActivity = "Interrompido. Alterações já feitas podem permanecer."
    } catch {
      if activeGateway?.requestId == active.requestId {
        turnWasCancelled = false
        canCancelTurn = true
        fail("Não foi possível confirmar o cancelamento: \(error.localizedDescription)")
      }
    }
  }

  private func handleTurnSnapshot(_ snapshot: GatewayTurnSnapshot) {
    let previousIDs = Set(pendingApprovals.map(\.id))
    let status: JarvisTaskStatus
    switch snapshot.status {
    case "completed": status = .completed
    case "failed": status = turnWasCancelled ? .cancelled : .failed
    default: status = snapshot.approvals.isEmpty ? .running : .needsApproval
    }
    taskHistory.update(id: snapshot.requestId, status: status, activity: snapshot.activity, response: snapshot.text)
    responseText = snapshot.text
    pendingApprovals = snapshot.approvals
    canCancelTurn = snapshot.status == "running" && !turnWasCancelled
    agentActivity = pendingApprovals.isEmpty ? snapshot.activity : "Aguardando sua aprovação no iPhone"
    if snapshot.approvals.contains(where: { !previousIDs.contains($0.id) }) {
      speakResponse("O agente precisa de uma aprovação. Confira o iPhone.")
    }
  }

  func updatePresentedTask(status: JarvisTaskStatus, activity: String, response: String? = nil) {
    guard let presentedTaskID else { return }
    taskHistory.update(id: presentedTaskID, status: status, activity: activity, response: response)
  }

  private func runJarvisLoop(id: UUID) async {
    do {
      try await audio.startListening()
      if await waitForWakeWord(), voiceRunID == id, !Task.isCancelled {
        jarvisModeState = .listeningForCommand
        try await runRealtimeConversation()
      }
    } catch {
      if voiceRunID == id, !Task.isCancelled { fail("Modo Jarvis falhou: \(error.localizedDescription)") }
    }
    guard voiceRunID == id else { return }
    audio.stopListening()
    jarvisModeEnabled = false
    jarvisModeState = .off
  }

  private func waitForWakeWord() async -> Bool {
    while jarvisModeEnabled, !Task.isCancelled {
      if containsWakeWord(audio.transcript) { return true }
      if !audio.isListening {
        try? await Task.sleep(for: .milliseconds(200))
        guard jarvisModeEnabled, !Task.isCancelled else { return false }
        do {
          try await audio.startListening()
        } catch {
          fail("Wake word falhou: \(error.localizedDescription)")
          return false
        }
      }
      try? await Task.sleep(for: .milliseconds(100))
    }
    return false
  }

  private func observeWearables() {
    guard let wearables else { return }
    registrationTask = Task { [weak self] in
      guard let self else { return }
      for await state in wearables.registrationStateStream() {
        registrationStatus = state.description
      }
    }
    devicesTask = Task { [weak self] in
      guard let self else { return }
      for await identifiers in wearables.devicesStream() {
        updateDeviceStatus(identifiers)
      }
    }
    updateDeviceStatus(wearables.devices)
  }

  private func updateDeviceStatus(_ identifiers: [DeviceIdentifier]) {
    guard let identifier = identifiers.first,
      let device = wearables?.deviceForIdentifier(identifier)
    else {
      deviceStatus = "Nenhum dispositivo DAT"
      return
    }
    deviceStatus = "\(device.nameOrId()) — \(device.deviceType().rawValue) — \(linkLabel(device.linkState))"
  }

  private func observeCamera(_ camera: MWDATCamera.Camera) {
    camera.stream.statePublisher.listen { [weak self, weak camera] state in
      Task { @MainActor in
        guard let self, let camera, self.camera === camera else { return }
        self.cameraStatus = streamLabel(state)
      }
    }.store(in: cameraTokens)
    camera.stream.errorPublisher.listen { [weak self, weak camera] error in
      Task { @MainActor in
        guard let self, let camera, self.camera === camera else { return }
        self.fail("Stream DAT: \(error.localizedDescription)")
      }
    }.store(in: cameraTokens)
    camera.stream.videoFramePublisher.listen { [weak self, weak camera] frame in
      let image = frame.makeUIImage()
      Task { @MainActor in
        guard let self, let camera, self.camera === camera, let image else { return }
        self.latestFrame = image
        self.cameraStatus = "streaming — primeiro frame recebido"
      }
    }.store(in: cameraTokens)
  }

  private func activateVoiceForStartedSession() {
    guard shouldActivateVoiceForSession, canActivateVoice, !isSending else { return }
    setJarvisModeEnabled(true)
  }

  private func handleSessionState(_ state: DeviceSessionState) {
    sessionStatus = sessionLabel(state)
    if state == .started { activateVoiceForStartedSession() }
    if state == .stopped {
      setJarvisModeEnabled(false)
      stopCamera()
      session = nil
      sessionTokens.clear()
    }
  }

  private func fail(_ message: String) {
    errorMessage = message
    showError = true
  }
}

enum JarvisModeState: String {
  case off = "desativado"
  case waitingForWakeWord = "ouvindo ‘Jarvis’"
  case acknowledging = "ativado"
  case listeningForCommand = "ouvindo pergunta"
  case sending = "enviando"
  case speaking = "respondendo"
  case failed = "interrompido"
}

private func containsWakeWord(_ transcript: String) -> Bool {
  let normalized = transcript
    .folding(options: [.caseInsensitive, .diacriticInsensitive], locale: Locale(identifier: "pt-BR"))
    .components(separatedBy: CharacterSet.alphanumerics.inverted)
    .filter { !$0.isEmpty }
    .joined(separator: " ")
  return normalized.components(separatedBy: " ").contains("jarvis")
}

private func linkLabel(_ state: LinkState) -> String {
  switch state {
  case .disconnected: "disconnected"
  case .connecting: "connecting"
  case .connected: "connected"
  }
}

private func sessionLabel(_ state: DeviceSessionState) -> String {
  switch state {
  case .idle: "idle"
  case .starting: "starting"
  case .started: "started"
  case .paused: "paused"
  case .stopping: "stopping"
  case .stopped: "stopped"
  }
}

private func streamLabel(_ state: StreamState) -> String {
  switch state {
  case .stopping: "stopping"
  case .stopped: "stopped"
  case .waitingForDevice: "waitingForDevice"
  case .starting: "starting"
  case .streaming: "streaming"
  case .paused: "paused"
  }
}
