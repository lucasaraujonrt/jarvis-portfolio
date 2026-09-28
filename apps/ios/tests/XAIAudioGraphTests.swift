import AVFoundation
import Foundation

@main struct XAIAudioGraphTests {
  static func main() throws {
    let sourceRate = XAIVoiceProtocol.outputRate
    let source = (0..<(sourceRate / 4)).map { Float(sin(2 * Double.pi * 800 * Double($0) / Double(sourceRate))) * 0.5 }
    let samples = try XAIVoiceProtocol.decodePCM(XAIVoiceProtocol.encodePCM(source))
    for outputRate in [16000.0, 48000.0] {
      for _ in 0..<2 {
        let engine = AVAudioEngine()
        let player = AVAudioPlayerNode()
        let inputFormat = AVAudioFormat(standardFormatWithSampleRate: Double(sourceRate), channels: 1)!
        let outputFormat = AVAudioFormat(standardFormatWithSampleRate: outputRate, channels: 1)!
        engine.attach(player)
        engine.connect(player, to: engine.mainMixerNode, format: inputFormat)
        try engine.enableManualRenderingMode(.offline, format: outputFormat, maximumFrameCount: 4096)
        let input = AVAudioPCMBuffer(pcmFormat: inputFormat, frameCapacity: AVAudioFrameCount(samples.count))!
        input.frameLength = input.frameCapacity
        samples.withUnsafeBufferPointer { pointer in input.floatChannelData![0].update(from: pointer.baseAddress!, count: samples.count) }
        player.scheduleBuffer(input)
        try engine.start()
        player.play()
        let output = AVAudioPCMBuffer(pcmFormat: outputFormat, frameCapacity: 4096)!
        var rendered: [Float] = []
        let target = Int(outputRate / 4)
        while rendered.count < target {
          let count = AVAudioFrameCount(min(4096, target - rendered.count))
          let status = try engine.renderOffline(count, to: output)
          precondition(status == .success, "Audio graph stalled: \(status)")
          rendered.append(contentsOf: UnsafeBufferPointer(start: output.floatChannelData![0], count: Int(output.frameLength)))
        }
        player.stop()
        engine.stop()
        let rms = sqrt(rendered.reduce(0.0) { $0 + Double($1 * $1) } / Double(rendered.count))
        var crossings = 0
        var belowThreshold = false
        for sample in rendered {
          if sample < -0.1 { belowThreshold = true }
          if belowThreshold && sample > 0.1 { crossings += 1; belowThreshold = false }
        }
        let frequency = Double(crossings) / (Double(rendered.count) / outputRate)
        print("Metrics: output=\(outputRate) rms=\(rms) frequency=\(frequency) frames=\(rendered.count)")
        if rms <= 0.25 || abs(frequency - 800) >= 20 { exit(1) }
      }
      print("PASS: PCM 16000 -> mixer \(Int(outputRate)) Hz, pitch preserved across two starts")
    }
  }
}
