import SwiftUI

struct ContentView: View {
  @Bindable var model: SpikeViewModel
  @Environment(\.accessibilityReduceMotion) private var systemReduceMotion
  @Environment(\.dynamicTypeSize) private var systemTypeSize
  @State private var selectedTab = 0
  @State private var showConnections = false
  @State private var previewDark = false
  @State private var previewLargeText = false
  @State private var previewReduceMotion = false

  var body: some View {
    TabView(selection: $selectedTab) {
      NavigationStack {
        JarvisHomeView(model: model, showConnections: { showConnections = true }, showAllTasks: { selectedTab = 1 })
          .navigationTitle("Jarvis")
          .toolbar { toolbar }
          .navigationDestination(for: String.self) { id in
            JarvisTaskDetailView(model: model, taskID: id)
          }
      }
      .tabItem { Label("Jarvis", systemImage: "waveform") }
      .tag(0)

      NavigationStack {
        JarvisTaskListView(model: model)
          .navigationTitle("Tarefas")
          .toolbar { toolbar }
          .navigationDestination(for: String.self) { id in
            JarvisTaskDetailView(model: model, taskID: id)
          }
      }
      .tabItem { Label("Tarefas", systemImage: "checklist") }
      .tag(1)
    }
    .tint(.blue)
    .environment(\.jarvisReduceMotion, systemReduceMotion || previewReduceMotion)
    .environment(\.dynamicTypeSize, previewLargeText ? .accessibility2 : systemTypeSize)
    .preferredColorScheme(model.isPreview ? (previewDark ? .dark : .light) : nil)
    .sensoryFeedback(.selection, trigger: selectedTab)
    .sheet(isPresented: $showConnections) {
      JarvisConnectionsView(model: model)
    }
    .alert("Não foi possível continuar", isPresented: $model.showError) {
      Button("OK", role: .cancel) {}
    } message: {
      Text(model.errorMessage)
    }
    .task {
      if !model.isPreview { model.audio.refreshRoute() }
    }
  }

  @ToolbarContentBuilder
  private var toolbar: some ToolbarContent {
    #if DEBUG && targetEnvironment(simulator)
    if model.isPreview {
      ToolbarItem(placement: .topBarLeading) {
        Menu {
          Menu("Cenário", systemImage: "play.rectangle") {
            ForEach(JarvisPreviewScenario.allCases) { scenario in
              Button(scenario.rawValue, systemImage: scenario.symbol) {
                model.loadPreview(scenario)
              }
            }
          }
          Section("Acessibilidade e aparência") {
            Toggle("Modo escuro", isOn: $previewDark)
            Toggle("Texto ampliado", isOn: $previewLargeText)
            Toggle("Reduzir animações", isOn: $previewReduceMotion)
          }
          Menu("Voz de teste", systemImage: "waveform") {
            ForEach(VoicePreviewPreset.allCases) { preset in
              Button(preset.rawValue) { model.loadVoicePreview(preset) }
            }
          }
        } label: {
          Text("Prévia")
            .font(.subheadline)
        }
        .accessibilityIdentifier("preview.scenarios")
      }
    }
    #endif
    ToolbarItem(placement: .topBarTrailing) {
      Button("Conexões", systemImage: "laptopcomputer") { showConnections = true }
        .accessibilityIdentifier("connections.open")
    }
  }
}
