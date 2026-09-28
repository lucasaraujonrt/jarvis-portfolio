import Foundation

@main
struct GatewaySettingsTests {
  static func expectToken(_ settings: GatewaySettings, equals expected: String?) throws {
    let actual = try settings.loadToken()
    precondition(actual == expected)
  }

  static func main() throws {
    let namespace = "jarvis.gateway-settings-test.\(UUID().uuidString)"
    let defaults = UserDefaults(suiteName: namespace)!
    let settings = GatewaySettings(defaults: defaults, service: namespace)
    defer {
      try? settings.saveToken("")
      defaults.removePersistentDomain(forName: namespace)
    }
    try expectToken(settings, equals: nil)
    settings.saveURL("http://test-gateway.local:4321")
    try settings.saveToken("test-token-first")

    let reopened = GatewaySettings(defaults: UserDefaults(suiteName: namespace)!, service: namespace)
    precondition(reopened.url == "http://test-gateway.local:4321")
    try expectToken(reopened, equals: "test-token-first")
    precondition(defaults.dictionaryRepresentation().values.allSatisfy { ($0 as? String) != "test-token-first" })
    try reopened.saveToken("test-token-updated")
    try expectToken(settings, equals: "test-token-updated")
    try reopened.saveToken("")
    try expectToken(settings, equals: nil)
    try reopened.saveToken("")
    print("PASS: Keychain create, reopen, update, delete; URL restored; token absent from preferences")
  }
}
