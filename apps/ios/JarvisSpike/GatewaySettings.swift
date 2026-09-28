import Foundation
import Security

struct GatewaySettings {
  private let defaults: UserDefaults
  private let service: String

  init(defaults: UserDefaults = .standard, service: String = "com.example.jarvis.spike.gateway") {
    self.defaults = defaults
    self.service = service
  }

  var url: String? { defaults.string(forKey: "gatewayURL") }

  func saveURL(_ value: String) {
    defaults.set(value, forKey: "gatewayURL")
  }

  func loadToken() throws -> String? {
    var query = tokenQuery
    query[kSecReturnData as String] = true
    query[kSecMatchLimit as String] = kSecMatchLimitOne
    var result: CFTypeRef?
    let status = SecItemCopyMatching(query as CFDictionary, &result)
    if status == errSecItemNotFound { return nil }
    guard status == errSecSuccess else { throw StorageError(status: status) }
    guard let data = result as? Data, let token = String(data: data, encoding: .utf8) else {
      throw StorageError(status: errSecDecode)
    }
    return token
  }

  func saveToken(_ value: String) throws {
    if value.isEmpty {
      let status = SecItemDelete(tokenQuery as CFDictionary)
      guard status == errSecSuccess || status == errSecItemNotFound else {
        throw StorageError(status: status)
      }
      return
    }
    let attributes: [String: Any] = [
      kSecValueData as String: Data(value.utf8),
      kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly,
    ]
    var status = SecItemUpdate(tokenQuery as CFDictionary, attributes as CFDictionary)
    if status == errSecItemNotFound {
      status = SecItemAdd(tokenQuery.merging(attributes) { _, new in new } as CFDictionary, nil)
    }
    guard status == errSecSuccess else { throw StorageError(status: status) }
  }

  private var tokenQuery: [String: Any] {
    [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrService as String: service,
      kSecAttrAccount as String: "gateway-token",
      kSecAttrSynchronizable as String: false,
    ]
  }

  private struct StorageError: LocalizedError {
    let status: OSStatus
    var errorDescription: String? { "Não foi possível acessar o Keychain (\(status))." }
  }
}
