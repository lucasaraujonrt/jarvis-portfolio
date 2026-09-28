import Foundation

struct VoiceSignal: Equatable, Sendable {
  var level: Double = 0
  var pitch: Double?

  static let silence = VoiceSignal()

  var normalizedPitch: Double {
    guard let pitch else { return 0.5 }
    return min(1, max(0, log2(pitch / 80) / log2(400 / 80)))
  }
}

struct VoiceSignalAnalyzer {
  private var window: [Double] = []
  private var rate: Double = 0
  private var level = 0.0
  private var pitch: Double?

  mutating func process(_ samples: [Float], sampleRate: Double) -> VoiceSignal {
    guard sampleRate.isFinite, sampleRate >= 8000, !samples.isEmpty else { return .silence }
    if rate != sampleRate {
      window.removeAll(keepingCapacity: true)
      level = 0
      pitch = nil
      rate = sampleRate
    }
    let stride = max(1, Int(sampleRate / 8000))
    let clean = samples.map { $0.isFinite ? Double($0) : 0 }
    let mean = clean.reduce(0, +) / Double(clean.count)
    let energy = clean.reduce(0) { $0 + pow($1 - mean, 2) } / Double(clean.count)
    let db = 10 * log10(max(energy, 1e-12))
    let target = db < -52 ? 0 : min(1, max(0, (db + 52) / 42))
    let seconds = Double(samples.count) / sampleRate
    let smoothing = 1 - exp(-seconds / (target > level ? 0.035 : 0.12))
    level += (target - level) * smoothing
    if level < 0.005 { level = 0 }

    var index = 0
    while index + stride <= clean.count {
      window.append(clean[index..<(index + stride)].reduce(0, +) / Double(stride))
      index += stride
    }
    if window.count > 512 { window.removeFirst(window.count - 512) }
    if db < -48 || window.count < 384 {
      pitch = nil
    } else {
      pitch = estimatePitch(sampleRate: sampleRate / Double(stride))
    }
    return VoiceSignal(level: level, pitch: pitch)
  }

  private func estimatePitch(sampleRate: Double) -> Double? {
    let mean = window.reduce(0, +) / Double(window.count)
    let values = window.map { $0 - mean }
    let minLag = max(2, Int(sampleRate / 450))
    let maxLag = min(values.count / 2, Int(sampleRate / 70))
    guard maxLag > minLag else { return nil }
    var correlations = [Double](repeating: 0, count: maxLag + 1)
    for lag in minLag...maxLag {
      var product = 0.0
      var energyA = 0.0
      var energyB = 0.0
      for i in 0..<(values.count - lag) {
        let a = values[i]
        let b = values[i + lag]
        product += a * b
        energyA += a * a
        energyB += b * b
      }
      correlations[lag] = product / max(1e-12, sqrt(energyA * energyB))
    }
    let threshold = max(0.75, (correlations.max() ?? 0) * 0.92)
    guard let lag = (minLag + 1..<maxLag).first(where: {
      correlations[$0] >= threshold && correlations[$0] > correlations[$0 - 1] && correlations[$0] >= correlations[$0 + 1]
    }) else { return nil }
    let left = correlations[lag - 1]
    let middle = correlations[lag]
    let right = correlations[lag + 1]
    let denominator = left - 2 * middle + right
    let correction = abs(denominator) > 1e-9 ? 0.5 * (left - right) / denominator : 0
    return sampleRate / (Double(lag) + min(0.5, max(-0.5, correction)))
  }
}

enum SpeechVisualEvent: Sendable {
  case started, word, paused, resumed, ended
}

struct SpeechVisualState: Equatable {
  private(set) var utteranceID: ObjectIdentifier?
  private(set) var isSpeaking = false
  private(set) var pulse = 0

  mutating func prepare(_ id: ObjectIdentifier) {
    utteranceID = id
    isSpeaking = false
    pulse = 0
  }

  mutating func receive(_ event: SpeechVisualEvent, for id: ObjectIdentifier) {
    guard utteranceID == id else { return }
    switch event {
    case .started, .resumed: isSpeaking = true
    case .word: pulse += 1
    case .paused: isSpeaking = false
    case .ended:
      isSpeaking = false
      utteranceID = nil
    }
  }
}
