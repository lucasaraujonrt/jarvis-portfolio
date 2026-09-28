import Foundation

enum JarvisTaskStatus: String, Equatable {
  case running, needsApproval, reconnecting, completed, failed, cancelled

  var isActive: Bool {
    switch self {
    case .running, .needsApproval, .reconnecting: true
    case .completed, .failed, .cancelled: false
    }
  }

  var label: String {
    switch self {
    case .running: "Em andamento"
    case .needsApproval: "Sua aprovação"
    case .reconnecting: "Reconectando"
    case .completed: "Concluída"
    case .failed: "Não concluída"
    case .cancelled: "Cancelada"
    }
  }

  var symbol: String {
    switch self {
    case .running: "ellipsis"
    case .needsApproval: "hand.raised.fill"
    case .reconnecting: "wifi.slash"
    case .completed: "checkmark.circle.fill"
    case .failed: "exclamationmark.circle.fill"
    case .cancelled: "stop.circle"
    }
  }
}

struct JarvisTask: Identifiable, Equatable {
  let id: String
  let request: String
  let agent: String
  let createdAt: Date
  var status: JarvisTaskStatus = .running
  var activity = "Conectando ao agente…"
  var response = ""

  var title: String {
    let line = request.split(separator: "\n").first.map(String.init) ?? request
    return line.count > 70 ? String(line.prefix(67)) + "…" : line
  }
}

struct JarvisTaskHistory {
  private(set) var entries: [JarvisTask] = []

  mutating func start(id: String, request: String, agent: String, date: Date = .now) {
    guard !entries.contains(where: { $0.id == id }) else { return }
    entries.insert(JarvisTask(id: id, request: request, agent: agent, createdAt: date), at: 0)
    if entries.count > 50 { entries.removeLast(entries.count - 50) }
  }

  mutating func update(id: String, status: JarvisTaskStatus, activity: String, response: String? = nil) {
    guard let index = entries.firstIndex(where: { $0.id == id }), entries[index].status.isActive else { return }
    entries[index].status = status
    entries[index].activity = activity
    if let response { entries[index].response = response }
  }
}
