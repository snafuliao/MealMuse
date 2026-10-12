import Foundation
import Security

/// 设备令牌的存取。App 使用 Keychain，测试使用内存实现。
public protocol TokenStore: Sendable {
    func load() -> String?
    func save(_ token: String) throws
    func clear()
}

public struct KeychainError: Error, Equatable {
    public let status: OSStatus
}

/// 令牌存进 Keychain（仅本机、解锁后可读），卸载 App 后由系统清理。
public struct KeychainTokenStore: TokenStore {
    private let service: String
    private let account = "device-token"

    public init(service: String = "com.mealmuse.app") {
        self.service = service
    }

    private var baseQuery: [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
    }

    public func load() -> String? {
        var query = baseQuery
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        var item: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &item) == errSecSuccess,
            let data = item as? Data
        else { return nil }
        return String(data: data, encoding: .utf8)
    }

    public func save(_ token: String) throws {
        clear()
        var query = baseQuery
        query[kSecValueData as String] = Data(token.utf8)
        query[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        let status = SecItemAdd(query as CFDictionary, nil)
        guard status == errSecSuccess else { throw KeychainError(status: status) }
    }

    public func clear() {
        SecItemDelete(baseQuery as CFDictionary)
    }
}

public final class InMemoryTokenStore: TokenStore, @unchecked Sendable {
    private let lock = NSLock()
    private var token: String?

    public init(token: String? = nil) {
        self.token = token
    }

    public func load() -> String? {
        lock.withLock { token }
    }

    public func save(_ token: String) throws {
        lock.withLock { self.token = token }
    }

    public func clear() {
        lock.withLock { token = nil }
    }
}
