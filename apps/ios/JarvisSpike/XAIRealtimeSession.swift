import Foundation
import Observation

@Observable
@MainActor
final class XAIRealtimeSession {
  private(set) var isActive = false
  private(set) var isConnected = false
  private(set) var transcript = ""
  private(set) var responseText = ""
  private(set) var status = "Pronta · Zagan"
  let audio = XAIAudio()
  var executeTask: ((String) async -> String)?
  var onResponse: ((String, String) -> Void)?

  @ObservationIgnored private var socket: URLSessionWebSocketTask?
  @ObservationIgnored private var sender: Task<Void, Never>?
  @ObservationIgnored private var connectionID = UUID()
  @ObservationIgnored private var outputState = XAIVoiceOutputState()
  @ObservationIgnored private var isExecutingTool = false
  @ObservationIgnored private var seenCalls: Set<String> = []

  func run(baseURL: URL, token: String) async throws {
    stop()
    let id = connectionID
    isActive = true
    status = "Conectando à xAI…"
    defer { if connectionID == id { stop() } }
    let credential = try await GatewayClient.voiceSession(baseURL: baseURL, token: token)
    try Task.checkCancellation()
    guard connectionID == id else { return }
    try audio.prepare()
    var request = URLRequest(url: URL(string: "wss://api.x.ai/v1/realtime?model=grok-voice-latest")!)
    request.setValue("Bearer \(credential.value)", forHTTPHeaderField: "Authorization")
    let ws = URLSession.shared.webSocketTask(with: request)
    ws.maximumMessageSize = 4 * 1024 * 1024
    socket = ws
    ws.resume()
    audio.onFailure = { [weak self] message in
      self?.status = message
      self?.socket?.cancel(with: .goingAway, reason: nil)
    }
    try await send(XAIVoiceProtocol.configuration(inputRate: audio.inputRate))
    while connectionID == id, !Task.isCancelled {
      let message = try await ws.receive()
      try Task.checkCancellation()
      guard connectionID == id else { return }
      let data: Data
      switch message {
      case .data(let bytes): data = bytes
      case .string(let text): data = Data(text.utf8)
      @unknown default: continue
      }
      let event: RealtimeEvent
      do { event = try JSONDecoder().decode(RealtimeEvent.self, from: data) }
      catch let error as DecodingError {
        throw XAIVoiceError.unavailable(Self.decodingFailure(error))
      }
      switch event.type {
      case "session.updated":
        guard !isConnected else { continue }
        isConnected = true
        status = "Ao vivo · Zagan"
        try startMicrophone(id: id)
        try await send(["type": "conversation.item.create", "item": [
          "type": "force_message", "role": "assistant", "interruptible": false,
          "content": [["type": "output_text", "text": "Sim?"]],
        ]])
      case "input_audio_buffer.speech_started":
        audio.stopOutput()
        outputState.interrupt()
        transcript = ""
        status = "Ouvindo você · Zagan"
      case "conversation.item.input_audio_transcription.completed":
        transcript = event.transcript ?? ""
      case "response.created":
        outputState.begin(event.response?.id)
        responseText = ""
        status = "Respondendo · Zagan"
      case "response.output_audio.delta", "response.audio.delta":
        if outputState.isGenerating, outputState.accepts(event.response_id),
          let delta = event.delta, let pcm = Data(base64Encoded: delta) { try audio.enqueue(pcm) }
      case "response.output_audio_transcript.delta", "response.audio_transcript.delta":
        if outputState.isGenerating, outputState.accepts(event.response_id) { responseText += event.delta ?? "" }
      case "response.done":
        let result = outputState.finish(event.response?.id, status: event.response?.status)
        guard result.accepted else { break }
        if let detail = event.response?.failureDescription { throw XAIVoiceError.unavailable(detail) }
        guard result.completed else {
          status = isExecutingTool ? "Executando no Mac…" : "Ao vivo · Zagan"
          break
        }
        let calls = (event.response?.output ?? []).filter { $0.type == "function_call" }
        if !calls.isEmpty {
          guard !isExecutingTool else { throw XAIVoiceError.unavailable("Outra tarefa de voz está em andamento.") }
          isExecutingTool = true
          Task { [weak self] in
            guard let self else { return }
            defer { if connectionID == id { isExecutingTool = false } }
            do {
              for call in calls {
                guard let callID = call.call_id, seenCalls.insert(callID).inserted else { continue }
                let arguments = call.arguments.flatMap { try? JSONDecoder().decode(TaskArguments.self, from: Data($0.utf8)) }
                let result: String
                if call.name == "executar_tarefa", let arguments,
                  !arguments.pedido.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
                  arguments.pedido.count <= 8000, let executeTask {
                  status = "Executando no Mac…"
                  result = await executeTask(arguments.pedido)
                } else { result = "Pedido inválido. Nenhuma tarefa executada." }
                guard connectionID == id else { return }
                try await send(["type": "conversation.item.create", "item": [
                  "type": "function_call_output", "call_id": callID, "output": result,
                ]])
              }
              while audio.isSpeaking, connectionID == id { try await Task.sleep(for: .milliseconds(50)) }
              guard connectionID == id else { return }
              try await send(["type": "response.create"])
            } catch { if connectionID == id { socket?.cancel(with: .goingAway, reason: nil) } }
          }
        } else {
          if !responseText.isEmpty, !isExecutingTool { onResponse?(transcript, responseText) }
          status = isExecutingTool ? "Executando no Mac…" : "Ao vivo · Zagan"
        }
      case "error" where event.error?.code == "response_cancel_not_active": break
      case "error": throw XAIVoiceError.unavailable(event.error?.message ?? "erro de conexão")
      default: break
      }
    }
  }

  func say(_ text: String) {
    let id = connectionID
    Task { [weak self] in
      guard let self, connectionID == id else { return }
      do {
        while audio.isSpeaking, connectionID == id { try await Task.sleep(for: .milliseconds(50)) }
        guard connectionID == id else { return }
        try await send(["type": "conversation.item.create", "item": [
          "type": "force_message", "role": "assistant",
          "content": [["type": "output_text", "text": text]],
        ]])
      } catch { if connectionID == id { socket?.cancel(with: .goingAway, reason: nil) } }
    }
  }

  func interruptResponse() {
    let shouldCancel = outputState.isGenerating
    outputState.interrupt()
    audio.stopOutput()
    guard shouldCancel else { return }
    let ws = socket
    Task { try? await ws?.send(.string("{\"type\":\"response.cancel\"}")) }
  }

  func stop() {
    connectionID = UUID()
    sender?.cancel()
    sender = nil
    socket?.cancel(with: .normalClosure, reason: nil)
    socket = nil
    audio.stop()
    audio.onFailure = nil
    isActive = false
    isConnected = false
    seenCalls = []
    isExecutingTool = false
    outputState = XAIVoiceOutputState()
    status = "Pronta · Zagan"
  }

  private func startMicrophone(id: UUID) throws {
    let (stream, continuation) = AsyncStream<Data>.makeStream(bufferingPolicy: .bufferingNewest(16))
    guard let ws = socket else { throw XAIVoiceError.disconnected }
    sender = Task { [weak self] in
      defer { continuation.finish() }
      do {
        for await data in stream {
          try Task.checkCancellation()
          guard self?.connectionID == id else { return }
          if self?.isExecutingTool == true { continue }
          let message = try JSONSerialization.data(withJSONObject: ["type": "input_audio_buffer.append", "audio": data.base64EncodedString()])
          try await ws.send(.string(String(decoding: message, as: UTF8.self)))
        }
      } catch {
        if self?.connectionID == id { ws.cancel(with: .goingAway, reason: nil) }
      }
    }
    try audio.startCapture { data in continuation.yield(data) }
  }

  private static func decodingFailure(_ error: DecodingError) -> String {
    let path: [CodingKey]
    switch error {
    case .typeMismatch(_, let context), .valueNotFound(_, let context), .dataCorrupted(let context): path = context.codingPath
    case .keyNotFound(let key, let context): path = context.codingPath + [key]
    @unknown default: path = []
    }
    let field = path.map(\.stringValue).joined(separator: ".")
    return field.isEmpty ? "A resposta da conexão não contém JSON válido." : "Formato inesperado no campo \(field) da conexão."
  }

  private func send(_ event: [String: Any]) async throws {
    guard let socket else { throw XAIVoiceError.disconnected }
    let data = try JSONSerialization.data(withJSONObject: event)
    try await socket.send(.string(String(decoding: data, as: UTF8.self)))
  }
}

private struct TaskArguments: Decodable { let pedido: String }
