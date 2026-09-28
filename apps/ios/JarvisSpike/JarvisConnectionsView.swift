import SwiftUI

struct JarvisConnectionsView: View {
  @Bindable var model: SpikeViewModel
  @Environment(\.dismiss) private var dismiss

  var body: some View {
    NavigationStack {
      Form {
        Section("Mac") {
          if model.isPreview {
            LabeledContent("Seu Mac", value: model.previewConnected ? "Simulado" : "Desconectado")
          } else {
            TextField("Endereço do gateway", text: $model.gatewayURL)
              .textContentType(.URL)
              .keyboardType(.URL)
              .textInputAutocapitalization(.never)
              .autocorrectionDisabled()
            SecureField("Token de acesso", text: $model.gatewayToken)
              .textInputAutocapitalization(.never)
              .autocorrectionDisabled()
          }
          Picker("Agente", selection: $model.selectedAgent) {
            ForEach(TerminalAgent.allCases) { agent in Text(agent.label).tag(agent) }
          }
          .disabled(model.isSending)
        }
        .disabled(model.isSending)

        Section("Voz") {
          LabeledContent("Conversa", value: "xAI em tempo real")
          LabeledContent("Voz", value: "Zagan")
          LabeledContent("Estado", value: model.realtime.status)
          if model.realtime.isActive {
            Button("Encerrar conversa", role: .destructive) { model.setJarvisModeEnabled(false) }
          }
        }

        Section {
          LabeledContent("Sessão", value: model.isPreview ? (model.previewConnected ? "Simulada" : "Desconectada") : model.sessionStatus)
          if !model.isPreview {
            Button("Conectar óculos", systemImage: "eyeglasses") { model.connectGlasses() }
              .disabled(!model.canRegister)
            Button("Iniciar sessão", systemImage: "play") { model.startDeviceSession() }
              .disabled(!model.canStartSession)
            if model.hasSession {
              Button("Encerrar sessão", role: .destructive) { model.stopDeviceSession() }
            }
            Toggle("Ativar ao dizer “Jarvis”", isOn: Binding(
              get: { model.jarvisModeEnabled },
              set: { model.setJarvisModeEnabled($0) }
            ))
            .disabled(!model.jarvisModeEnabled && (!model.canActivateVoice || model.isSending))
          }
        } header: {
          Text("Óculos")
        } footer: {
          Text(model.isPreview ? "Prévia do simulador. Nenhum dispositivo, microfone ou agente real é utilizado." : "Ao iniciar a sessão, o modo Jarvis é ativado automaticamente. Diga “Jarvis” para conversar.")
        }

        if !model.isPreview {
          Section("Câmera") {
            Toggle("Anexar imagem ao pedido", isOn: $model.attachLatestFrame)
              .disabled(model.latestFrame == nil)
            Text(model.latestFrame == nil ? "Inicie a câmera no diagnóstico para receber imagens dos óculos." : "A imagem mais recente será anexada ao próximo pedido.")
              .font(.caption).foregroundStyle(.secondary)
          }
          Section {
            NavigationLink {
              DiagnosticsView(model: model)
            } label: {
              Label("Diagnóstico", systemImage: "waveform.path.ecg")
            }
          }
        }
      }
      .navigationTitle("Conexões")
      .navigationBarTitleDisplayMode(.inline)
      .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Concluído") { dismiss() } } }
    }
    .presentationDetents([.large])
    .presentationDragIndicator(.visible)
  }
}
