import Foundation

enum TerminalAgent: String, CaseIterable, Identifiable {
  case codex, claude, grok
  var id: String { rawValue }
  var label: String {
    switch self {
    case .codex: "Codex"
    case .claude: "Claude Code"
    case .grok: "Grok Code"
    }
  }
}

struct AgentApproval: Identifiable, Decodable {
  let id: String
  let title: String
  let detail: String
}

struct GatewayTurnSnapshot: Decodable {
  let requestId: String
  let status: String
  let text: String
  let activity: String
  let approvals: [AgentApproval]
  let error: String?
}

enum GatewayClient {
  @MainActor
  static func performTurn(
    baseURL: URL,
    token: String,
    requestId: String,
    agent: TerminalAgent,
    message: String,
    jpegData: Data?,
    session: URLSession = .shared,
    onSnapshot: (GatewayTurnSnapshot) -> Void,
    onReconnecting: () -> Void
  ) async throws -> String {
    var request = makeRequest(baseURL: baseURL, token: token, path: "v1/turn/start")
    request.httpBody = try JSONEncoder().encode(TurnRequest(
      requestId: requestId, agent: agent.rawValue, message: message,
      imageDataUrl: jpegData.map { "data:image/jpeg;base64,\($0.base64EncodedString())" }
    ))
    let deadline = Date().addingTimeInterval(15 * 60)
    do {
      let (_, response) = try await session.data(for: request)
      try validate(response)
    } catch {
      guard isRecoverable(error) else { throw error }
      onReconnecting()
    }
    var missingSince: Date?
    while true {
      try Task.checkCancellation()
      do {
        let snapshot = try await turnStatus(baseURL: baseURL, token: token, requestId: requestId, session: session)
        missingSince = nil
        guard snapshot.requestId == requestId else { throw GatewayError.protocolMismatch }
        onSnapshot(snapshot)
        switch snapshot.status {
        case "completed": return snapshot.text
        case "failed": throw GatewayError.remote(snapshot.error ?? "agent_failed")
        case "running": break
        default: throw GatewayError.protocolMismatch
        }
      } catch {
        if case GatewayError.http(404) = error {
          missingSince = missingSince ?? Date()
          if Date().timeIntervalSince(missingSince!) > 15 { throw GatewayError.unknownTurn }
        } else if !isRecoverable(error) { throw error }
        onReconnecting()
      }
      if Date() > deadline { throw GatewayError.incomplete }
      try await Task.sleep(for: .seconds(1))
    }
  }

  static func turnStatus(baseURL: URL, token: String, requestId: String, session: URLSession = .shared) async throws -> GatewayTurnSnapshot {
    var components = URLComponents(url: baseURL.appending(path: "v1/turn/status"), resolvingAgainstBaseURL: false)!
    components.queryItems = [URLQueryItem(name: "requestId", value: requestId)]
    var request = makeRequest(baseURL: baseURL, token: token, path: "v1/turn/status")
    request.url = components.url
    request.httpMethod = "GET"
    let (data, response) = try await session.data(for: request)
    try validate(response)
    return try JSONDecoder().decode(GatewayTurnSnapshot.self, from: data)
  }

  private static func isRecoverable(_ error: Error) -> Bool {
    if let network = error as? URLError {
      return [.timedOut, .networkConnectionLost, .notConnectedToInternet, .cannotConnectToHost, .cannotFindHost, .dnsLookupFailed].contains(network.code)
    }
    if case GatewayError.http(let status) = error { return status >= 500 }
    return false
  }

  static func approve(baseURL: URL, token: String, requestId: String, approvalId: String, approved: Bool) async throws {
    var request = makeRequest(baseURL: baseURL, token: token, path: "v1/approval")
    request.httpBody = try JSONEncoder().encode(ApprovalRequest(requestId: requestId, approvalId: approvalId, approved: approved))
    let (_, response) = try await URLSession.shared.data(for: request)
    try validate(response)
  }

  static func cancel(baseURL: URL, token: String, requestId: String) async throws {
    var request = makeRequest(baseURL: baseURL, token: token, path: "v1/turn/cancel")
    request.httpBody = try JSONEncoder().encode(["requestId": requestId])
    let (_, response) = try await URLSession.shared.data(for: request)
    try validate(response)
  }

  static func voiceSession(baseURL: URL, token: String, session: URLSession = .shared) async throws -> XAICredential {
    var request = makeRequest(baseURL: baseURL, token: token, path: "v1/voice/session")
    request.httpBody = Data("{}".utf8)
    let (data, response) = try await session.data(for: request)
    try validate(response)
    let credential = try JSONDecoder().decode(XAICredential.self, from: data)
    guard !credential.value.isEmpty, credential.expires_at > Date().timeIntervalSince1970,
      credential.voice == "zagan" else { throw GatewayError.invalidAudioContract }
    return credential
  }

  static func speakXAI(baseURL: URL, token: String, text: String, session: URLSession = .shared) async throws -> Data {
    var request = makeRequest(baseURL: baseURL, token: token, path: "v1/speak")
    request.timeoutInterval = 40
    request.httpBody = try JSONEncoder().encode(["text": text])
    let (data, response) = try await session.data(for: request)
    try validate(response)
    guard let http = response as? HTTPURLResponse,
      http.value(forHTTPHeaderField: "Content-Type") == "audio/pcm",
      http.value(forHTTPHeaderField: "X-Audio-Format") == "pcm_s16le",
      http.value(forHTTPHeaderField: "X-Audio-Sample-Rate") == "16000",
      http.value(forHTTPHeaderField: "X-Audio-Channels") == "1",
      !data.isEmpty, data.count.isMultiple(of: 2), data.count <= 10 * 1024 * 1024
    else { throw GatewayError.invalidAudioContract }
    return data
  }

  private static func makeRequest(baseURL: URL, token: String, path: String) -> URLRequest {
    var request = URLRequest(url: baseURL.appending(path: path))
    request.httpMethod = "POST"
    request.timeoutInterval = 15
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
    return request
  }

  private static func validate(_ response: URLResponse) throws {
    guard let http = response as? HTTPURLResponse, http.statusCode == 200 else {
      throw GatewayError.http((response as? HTTPURLResponse)?.statusCode ?? 0)
    }
  }
}

private struct TurnRequest: Encodable {
  let requestId: String
  let agent: String
  let message: String
  let imageDataUrl: String?
}

private struct ApprovalRequest: Encodable {
  let requestId: String
  let approvalId: String
  let approved: Bool
}

private enum GatewayError: LocalizedError {
  case http(Int)
  case remote(String)
  case incomplete
  case invalidAudioContract
  case protocolMismatch
  case unknownTurn

  var errorDescription: String? {
    switch self {
    case .http(let status): "Gateway respondeu HTTP \(status). Confira conexão, token e tarefa ativa."
    case .remote(let code): "O agente encerrou a tarefa: \(code). Confira o CLI e o login no Mac."
    case .incomplete: "A conexão terminou sem confirmar o resultado. Confira os arquivos antes de reenviar."
    case .unknownTurn: "O gateway não encontrou esta tarefa. Ela pode ter sido perdida após um reinício. Confira os arquivos antes de reenviar."
    case .invalidAudioContract: "O gateway não confirmou o contrato de voz xAI Zagan. Atualize o gateway no Mac."
    case .protocolMismatch: "Gateway incompatível: identificador da tarefa não confere."
    }
  }
}

struct XAICredential: Decodable {
  let value: String
  let expires_at: Double
  let voice: String
}
