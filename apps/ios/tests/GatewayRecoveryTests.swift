import Foundation

final class RecoveryProtocol: URLProtocol, @unchecked Sendable {
  static let lock = NSLock()
  nonisolated(unsafe) static var starts = 0
  nonisolated(unsafe) static var polls = 0
  nonisolated(unsafe) static var unauthorized = false

  override class func canInit(with request: URLRequest) -> Bool { true }
  override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }
  override func stopLoading() {}

  override func startLoading() {
    Self.lock.lock()
    defer { Self.lock.unlock() }
    guard request.value(forHTTPHeaderField: "Authorization") == "Bearer test-token" else { fatalError("Missing auth") }
    if request.httpMethod == "POST" {
      Self.starts += 1
      if Self.unauthorized { respond(status: 401, body: "{}"); return }
      client?.urlProtocol(self, didFailWithError: URLError(.networkConnectionLost))
      return
    }
    Self.polls += 1
    if Self.polls == 2 {
      client?.urlProtocol(self, didFailWithError: URLError(.notConnectedToInternet))
      return
    }
    let complete = Self.polls >= 4
    let approval = Self.polls == 1 ? #"[{"id":"permission","title":"Write","detail":"briefing.md"}]"# : "[]"
    respond(status: 200, body: """
      {"requestId":"test-request","status":"\(complete ? "completed" : "running")","text":"\(complete ? "final" : "partial")","activity":"working","approvals":\(approval)}
      """)
  }

  private func respond(status: Int, body: String) {
    client?.urlProtocol(self, didReceive: HTTPURLResponse(url: request.url!, statusCode: status, httpVersion: nil, headerFields: ["Content-Type": "application/json"])!, cacheStoragePolicy: .notAllowed)
    client?.urlProtocol(self, didLoad: Data(body.utf8))
    client?.urlProtocolDidFinishLoading(self)
  }
}

@main struct GatewayRecoveryTests {
  @MainActor static func main() async throws {
    let configuration = URLSessionConfiguration.ephemeral
    configuration.protocolClasses = [RecoveryProtocol.self]
    let session = URLSession(configuration: configuration)
    defer { session.invalidateAndCancel() }
    var reconnects = 0
    var snapshots: [GatewayTurnSnapshot] = []
    let text = try await GatewayClient.performTurn(baseURL: URL(string: "http://test.local")!, token: "test-token", requestId: "test-request", agent: .codex, message: "test", jpegData: nil, session: session, onSnapshot: { snapshots.append($0) }, onReconnecting: { reconnects += 1 })
    precondition(text == "final")
    precondition(RecoveryProtocol.starts == 1, "Must never resend a task after an uncertain response")
    precondition(reconnects == 2)
    precondition(snapshots.first?.approvals.count == 1)
    precondition(snapshots.last?.approvals.isEmpty == true)
    precondition(snapshots.last?.status == "completed")
    RecoveryProtocol.unauthorized = true
    let previousPolls = RecoveryProtocol.polls
    do {
      _ = try await GatewayClient.performTurn(baseURL: URL(string: "http://test.local")!, token: "test-token", requestId: "test-request", agent: .codex, message: "test", jpegData: nil, session: session, onSnapshot: { _ in }, onReconnecting: { fatalError("Auth failure must not retry") })
      fatalError("Expected authorization failure")
    } catch {
      precondition(RecoveryProtocol.polls == previousPolls)
    }
    print("PASS: uncertain start, network recovery, current approvals, final result and auth failure")
  }
}
