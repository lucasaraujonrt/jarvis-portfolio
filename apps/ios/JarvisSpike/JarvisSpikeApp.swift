import MWDATCore
import SwiftUI

@main
struct JarvisSpikeApp: App {
  @State private var model: SpikeViewModel

  init() {
    #if DEBUG && targetEnvironment(simulator)
    if !ProcessInfo.processInfo.arguments.contains("--live-gateway") {
      let preview = SpikeViewModel(wearables: nil, startupError: nil, preview: true)
      preview.loadPreview(.ready)
      _model = State(initialValue: preview)
      return
    }
    #endif
    let startupError: String?
    let wearables: WearablesInterface?
    do {
      try Wearables.configure()
      startupError = nil
      wearables = Wearables.shared
    } catch {
      startupError = error.localizedDescription
      wearables = nil
    }
    _model = State(
      initialValue: SpikeViewModel(
        wearables: wearables,
        startupError: startupError
      )
    )
  }

  var body: some Scene {
    WindowGroup {
      ContentView(model: model)
        .onOpenURL { url in
          Task { await model.handleDATURL(url) }
        }
    }
  }
}
