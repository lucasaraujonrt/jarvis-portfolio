import Foundation

final class VoiceProtocolStub: URLProtocol, @unchecked Sendable {
  nonisolated(unsafe) static var scenario = "valid"
  override class func canInit(with request: URLRequest) -> Bool { true }
  override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }
  override func stopLoading() {}
  override func startLoading() {
    precondition(request.httpMethod == "POST")
    precondition(request.value(forHTTPHeaderField: "Authorization") == "Bearer test-token")
    var headers = ["Content-Type": "audio/pcm", "X-Audio-Format": "pcm_s16le", "X-Audio-Sample-Rate": "16000", "X-Audio-Channels": "1"]
    var body = Data([0, 0, 255, 127])
    if request.url!.path.hasSuffix("session") {
      let expiry = Self.scenario == "expired" ? 1 : Date().timeIntervalSince1970 + 300
      let voice = Self.scenario == "wrongVoice" ? "eve" : "zagan"
      body = Data("{\"value\":\"ephemeral\",\"expires_at\":\(expiry),\"voice\":\"\(voice)\"}".utf8)
      headers = ["Content-Type": "application/json"]
    }
    if Self.scenario == "wrongRate" { headers["X-Audio-Sample-Rate"] = "24000" }
    if Self.scenario == "oddPCM" { body = Data([0]) }
    let response = HTTPURLResponse(url: request.url!, statusCode: Self.scenario == "unauthorized" ? 401 : 200, httpVersion: nil, headerFields: headers)!
    client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
    client?.urlProtocol(self, didLoad: body)
    client?.urlProtocolDidFinishLoading(self)
  }
}

@main struct XAIGatewayTests {
  static func main() async throws {
    let config = URLSessionConfiguration.ephemeral
    config.protocolClasses = [VoiceProtocolStub.self]
    let session = URLSession(configuration: config)
    defer { session.invalidateAndCancel() }
    let url = URL(string: "http://test.local")!
    let credential = try await GatewayClient.voiceSession(baseURL: url, token: "test-token", session: session)
    precondition(credential.voice == "zagan")
    let audio = try await GatewayClient.speakXAI(baseURL: url, token: "test-token", text: "Olá", session: session)
    precondition(audio.count == 4)
    for scenario in ["expired", "wrongVoice", "unauthorized"] {
      VoiceProtocolStub.scenario = scenario
      do { _ = try await GatewayClient.voiceSession(baseURL: url, token: "test-token", session: session); fatalError("Invalid credential accepted") }
      catch {}
    }
    for scenario in ["wrongRate", "oddPCM", "unauthorized"] {
      VoiceProtocolStub.scenario = scenario
      do { _ = try await GatewayClient.speakXAI(baseURL: url, token: "test-token", text: "Olá", session: session); fatalError("Invalid audio accepted") }
      catch {}
    }
    print("PASS: authenticated voice requests, ephemeral expiry, Zagan selection, PCM format/rate and HTTP failures")
  }
}
