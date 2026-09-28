import SwiftUI

struct JarvisHomeView: View {
  @Bindable var model: SpikeViewModel
  let showConnections: () -> Void
  let showAllTasks: () -> Void
  @Environment(\.jarvisReduceMotion) private var reduceMotion

  private var currentTask: JarvisTask? { model.taskHistory.entries.first { $0.status.isActive } }
  private var completedCount: Int { model.taskHistory.entries.filter { $0.status == .completed }.count }

  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 26) {
        contextLabel
        JarvisVoiceView(model: model, showConnections: showConnections)
          .frame(maxWidth: .infinity)
        currentSection
        recentSection
      }
      .padding(.horizontal, 22)
      .padding(.top, 4)
      .padding(.bottom, 28)
      .animation(reduceMotion ? nil : .spring(response: 0.44, dampingFraction: 0.88), value: currentTask?.status)
      .animation(reduceMotion ? nil : .spring(response: 0.4, dampingFraction: 0.88), value: model.taskHistory.entries.map(\.id))
    }
    .background(Color(uiColor: .systemGroupedBackground))
    .onChange(of: completedCount) { old, new in
      if new > old { UINotificationFeedbackGenerator().notificationOccurred(.success) }
    }
    .onChange(of: currentTask?.status) { old, new in
      if new == JarvisTaskStatus.needsApproval, old != new {
        UINotificationFeedbackGenerator().notificationOccurred(.warning)
      }
    }
  }

  private var contextLabel: some View {
    HStack(spacing: 6) {
      Image(systemName: "terminal")
      Text(model.selectedAgent.label)
      Text("·")
      Text("Seu Mac")
    }
    .font(.subheadline)
    .foregroundStyle(.secondary)
  }

  @ViewBuilder
  private var currentSection: some View {
    if let currentTask {
      VStack(alignment: .leading, spacing: 12) {
        Text(currentTask.status == .needsApproval ? "Precisa de você" : "Tarefa atual")
          .font(.title2.bold())
        NavigationLink(value: currentTask.id) {
          JarvisCurrentTaskView(task: currentTask)
        }
        .buttonStyle(JarvisPressStyle())
        .accessibilityIdentifier("task.current")
      }
      .transition(reduceMotion ? .opacity : .move(edge: .top).combined(with: .opacity))
    }
  }

  @ViewBuilder
  private var recentSection: some View {
    if model.taskHistory.entries.isEmpty {
      ContentUnavailableView {
        Label("Sua primeira tarefa", systemImage: "sparkles")
      } description: {
        Text("Peça algo ao Jarvis. O andamento e a resposta aparecem aqui.")
      }
      .frame(maxWidth: .infinity)
    } else if !recentTasks.isEmpty {
      VStack(alignment: .leading, spacing: 12) {
        HStack {
          Text("Recentes").font(.title2.bold())
          Spacer()
          Button("Ver todas", action: showAllTasks)
            .font(.subheadline)
            .frame(minHeight: 44)
            .accessibilityIdentifier("tasks.showAll")
        }
        VStack(spacing: 0) {
          ForEach(recentTasks) { task in
            if task.id != recentTasks.first?.id { Divider().padding(.leading, 52) }
            NavigationLink(value: task.id) {
              JarvisTaskRow(task: task)
            }
            .buttonStyle(JarvisPressStyle())
          }
        }
        .background(Color(uiColor: .secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 22))
      }
      .transition(.opacity)
    }
  }

  private var recentTasks: [JarvisTask] {
    Array(model.taskHistory.entries.filter { !$0.status.isActive }.prefix(3))
  }
}

struct JarvisPressStyle: ButtonStyle {
  @Environment(\.jarvisReduceMotion) private var reduceMotion

  func makeBody(configuration: Configuration) -> some View {
    configuration.label
      .contentShape(Rectangle())
      .scaleEffect(configuration.isPressed && !reduceMotion ? 0.98 : 1)
      .opacity(configuration.isPressed ? 0.78 : 1)
      .animation(reduceMotion ? nil : .spring(response: 0.25, dampingFraction: 0.8), value: configuration.isPressed)
  }
}

private struct JarvisReduceMotionKey: EnvironmentKey {
  static let defaultValue = false
}

extension EnvironmentValues {
  var jarvisReduceMotion: Bool {
    get { self[JarvisReduceMotionKey.self] }
    set { self[JarvisReduceMotionKey.self] = newValue }
  }
}
