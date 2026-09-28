import SwiftUI

extension JarvisTaskStatus {
  var color: Color {
    switch self {
    case .running: .blue
    case .needsApproval, .reconnecting: .orange
    case .completed: .green
    case .failed: .red
    case .cancelled: .secondary
    }
  }
}

struct JarvisCurrentTaskView: View {
  let task: JarvisTask
  @Environment(\.jarvisReduceMotion) private var reduceMotion

  var body: some View {
    VStack(alignment: .leading, spacing: 13) {
      Label(task.status.label, systemImage: task.status.symbol)
        .font(.subheadline.weight(.medium))
        .foregroundStyle(task.status.color)
        .contentTransition(reduceMotion ? .opacity : .symbolEffect(.replace))
      Text(task.title).font(.headline).foregroundStyle(.primary)
      Text(task.activity).font(.subheadline).foregroundStyle(.secondary).lineLimit(3)
      HStack {
        Text(task.status == .needsApproval ? "Revisar pedido" : "Acompanhar tarefa")
          .font(.subheadline.weight(.semibold))
        Spacer()
        Image(systemName: "chevron.right").font(.caption.weight(.semibold))
      }
      .foregroundStyle(.blue)
      .padding(.top, 3)
    }
    .frame(maxWidth: .infinity, alignment: .leading)
    .padding(20)
    .background(Color(uiColor: .secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 22))
  }
}

struct JarvisTaskRow: View {
  let task: JarvisTask
  var showsChevron = true
  @Environment(\.dynamicTypeSize) private var typeSize

  var body: some View {
    HStack(spacing: 13) {
      Image(systemName: task.status.symbol)
        .foregroundStyle(task.status.color)
        .font(.title3)
        .frame(width: 24)
      VStack(alignment: .leading, spacing: 5) {
        Text(task.title).font(.headline).foregroundStyle(.primary).lineLimit(typeSize.isAccessibilitySize ? nil : 2)
        Text("\(task.status.label) · \(task.agent)")
          .font(.caption).foregroundStyle(.secondary)
      }
      Spacer(minLength: 4)
      if showsChevron {
        Image(systemName: "chevron.right").font(.caption.weight(.semibold)).foregroundStyle(.tertiary)
      }
    }
    .padding(showsChevron ? 17 : 3)
    .frame(minHeight: 64)
    .accessibilityElement(children: .combine)
  }
}

struct JarvisTaskListView: View {
  @Bindable var model: SpikeViewModel

  var body: some View {
    List {
      if model.taskHistory.entries.isEmpty {
        ContentUnavailableView("Ainda não há tarefas", systemImage: "checklist", description: Text("Os pedidos feitos nesta sessão aparecem aqui."))
          .listRowBackground(Color.clear)
      } else {
        if !activeTasks.isEmpty {
          Section("Em andamento") {
            ForEach(activeTasks) { task in taskLink(task) }
          }
        }
        Section {
          ForEach(model.taskHistory.entries.filter { !$0.status.isActive }) { task in taskLink(task) }
        } header: {
          Text("Recentes")
        } footer: {
          Text("Histórico desta sessão. As tarefas não são mantidas depois de encerrar o app.")
        }
      }
    }
    .listStyle(.insetGrouped)
  }

  private var activeTasks: [JarvisTask] { model.taskHistory.entries.filter { $0.status.isActive } }

  private func taskLink(_ task: JarvisTask) -> some View {
    NavigationLink(value: task.id) { JarvisTaskRow(task: task, showsChevron: false) }
  }
}

struct JarvisTaskDetailView: View {
  @Bindable var model: SpikeViewModel
  let taskID: String
  @Environment(\.jarvisReduceMotion) private var reduceMotion
  @State private var showApproval = false
  @State private var copied = false

  private var task: JarvisTask? { model.taskHistory.entries.first { $0.id == taskID } }

  var body: some View {
    ScrollView {
      if let task {
        VStack(alignment: .leading, spacing: 24) {
          VStack(alignment: .leading, spacing: 10) {
            Label(task.status.label, systemImage: task.status.symbol)
              .font(.subheadline.weight(.semibold))
              .foregroundStyle(task.status.color)
              .contentTransition(reduceMotion ? .opacity : .symbolEffect(.replace))
              .accessibilityIdentifier("task.status")
            Text(task.request).font(.title3.weight(.semibold)).textSelection(.enabled)
            Text("\(task.agent) · \(task.createdAt.formatted(date: .omitted, time: .shortened))")
              .font(.caption).foregroundStyle(.secondary)
          }
          Text(task.activity).font(.subheadline).foregroundStyle(.secondary)
          if task.status == .needsApproval, model.presentedTaskID == taskID {
            Button("Revisar pedido", systemImage: "hand.raised") { showApproval = true }
              .buttonStyle(.borderedProminent)
              .controlSize(.large)
              .buttonBorderShape(.capsule)
              .accessibilityIdentifier("approval.open")
              .transition(reduceMotion ? .opacity : .move(edge: .top).combined(with: .opacity))
          }
          if !task.response.isEmpty {
            Divider()
            VStack(alignment: .leading, spacing: 14) {
              Text(task.status == .completed ? "Resposta" : "Resposta até agora").font(.headline)
              Text(task.response).textSelection(.enabled)
              HStack {
                Button(copied ? "Copiado" : "Copiar", systemImage: copied ? "checkmark" : "doc.on.doc") {
                  UIPasteboard.general.string = task.response
                  copied = true
                }
                .contentTransition(reduceMotion ? .opacity : .symbolEffect(.replace))
                .sensoryFeedback(.success, trigger: copied)
                if task.status == .completed, !model.isPreview {
                  Button("Ouvir", systemImage: "speaker.wave.2") { model.speakResponse(task.response) }
                }
              }
              .font(.subheadline)
              .buttonStyle(.bordered)
              .buttonBorderShape(.capsule)
            }
            .transition(.opacity)
          }
          if task.status.isActive, model.canCancelTurn, model.presentedTaskID == taskID {
            Button("Cancelar tarefa", systemImage: "stop.circle", role: .destructive) {
              #if DEBUG && targetEnvironment(simulator)
              if model.isPreview { model.cancelPreview(); return }
              #endif
              Task { await model.cancelTurn() }
            }
            .padding(.top, 8)
            .accessibilityIdentifier("task.cancel")
          }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(24)
        .animation(reduceMotion ? nil : .smooth(duration: 0.3), value: task.status)
      } else {
        ContentUnavailableView("Tarefa indisponível", systemImage: "doc.questionmark", description: Text("Ela não está mais no histórico desta sessão."))
      }
    }
    .background(Color(uiColor: .systemGroupedBackground))
    .navigationTitle("Tarefa")
    .navigationBarTitleDisplayMode(.inline)
    .sheet(isPresented: $showApproval) { JarvisApprovalView(model: model, taskID: taskID) }
    .task(id: copied) {
      guard copied else { return }
      do {
        try await Task.sleep(for: .seconds(2))
        copied = false
      } catch {}
    }
  }
}

private struct JarvisApprovalView: View {
  @Bindable var model: SpikeViewModel
  let taskID: String
  @Environment(\.dismiss) private var dismiss
  @Environment(\.jarvisReduceMotion) private var reduceMotion

  var body: some View {
    NavigationStack {
      ScrollView {
        VStack(alignment: .leading, spacing: 22) {
          if model.presentedTaskID == taskID, !model.pendingApprovals.isEmpty {
            ForEach(model.pendingApprovals) { approval in
              VStack(alignment: .leading, spacing: 18) {
                Image(systemName: "hand.raised.fill")
                  .font(.largeTitle).foregroundStyle(.orange)
                Text(approval.title).font(.title2.bold())
                Text(approval.detail).font(.body).textSelection(.enabled)
                VStack(spacing: 10) {
                  Button("Permitir uma vez") { answer(approval, approved: true) }
                    .buttonStyle(.borderedProminent)
                  Button("Recusar", role: .destructive) { answer(approval, approved: false) }
                    .buttonStyle(.bordered)
                }
                .buttonBorderShape(.capsule)
                .controlSize(.large)
                .disabled(model.submittingApprovals.contains(approval.id))
                .frame(maxWidth: .infinity)
              }
              .frame(maxWidth: .infinity, alignment: .leading)
              .transition(reduceMotion ? .opacity : .scale(scale: 0.95).combined(with: .opacity))
            }
          } else {
            ContentUnavailableView("Nenhuma aprovação pendente", systemImage: "checkmark.shield", description: Text("O pedido foi respondido ou não está mais disponível."))
          }
        }
        .padding(24)
        .animation(reduceMotion ? nil : .smooth(duration: 0.3), value: model.pendingApprovals.map(\.id))
      }
      .navigationTitle("Sua aprovação")
      .navigationBarTitleDisplayMode(.inline)
      .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Fechar") { dismiss() } } }
    }
    .presentationDetents([.medium, .large])
    .presentationDragIndicator(.visible)
  }

  private func answer(_ approval: AgentApproval, approved: Bool) {
    Task {
      #if DEBUG && targetEnvironment(simulator)
      if model.isPreview {
        await model.resolvePreviewApproval(approved: approved)
        dismiss()
        return
      }
      #endif
      await model.answerApproval(approval, approved: approved)
      if model.pendingApprovals.isEmpty { dismiss() }
    }
  }
}
