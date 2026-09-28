import Foundation

enum XAIVoiceProtocol {
  static let voice = "zagan"
  static let outputRate = 16_000

  static func configuration(inputRate: Int) -> [String: Any] {
    ["type": "session.update", "session": [
      "voice": voice,
      "instructions": """
      Você é Jarvis, assistente pessoal do usuário. Converse em português brasileiro, de forma natural e breve.
      Para realizar ações, consultar ou alterar arquivos e executar tarefas no Mac, use executar_tarefa.
      Não afirme que executou algo antes de receber o resultado. O app mostra aprovações ao usuário; nunca aprove por ele.
      Encaminhe o pedido completo, incluindo o contexto necessário, sem inventar informações.
      """,
      "turn_detection": ["type": "server_vad", "threshold": 0.65, "silence_duration_ms": 1000],
      "audio": [
        "input": ["format": ["type": "audio/pcm", "rate": inputRate], "transcription": ["language_hint": "pt-BR"]],
        "output": ["format": ["type": "audio/pcm", "rate": outputRate]],
      ],
      "tools": [[
        "type": "function", "name": "executar_tarefa",
        "description": "Executa um pedido no agente selecionado pelo usuário no Mac. Preserva aprovações humanas.",
        "parameters": ["type": "object", "properties": ["pedido": ["type": "string"]], "required": ["pedido"], "additionalProperties": false],
      ]],
    ]]
  }

  static func decodePCM(_ data: Data) throws -> [Float] {
    guard !data.isEmpty, data.count.isMultiple(of: 2), data.count <= 10 * 1024 * 1024 else {
      throw XAIVoiceError.invalidAudio
    }
    let bytes = [UInt8](data)
    return stride(from: 0, to: bytes.count, by: 2).map {
      Float(Int16(bitPattern: UInt16(bytes[$0]) | UInt16(bytes[$0 + 1]) << 8)) / 32768
    }
  }

  static func encodePCM(_ samples: [Float]) -> Data {
    var data = Data(capacity: samples.count * 2)
    for sample in samples {
      let value = sample.isFinite ? min(1, max(-1, sample)) : 0
      let bits = UInt16(bitPattern: Int16((value * 32767).rounded()))
      data.append(UInt8(truncatingIfNeeded: bits))
      data.append(UInt8(truncatingIfNeeded: bits >> 8))
    }
    return data
  }
}

enum XAIVoiceError: LocalizedError {
  case invalidAudio
  case unavailable(String)
  case disconnected

  var errorDescription: String? {
    switch self {
    case .invalidAudio: "A xAI devolveu áudio inválido."
    case .unavailable(let detail): "Voz xAI indisponível: \(detail)"
    case .disconnected: "A conversa xAI foi desconectada. Ative novamente para continuar."
    }
  }
}

struct XAIVoiceOutputState {
  private(set) var responseID: String?
  private(set) var isGenerating = false
  private var interrupted = false

  mutating func begin(_ id: String?) {
    responseID = id
    isGenerating = true
    interrupted = false
  }

  mutating func interrupt() { interrupted = true }

  mutating func finish(_ id: String?, status: String?) -> (accepted: Bool, completed: Bool) {
    let accepted = isGenerating && accepts(id)
    if id == responseID { isGenerating = false }
    return (accepted, accepted && status == "completed")
  }

  func accepts(_ id: String?) -> Bool {
    !interrupted && id == responseID
  }
}

struct RealtimeEvent: Decodable {
  let type: String
  var response_id: String?
  var delta: String?
  var transcript: String?
  var error: RealtimeAPIError?
  var response: RealtimeResponse?
}

struct RealtimeAPIError: Decodable {
  var message: String?
  var code: String?
}

struct RealtimeResponse: Decodable {
  var id: String?
  var status: String?
  var output: [RealtimeItem]?
  var status_details: RealtimeStatusDetails?

  var failureDescription: String? {
    if let error = status_details?.error { return error.message ?? error.code ?? "Falha na resposta xAI." }
    guard status == "failed" || status == "incomplete" else { return nil }
    return status_details?.message ?? "A xAI não concluiu a resposta. Tente novamente."
  }
}

struct RealtimeStatusDetails: Decodable {
  let error: RealtimeAPIError?
  let message: String?

  private enum CodingKeys: String, CodingKey { case error }

  init(from decoder: Decoder) throws {
    let value = try decoder.singleValueContainer()
    if let text = try? value.decode(String.self) {
      error = nil
      message = text == "unimplemented" || text.isEmpty ? nil : text
    } else {
      let container = try decoder.container(keyedBy: CodingKeys.self)
      error = try container.decodeIfPresent(RealtimeAPIError.self, forKey: .error)
      message = nil
    }
  }
}
struct RealtimeItem: Decodable {
  var type: String?
  var name: String?
  var call_id: String?
  var arguments: String?
}
