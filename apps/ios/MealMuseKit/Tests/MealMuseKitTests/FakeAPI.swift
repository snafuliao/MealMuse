import Foundation
import MealMuseAPI
import OpenAPIRuntime

/// 可配置的 APIProtocol 替身：每个操作返回预设结果，并记录收到的请求。
final class FakeAPI: APIProtocol, @unchecked Sendable {
    var health: Components.Schemas.HealthStatus = .init(
        status: .ok,
        version: "0.1.0",
        checks: .init(database: .ok)
    )
    var meResult: Result<Operations.GetMe.Output, any Error> = .success(
        .unauthorized(.init(body: .json(FakeAPI.error("请先登录"))))
    )
    var redeemResult: Result<Operations.RedeemInvite.Output, any Error> = .failure(URLError(.notConnectedToInternet))
    private(set) var redeemRequests: [Components.Schemas.RedeemInviteRequest] = []
    private(set) var logoutCalls = 0

    static let me = Components.Schemas.Me(id: "u-1", displayName: "小明", role: .member)

    static func error(_ message: String) -> Components.Schemas.ErrorResponse {
        .init(error: .init(code: "invalid_invite", message: message))
    }

    func getHealth(_ input: Operations.GetHealth.Input) async throws -> Operations.GetHealth.Output {
        .ok(.init(body: .json(health)))
    }

    func getMe(_ input: Operations.GetMe.Input) async throws -> Operations.GetMe.Output {
        try meResult.get()
    }

    func redeemInvite(_ input: Operations.RedeemInvite.Input) async throws -> Operations.RedeemInvite.Output {
        if case .json(let body) = input.body { redeemRequests.append(body) }
        return try redeemResult.get()
    }

    func logout(_ input: Operations.Logout.Input) async throws -> Operations.Logout.Output {
        logoutCalls += 1
        return .noContent(.init())
    }
}
