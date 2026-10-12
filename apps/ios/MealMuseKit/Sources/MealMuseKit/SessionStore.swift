import Foundation
import MealMuseAPI
import Observation

/// App 内的当前用户，与生成的网络类型解耦。
public struct CurrentUser: Equatable, Sendable {
    public let id: String
    public let displayName: String
    public let isAdmin: Bool
}

/// 面向用户展示的错误，message 来自服务端 ErrorResponse 或本地兜底文案。
public struct UserFacingError: Error, Equatable, Sendable {
    public let message: String

    static let network = UserFacingError(message: "无法连接服务端，请检查网络后重试")
    static let unexpected = UserFacingError(message: "服务端返回了无法识别的结果")
}

/// 登录状态：启动时用 Keychain 中的令牌恢复，邀请码注册后写入令牌。
@MainActor
@Observable
public final class SessionStore {
    public enum State: Equatable {
        case restoring
        case signedOut
        case signedIn(CurrentUser)
        case failed(UserFacingError)
    }

    public private(set) var state: State = .restoring
    private let client: any APIProtocol
    private let tokenStore: any TokenStore

    public init(client: any APIProtocol, tokenStore: any TokenStore) {
        self.client = client
        self.tokenStore = tokenStore
    }

    /// 有令牌就向服务端确认身份；令牌失效（401）则清掉并回到注册页。
    public func restore() async {
        guard tokenStore.load() != nil else {
            state = .signedOut
            return
        }
        state = .restoring
        do {
            switch try await client.getMe() {
            case .ok(let ok):
                state = .signedIn(CurrentUser(try ok.body.json))
            case .unauthorized:
                tokenStore.clear()
                state = .signedOut
            case .undocumented:
                state = .failed(.unexpected)
            }
        } catch {
            state = .failed(.network)
        }
    }

    /// 用邀请码注册。失败时抛出 UserFacingError，状态保持 signedOut 以便重试。
    public func register(code: String, displayName: String, deviceName: String) async throws {
        let request = Components.Schemas.RedeemInviteRequest(
            code: code.trimmingCharacters(in: .whitespacesAndNewlines),
            displayName: displayName.trimmingCharacters(in: .whitespacesAndNewlines),
            deviceName: deviceName
        )
        let output: Operations.RedeemInvite.Output
        do {
            output = try await client.redeemInvite(body: .json(request))
        } catch {
            throw UserFacingError.network
        }
        switch output {
        case .ok(let ok):
            let body = try ok.body.json
            do {
                try tokenStore.save(body.token)
            } catch let error as KeychainError {
                throw UserFacingError(message: "无法把登录信息保存到钥匙串（错误 \(error.status)）")
            } catch {
                throw UserFacingError(message: "无法把登录信息保存到钥匙串")
            }
            state = .signedIn(CurrentUser(body.user))
        case .badRequest(let response):
            throw UserFacingError(message: (try? response.body.json.error.message) ?? "邀请码无效")
        case .tooManyRequests:
            throw UserFacingError(message: "尝试太频繁，请稍后再试")
        case .undocumented:
            throw UserFacingError.unexpected
        }
    }

    /// 退出：尽力通知服务端撤销令牌，无论成功与否都清掉本机令牌。
    public func signOut() async {
        _ = try? await client.logout()
        tokenStore.clear()
        state = .signedOut
    }
}

extension CurrentUser {
    init(_ me: Components.Schemas.Me) {
        self.init(id: me.id, displayName: me.displayName, isAdmin: me.role == .admin)
    }
}
