#if DEBUG && targetEnvironment(simulator)
import Foundation

enum JarvisPreviewScenario: String, CaseIterable, Identifiable {
  case ready = "Pronto"
  case listening = "Ouvindo"
  case speaking = "Jarvis falando"
  case working = "Executando"
  case approval = "Aprovação"
  case reconnecting = "Reconectando"
  case completed = "Concluído"
  case failed = "Falha"
  case empty = "Sem tarefas"
  case disconnected = "Desconectado"

  var id: String { rawValue }
  var symbol: String {
    switch self {
    case .ready: "waveform"
    case .listening: "mic"
    case .speaking: "speaker.wave.2"
    case .working: "ellipsis"
    case .approval: "hand.raised"
    case .reconnecting: "wifi.slash"
    case .completed: "checkmark.circle"
    case .failed: "exclamationmark.circle"
    case .empty: "tray"
    case .disconnected: "link"
    }
  }
}

extension SpikeViewModel {
  func loadPreview(_ scenario: JarvisPreviewScenario) {
    guard isPreview else { return }
    previewAudioTask?.cancel()
    previewAudioTask = nil
    previewSpeaking = false
    previewSpeechPulse = 0
    previewVoiceSignal = .silence
    taskHistory = JarvisTaskHistory()
    pendingApprovals = []
    submittingApprovals = []
    isSending = false
    canCancelTurn = false
    previewListening = scenario == .listening
    previewConnected = scenario != .disconnected
    audio.transcript = previewListening ? "Adapte o briefing para uma clínica odontológica." : ""
    presentedTaskID = nil
    if scenario == .listening { startPreviewMeter(.expressive) }
    guard scenario != .empty && scenario != .disconnected else { return }
    taskHistory.start(id: "preview-summary", request: "Resuma o briefing em três frases", agent: "Grok Code", date: .now.addingTimeInterval(-1500))
    taskHistory.update(id: "preview-summary", status: .completed, activity: "Concluída no Mac", response: "O projeto apresenta uma clínica odontológica. A página destaca serviços e depoimentos. O agendamento acontece pelo WhatsApp.")
    taskHistory.start(id: "preview-briefing", request: "Crie um briefing para a clínica", agent: "Codex", date: .now.addingTimeInterval(-720))
    taskHistory.update(id: "preview-briefing", status: .completed, activity: "Concluída no Mac", response: "Preparei o briefing com os serviços da clínica, depoimentos de pacientes e agendamento pelo WhatsApp.")
    guard ![.ready, .listening].contains(scenario) else { return }
    let id = UUID().uuidString
    presentedTaskID = id
    taskHistory.start(id: id, request: "Adapte o briefing para uma clínica odontológica", agent: selectedAgent.label)
    let status: JarvisTaskStatus
    let activity: String
    switch scenario {
    case .approval:
      status = .needsApproval
      activity = "O agente precisa da sua permissão para alterar um arquivo."
      pendingApprovals = [previewApproval]
    case .reconnecting:
      status = .reconnecting
      activity = "Aguardando conexão com o Mac. O andamento pode estar desatualizado."
    case .completed, .speaking:
      status = .completed
      activity = "Concluída no Mac"
    case .failed:
      status = .failed
      activity = "O agente não concluiu o pedido. Confira os efeitos antes de tentar novamente."
    default:
      status = .running
      activity = "Revisando o briefing no seu Mac…"
    }
    isSending = status.isActive
    canCancelTurn = status.isActive && status != .reconnecting
    taskHistory.update(id: id, status: status, activity: activity, response: status == .completed ? previewResponse : nil)
    if scenario == .speaking { startPreviewSpeech() }
  }

  func advancePreviewVoice() {
    guard isPreview else { return }
    if !previewListening { loadPreview(.listening); return }
    loadPreview(.working)
    let id = presentedTaskID
    Task {
      try? await Task.sleep(for: .seconds(1.8))
      guard id == presentedTaskID, isSending else { return }
      pendingApprovals = [previewApproval]
      updatePresentedTask(status: .needsApproval, activity: "O agente precisa da sua permissão para alterar um arquivo.")
    }
  }

  func resolvePreviewApproval(approved: Bool) async {
    guard isPreview else { return }
    pendingApprovals = []
    if !approved {
      updatePresentedTask(status: .cancelled, activity: "Alteração recusada. Os efeitos anteriores não foram desfeitos.")
      isSending = false
      canCancelTurn = false
      return
    }
    updatePresentedTask(status: .running, activity: "Atualizando o briefing…")
    let id = presentedTaskID
    try? await Task.sleep(for: .seconds(0.9))
    guard id == presentedTaskID, isSending else { return }
    updatePresentedTask(status: .completed, activity: "Concluída no Mac", response: previewResponse)
    isSending = false
    canCancelTurn = false
    startPreviewSpeech()
  }

  func cancelPreview() {
    guard isPreview else { return }
    updatePresentedTask(status: .cancelled, activity: "Tarefa interrompida. Alterações já feitas podem permanecer.")
    pendingApprovals = []
    isSending = false
    canCancelTurn = false
  }

  func loadVoicePreview(_ preset: VoicePreviewPreset) {
    loadPreview(.listening)
    startPreviewMeter(preset)
  }

  func stopPreviewSpeech() {
    previewAudioTask?.cancel()
    previewAudioTask = nil
    previewSpeaking = false
  }

  private func startPreviewMeter(_ preset: VoicePreviewPreset) {
    previewAudioTask?.cancel()
    previewAudioTask = Task { [weak self] in
      var analyzer = VoiceSignalAnalyzer()
      var phase = 0.0
      var time = 0.0
      while !Task.isCancelled {
        let parameters = preset.parameters(time: time)
        let samples = (0..<800).map { _ -> Float in
          phase += 2 * .pi * parameters.pitch / 16000
          if phase > 2 * .pi { phase -= 2 * .pi }
          return Float(parameters.amplitude * sin(phase))
        }
        self?.previewVoiceSignal = analyzer.process(samples, sampleRate: 16000)
        time += 0.05
        do { try await Task.sleep(for: .milliseconds(50)) }
        catch { return }
      }
    }
  }

  private func startPreviewSpeech() {
    previewAudioTask?.cancel()
    previewListening = false
    previewVoiceSignal = .silence
    previewSpeaking = true
    previewSpeechPulse = 0
    let words = previewResponse.split(whereSeparator: \.isWhitespace).map(String.init)
    previewAudioTask = Task { [weak self] in
      for word in words {
        guard !Task.isCancelled else { return }
        self?.previewSpeechPulse += 1
        let duration = max(180, min(500, word.count * 45))
        do { try await Task.sleep(for: .milliseconds(duration)) }
        catch { return }
      }
      self?.previewSpeaking = false
    }
  }

  private var previewApproval: AgentApproval {
    AgentApproval(id: "preview-permission", title: "Alterar briefing.md", detail: "O Codex quer atualizar o arquivo briefing.md na pasta do projeto da clínica. A alteração inclui os serviços odontológicos e o agendamento pelo WhatsApp.")
  }

  private var previewResponse: String {
    "Atualizei o briefing da clínica.\n\n• Serviços odontológicos em destaque.\n• Depoimentos de pacientes.\n• Agendamento pelo WhatsApp.\n\nO arquivo briefing.md está atualizado no seu Mac."
  }
}
enum VoicePreviewPreset: String, CaseIterable, Identifiable {
  case expressive = "Voz com variação"
  case soft = "Voz suave"
  case loud = "Voz forte"
  case low = "Tom grave"
  case high = "Tom agudo"
  case silence = "Silêncio"

  var id: String { rawValue }

  func parameters(time: Double) -> (amplitude: Double, pitch: Double) {
    switch self {
    case .expressive:
      let paused = time.truncatingRemainder(dividingBy: 5) > 4
      return (paused ? 0 : 0.015 + 0.2 * (sin(time * 3) + 1) / 2, 100 + 200 * (sin(time * 1.5) + 1) / 2)
    case .soft: return (0.015, 180)
    case .loud: return (0.22, 180)
    case .low: return (0.09, 100)
    case .high: return (0.09, 320)
    case .silence: return (0, 180)
    }
  }
}
#endif
