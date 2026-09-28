import SwiftUI

struct DiagnosticsView: View {
  @Bindable var model: SpikeViewModel

  var body: some View {
      ScrollView {
        VStack(alignment: .leading, spacing: 18) {
          statusSection
          cameraSection
          audioSection
          gatewaySection
        }
        .padding()
      }
      .navigationTitle("Diagnóstico")
      .alert("Gate interrompido", isPresented: $model.showError) {
        Button("OK") {}
      } message: {
        Text(model.errorMessage)
      }
      .task { model.audio.refreshRoute() }
  }

  private var statusSection: some View {
    GroupBox("Meta DAT 0.9.0") {
      VStack(alignment: .leading, spacing: 10) {
        StatusRow(label: "Registro", value: model.registrationStatus)
        StatusRow(label: "Dispositivo", value: model.deviceStatus)
        StatusRow(label: "Sessão", value: model.sessionStatus)
        StatusRow(label: "Câmera", value: model.cameraStatus)
        HStack {
          Button("Conectar") { model.connectGlasses() }
            .disabled(!model.canRegister)
          Button("Iniciar sessão") { model.startDeviceSession() }
            .disabled(!model.canStartSession)
          Button("Encerrar") { model.stopDeviceSession() }
            .disabled(!model.hasSession)
        }
        .buttonStyle(.bordered)
      }
      .frame(maxWidth: .infinity, alignment: .leading)
    }
  }

  private var cameraSection: some View {
    GroupBox("Frame dos óculos") {
      VStack(spacing: 12) {
        ZStack {
          RoundedRectangle(cornerRadius: 12)
            .fill(.black.opacity(0.88))
          if let image = model.latestFrame {
            Image(uiImage: image)
              .resizable()
              .scaledToFit()
              .clipShape(RoundedRectangle(cornerRadius: 12))
          } else {
            Text("Nenhum frame recebido")
              .foregroundStyle(.secondary)
          }
        }
        .frame(height: 260)

        HStack {
          Button("Iniciar câmera") {
            Task { await model.startCamera() }
          }
          .disabled(!model.canStartCamera)
          Button("Parar câmera") { model.stopCamera() }
            .disabled(!model.hasCamera)
        }
        .buttonStyle(.borderedProminent)
      }
    }
  }

  private var audioSection: some View {
    GroupBox("Áudio duplex") {
      VStack(alignment: .leading, spacing: 10) {
        StatusRow(label: "Entrada", value: model.audio.inputRoute)
        StatusRow(label: "Saída", value: model.audio.outputRoute)
        StatusRow(
          label: "Gate HFP",
          value: model.audio.isBluetoothHFPDuplex ? "PASS — BluetoothHFP duplex" : "PENDENTE"
        )
        StatusRow(label: "Modo Jarvis", value: model.jarvisModeState.rawValue)
        StatusRow(label: "Formato xAI", value: model.realtime.audio.formatDescription)
        Button(model.jarvisModeEnabled ? "Desativar Jarvis" : "Ativar Jarvis") {
          model.setJarvisModeEnabled(!model.jarvisModeEnabled)
        }
        .buttonStyle(.borderedProminent)
        .disabled(!model.jarvisModeEnabled && (!model.canActivateVoice || model.isSending))
        Text(model.audio.transcript.isEmpty ? "A transcrição aparecerá aqui." : model.audio.transcript)
          .frame(maxWidth: .infinity, minHeight: 54, alignment: .topLeading)
          .padding(10)
          .background(.secondary.opacity(0.1), in: RoundedRectangle(cornerRadius: 8))
        HStack {
          Button(model.audio.isListening ? "Capturando…" : "Iniciar fala") {
            Task { await model.startListening() }
          }
          .disabled(model.audio.isListening || model.jarvisModeEnabled)
          Button("Parar") { model.audio.stopListening() }
            .disabled(!model.audio.isListening || model.jarvisModeEnabled)
          Button("Atualizar rota") { model.audio.refreshRoute() }
        }
        .buttonStyle(.bordered)
      }
      .frame(maxWidth: .infinity, alignment: .leading)
    }
  }

  private var gatewaySection: some View {
    GroupBox("Agente no Mac") {
      VStack(alignment: .leading, spacing: 10) {
        Picker("Agente", selection: $model.selectedAgent) {
          ForEach(TerminalAgent.allCases) { agent in
            Text(agent.label).tag(agent)
          }
        }
        .disabled(model.isSending)
        TextField("http://Mac.local:4317", text: $model.gatewayURL)
          .textInputAutocapitalization(.never)
          .autocorrectionDisabled()
          .textFieldStyle(.roundedBorder)
          .disabled(model.isSending)
        SecureField("JARVIS_GATEWAY_TOKEN", text: $model.gatewayToken)
          .textFieldStyle(.roundedBorder)
          .disabled(model.isSending)
        Toggle("Anexar último frame", isOn: $model.attachLatestFrame)
          .disabled(model.latestFrame == nil)
        Button(model.isSending ? "Enviando…" : "Parar fala e enviar") {
          Task { await model.stopAndSend() }
        }
        .buttonStyle(.borderedProminent)
        .disabled(model.isSending || model.audio.transcript.isEmpty)

        if !model.agentActivity.isEmpty { Text(model.agentActivity).font(.callout) }
        if model.isSending {
          Button("Cancelar tarefa", role: .destructive) { Task { await model.cancelTurn() } }
            .disabled(!model.canCancelTurn)
        }
        ForEach(model.pendingApprovals) { approval in
          VStack(alignment: .leading, spacing: 8) {
            Text(approval.title).font(.headline)
            Text(approval.detail).font(.caption.monospaced()).textSelection(.enabled)
            HStack {
              Button("Permitir uma vez") { Task { await model.answerApproval(approval, approved: true) } }
              Button("Recusar", role: .destructive) { Task { await model.answerApproval(approval, approved: false) } }
            }
            .buttonStyle(.bordered)
            .disabled(model.submittingApprovals.contains(approval.id))
          }
          .padding(10)
          .background(.orange.opacity(0.12), in: RoundedRectangle(cornerRadius: 8))
        }
        if !model.responseText.isEmpty {
          Text(model.responseText)
            .textSelection(.enabled)
            .frame(maxWidth: .infinity, alignment: .leading)
          Button("Ouvir nos óculos") { model.speakResponse(model.responseText) }
            .buttonStyle(.bordered)
        }
      }
      .frame(maxWidth: .infinity, alignment: .leading)
    }
  }
}
private struct StatusRow: View {
  let label: String
  let value: String

  var body: some View {
    HStack(alignment: .top) {
      Text(label)
        .foregroundStyle(.secondary)
      Spacer()
      Text(value)
        .multilineTextAlignment(.trailing)
    }
    .font(.callout)
  }
}
