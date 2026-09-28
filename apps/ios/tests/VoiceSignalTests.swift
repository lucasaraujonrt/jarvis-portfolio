import Foundation

@main struct VoiceSignalTests {
  static func tone(amplitude: Double, frequency: Double, rate: Double, offset: Int, count: Int) -> [Float] {
    (offset..<(offset + count)).map { Float(amplitude * sin(2 * .pi * frequency * Double($0) / rate)) }
  }

  static func measured(amplitude: Double, frequency: Double, rate: Double) -> VoiceSignal {
    var analyzer = VoiceSignalAnalyzer()
    var signal = VoiceSignal.silence
    let count = Int(rate * 0.05)
    for chunk in 0..<10 {
      signal = analyzer.process(tone(amplitude: amplitude, frequency: frequency, rate: rate, offset: chunk * count, count: count), sampleRate: rate)
    }
    return signal
  }

  static func main() {
    for rate in [8000.0, 16000, 24000, 44100, 48000] {
      for frequency in [85.0, 130, 220, 350, 420] {
        let signal = measured(amplitude: 0.1, frequency: frequency, rate: rate)
        guard let pitch = signal.pitch else { fatalError("Sem tom em \(rate) Hz / \(frequency) Hz") }
        precondition(abs(pitch - frequency) / frequency < 0.05, "Tom incorreto: \(pitch) / \(frequency)")
        precondition((0...1).contains(signal.level))
      }
    }
    let soft = measured(amplitude: 0.015, frequency: 180, rate: 16000)
    let loud = measured(amplitude: 0.22, frequency: 180, rate: 16000)
    precondition(loud.level > soft.level + 0.4)
    let low = measured(amplitude: 0.09, frequency: 100, rate: 16000)
    let high = measured(amplitude: 0.09, frequency: 320, rate: 16000)
    precondition(high.normalizedPitch > low.normalizedPitch + 0.5)
    precondition(abs(high.level - low.level) < 0.05)

    var analyzer = VoiceSignalAnalyzer()
    _ = analyzer.process(tone(amplitude: 0.2, frequency: 180, rate: 16000, offset: 0, count: 800), sampleRate: 16000)
    var silence = VoiceSignal.silence
    for _ in 0..<20 { silence = analyzer.process([Float](repeating: 0, count: 800), sampleRate: 16000) }
    precondition(silence == .silence)
    precondition(analyzer.process([Float](repeating: 0.25, count: 800), sampleRate: 16000).pitch == nil)
    precondition(analyzer.process([.nan, .infinity], sampleRate: 16000).level.isFinite)
    precondition(analyzer.process([], sampleRate: 0) == .silence)

    var random: UInt64 = 17
    var noise = VoiceSignal.silence
    for _ in 0..<10 {
      let samples = (0..<800).map { _ -> Float in
        random = random &* 6364136223846793005 &+ 1
        return Float(Double(random >> 32) / Double(UInt32.max) - 0.5) * 0.2
      }
      noise = analyzer.process(samples, sampleRate: 16000)
    }
    precondition(noise.pitch == nil)

    let first = NSObject()
    let second = NSObject()
    var playback = SpeechVisualState()
    playback.prepare(ObjectIdentifier(first))
    playback.receive(.started, for: ObjectIdentifier(first))
    precondition(playback.isSpeaking)
    playback.receive(.word, for: ObjectIdentifier(first))
    precondition(playback.pulse == 1)
    playback.prepare(ObjectIdentifier(second))
    playback.receive(.started, for: ObjectIdentifier(second))
    playback.receive(.ended, for: ObjectIdentifier(first))
    precondition(playback.isSpeaking)
    playback.receive(.paused, for: ObjectIdentifier(second))
    precondition(!playback.isSpeaking)
    playback.receive(.resumed, for: ObjectIdentifier(second))
    precondition(playback.isSpeaking)
    playback.receive(.ended, for: ObjectIdentifier(second))
    playback.receive(.word, for: ObjectIdentifier(second))
    precondition(!playback.isSpeaking && playback.pulse == 0)
    print("PASS: volume, tom em 5 taxas de amostragem, silêncio, ruído, entrada inválida e ciclo de reprodução sem eventos atrasados")
  }
}
