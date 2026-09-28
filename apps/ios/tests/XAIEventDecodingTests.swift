import Foundation

@main struct XAIEventDecodingTests {
  static func main() {
    do {
      let fixture = URL(fileURLWithPath: CommandLine.arguments[1])
      let events = try JSONDecoder().decode([RealtimeEvent].self, from: Data(contentsOf: fixture))
      var output = XAIVoiceOutputState()
      var buffers = 0
      var completed = false
      for event in events {
        switch event.type {
        case "response.created": output.begin(event.response?.id)
        case "response.output_audio.delta":
          precondition(output.accepts(event.response_id))
          _ = try XAIVoiceProtocol.decodePCM(Data(base64Encoded: event.delta!)!)
          buffers += 1
        case "response.done":
          completed = output.finish(event.response?.id, status: event.response?.status).completed
        default: break
        }
      }
      precondition(completed && buffers > 0 && !output.isGenerating)
      let cases: [(String, String?)] = [
        (#"{"id":"r","status":"completed","status_details":"unimplemented"}"#, nil),
        (#"{"id":"r","status":"completed","status_details":null}"#, nil),
        (#"{"id":"r","status":"completed"}"#, nil),
        (#"{"id":"r","status":"failed","status_details":{"error":{"code":"upstream","message":"Service unavailable"}}}"#, "Service unavailable"),
        (#"{"id":"r","status":"failed","status_details":"Service unavailable"}"#, "Service unavailable"),
        (#"{"id":"r","status":"failed","status_details":"unimplemented"}"#, "A xAI não concluiu a resposta. Tente novamente."),
      ]
      for (json, expected) in cases {
        let response = try JSONDecoder().decode(RealtimeResponse.self, from: Data(json.utf8))
        precondition(response.failureDescription == expected)
      }
      do {
        _ = try JSONDecoder().decode(RealtimeResponse.self, from: Data(#"{"status_details":42}"#.utf8))
        fatalError("Malformed details must not be swallowed")
      } catch is DecodingError {}
      print("PASS: captured Zagan greeting decoded, audio accepted and response completed")
    } catch {
      print("FAIL:", error)
      exit(1)
    }
  }
}
