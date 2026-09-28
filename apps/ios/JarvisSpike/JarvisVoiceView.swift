import SwiftUI

struct JarvisVoiceView: View {
  @Bindable var model: SpikeViewModel
  let showConnections: () -> Void
  @Environment(\.jarvisReduceMotion) private var reduceMotion

  private var listening: Bool { model.isPreview ? model.previewListening : model.isVoiceListening }
  private var speaking: Bool { model.isPreview ? model.previewSpeaking : model.isVoiceSpeaking }
  private var signal: VoiceSignal { model.isPreview ? model.previewVoiceSignal : model.voiceSignal }
  private var speechPulse: Int { model.isPreview ? model.previewSpeechPulse : model.speechPulse }
  private var available: Bool {
    model.isPreview ? model.previewConnected : model.canActivateVoice
  }
  private var compact: Bool { model.isSending && !speaking }
  private var title: String {
    if speaking { return "Jarvis está falando" }
    if model.preparingSpeech { return "Preparando voz Zagan…" }
    if model.realtime.isActive { return model.realtime.status }
    if model.taskHistory.entries.first(where: { $0.id == model.presentedTaskID })?.status == .reconnecting {
      return "Reconectando ao Mac"
    }
    if compact { return model.pendingApprovals.isEmpty ? "Seu pedido está em andamento" : "Aguardando sua decisão" }
    if !available { return "Conecte seus óculos" }
    if model.jarvisModeEnabled { return model.jarvisModeState == .listeningForCommand ? "Ouvindo você" : "Diga “Jarvis”" }
    return listening ? "Ouvindo você" : "Pronto para ouvir"
  }

  var body: some View {
    VStack(spacing: compact ? 10 : 18) {
      Group {
        if speaking {
          SpeechRings(pulse: speechPulse)
            .transition(reduceMotion ? .opacity : .scale(scale: 0.75).combined(with: .opacity))
        } else {
          VoiceWaveform(signal: signal, active: listening && !compact, compact: compact)
            .transition(.opacity)
        }
      }
      .frame(height: speaking ? 96 : (compact ? 26 : 62))
      .accessibilityHidden(true)

      VStack(spacing: 8) {
        Text(title)
          .font(compact ? .subheadline : .title2.weight(.semibold))
          .foregroundStyle(compact ? .secondary : .primary)
          .contentTransition(.interpolate)
          .multilineTextAlignment(.center)
          .accessibilityIdentifier("voice.status")
        if !compact {
          Text(subtitle)
            .font(.subheadline)
            .foregroundStyle(.secondary)
            .multilineTextAlignment(.center)
            .lineLimit(4)
            .contentTransition(.opacity)
        }
      }

      if !compact {
        Button(action: voiceAction) {
          Label(buttonTitle, systemImage: buttonSymbol)
            .font(.headline)
            .contentTransition(reduceMotion ? .opacity : .symbolEffect(.replace))
            .padding(.horizontal, 20)
            .padding(.vertical, 8)
            .frame(minHeight: 44)
        }
        .buttonStyle(.borderedProminent)
        .buttonBorderShape(.capsule)
        .accessibilityIdentifier("voice.action")
        .transition(reduceMotion ? .opacity : .scale(scale: 0.92).combined(with: .opacity))
      }
    }
    .padding(.vertical, compact ? 4 : 10)
    .animation(reduceMotion ? nil : .spring(response: 0.42, dampingFraction: 0.86), value: compact)
    .animation(reduceMotion ? nil : .smooth(duration: 0.25), value: listening)
    .animation(reduceMotion ? nil : .spring(response: 0.45, dampingFraction: 0.85), value: speaking)
    .sensoryFeedback(.selection, trigger: listening)
  }

  private var subtitle: String {
    if speaking { return "Você pode acompanhar a resposta na tarefa." }
    if !available { return "Conecte o Mac e os óculos para começar a conversar." }
    if listening, !model.audio.transcript.isEmpty, !model.jarvisModeEnabled { return model.audio.transcript }
    if model.jarvisModeEnabled { return "A conversa começa pelos seus óculos." }
    return "Seu próximo pedido começa com a sua voz."
  }

  private var buttonTitle: String {
    if model.preparingSpeech { return "Cancelar voz" }
    if speaking { return "Parar resposta" }
    if !available { return "Conectar dispositivos" }
    if model.jarvisModeEnabled || model.realtime.isActive { return "Pausar escuta" }
    return listening ? "Concluir e enviar" : "Falar com Jarvis"
  }

  private var buttonSymbol: String {
    if speaking || model.preparingSpeech { return "stop.fill" }
    if !available { return "link" }
    if model.jarvisModeEnabled || model.realtime.isActive { return "pause.fill" }
    return listening ? "arrow.up" : "mic.fill"
  }

  private func voiceAction() {
    if speaking || model.preparingSpeech {
      #if DEBUG && targetEnvironment(simulator)
      if model.isPreview { model.stopPreviewSpeech(); return }
      #endif
      model.stopSpeaking()
      return
    }
    guard available else { showConnections(); return }
    #if DEBUG && targetEnvironment(simulator)
    if model.isPreview { model.advancePreviewVoice(); return }
    #endif
    if model.jarvisModeEnabled || model.realtime.isActive { model.setJarvisModeEnabled(false) }
    else if model.audio.isListening { Task { await model.stopAndSend() } }
    else { Task { await model.startListening() } }
  }
}

private struct VoiceWaveform: View {
  let signal: VoiceSignal
  let active: Bool
  let compact: Bool
  @Environment(\.jarvisReduceMotion) private var reduceMotion

  var body: some View {
    HStack(spacing: 5) {
      ForEach(0..<17) { index in
        Capsule()
          .fill(Color.blue.gradient)
          .frame(width: 4, height: height(index: index))
          .opacity(0.45 + 0.55 * (1 - abs(Double(index - 8)) / 9))
      }
    }
    .frame(maxHeight: .infinity)
    .animation(reduceMotion ? nil : .easeOut(duration: 0.09), value: signal)
  }

  private func height(index: Int) -> CGFloat {
    let distance = abs(Double(index - 8)) / 8
    guard active else { return 5 + (1 - distance) * (compact ? 7 : 12) }
    guard !reduceMotion else { return 5 + (1 - distance) * 20 }
    let width = 0.8 - signal.normalizedPitch * 0.5
    let envelope = exp(-pow(distance / width, 2))
    return 5 + 54 * signal.level * envelope
  }
}

private struct SpeechRings: View {
  let pulse: Int
  @Environment(\.jarvisReduceMotion) private var reduceMotion
  @Environment(\.scenePhase) private var scenePhase
  @State private var expansion = 0.0

  var body: some View {
    ZStack {
      ForEach(0..<3) { index in
        Circle()
          .stroke(Color.blue.opacity(0.34 - Double(index) * 0.08), lineWidth: 2)
          .frame(width: 48 + CGFloat(index) * 19, height: 48 + CGFloat(index) * 19)
          .scaleEffect(1 + expansion * (0.06 + Double(index) * 0.04))
      }
      Circle()
        .fill(Color.blue.gradient)
        .frame(width: 46, height: 46)
        .scaleEffect(1 + expansion * 0.08)
      Image(systemName: "speaker.wave.2.fill")
        .font(.system(size: 19, weight: .medium))
        .foregroundStyle(.white)
    }
    .frame(maxWidth: .infinity)
    .task(id: pulse) {
      guard !reduceMotion, scenePhase == .active else { expansion = 0; return }
      withAnimation(.easeOut(duration: 0.1)) { expansion = 1 }
      do { try await Task.sleep(for: .milliseconds(120)) }
      catch { return }
      withAnimation(.easeOut(duration: 0.3)) { expansion = 0 }
    }
    .onChange(of: reduceMotion) { _, _ in expansion = 0 }
    .onChange(of: scenePhase) { _, _ in expansion = 0 }
  }
}
