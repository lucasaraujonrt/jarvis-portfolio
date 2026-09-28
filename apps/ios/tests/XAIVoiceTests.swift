import Foundation

@main struct XAIVoiceTests {
  static func main() throws {
    let samples: [Float] = [-1, -0.5, 0, 0.5, 1, .nan, .infinity]
    let restored = try XAIVoiceProtocol.decodePCM(XAIVoiceProtocol.encodePCM(samples))
    for index in 0..<5 { precondition(abs(restored[index] - samples[index]) < 0.0001) }
    precondition(restored[5] == 0 && restored[6] == 0)
    for invalid in [Data(), Data([0]), Data(repeating: 0, count: 10 * 1024 * 1024 + 2)] {
      do { _ = try XAIVoiceProtocol.decodePCM(invalid); fatalError("Invalid PCM accepted") }
      catch XAIVoiceError.invalidAudio {}
    }
    let decoded = try XAIVoiceProtocol.decodePCM(Data([0, 128, 255, 127]))
    precondition(decoded[0] == -1 && decoded[1] > 0.999)
    var output = XAIVoiceOutputState()
    output.begin("first")
    precondition(output.accepts("first"))
    output.interrupt()
    precondition(!output.accepts("first"))
    output.begin("second")
    precondition(!output.accepts("first") && output.accepts("second"))
    precondition(!output.finish("first", status: "completed").accepted)
    precondition(output.isGenerating)
    precondition(output.finish("second", status: "completed").completed)
    precondition(!output.isGenerating && output.accepts("second"))
    output.interrupt()
    precondition(!output.accepts("second"))
    output.begin("cancelled")
    output.interrupt()
    let cancelled = output.finish("cancelled", status: "cancelled")
    precondition(!cancelled.accepted && !cancelled.completed && !output.isGenerating)
    output.begin("next")
    let next = output.finish("next", status: "completed")
    precondition(next.accepted && next.completed && !output.isGenerating)
    precondition(!(output.isGenerating && output.accepts("next")), "Audio after response.done must be ignored")
    output.begin("cancelledWithoutInterruption")
    let cancelledWithoutInterruption = output.finish("cancelledWithoutInterruption", status: "cancelled")
    precondition(cancelledWithoutInterruption.accepted && !cancelledWithoutInterruption.completed)
    output.begin("failed")
    let failed = output.finish("failed", status: "failed")
    precondition(failed.accepted && !failed.completed)
    let config = XAIVoiceProtocol.configuration(inputRate: 16000)
    let data = try JSONSerialization.data(withJSONObject: config)
    let object = try JSONSerialization.jsonObject(with: data) as! [String: Any]
    let session = object["session"] as! [String: Any]
    precondition(session["voice"] as? String == "zagan")
    let audio = session["audio"] as! [String: Any]
    let input = audio["input"] as! [String: Any]
    let format = input["format"] as! [String: Any]
    precondition(format["rate"] as? Int == 16000)
    print("PASS: PCM clipping, byte order, invalid payloads, interrupted/stale responses, Zagan and HFP configuration")
  }
}
