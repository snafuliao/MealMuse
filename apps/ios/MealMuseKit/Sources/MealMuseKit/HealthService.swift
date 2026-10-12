import Foundation
import MealMuseAPI
import OpenAPIRuntime
import OpenAPIURLSession

/// 服务健康状态在 App 内的表示，与网络层生成类型解耦。
public struct ServerHealth: Equatable, Sendable {
    public enum Status: Equatable, Sendable {
        case ok
        case degraded
    }

    public let status: Status
    public let version: String
}

/// 访问服务端健康检查接口。所有响应都经生成的类型解析，不手工探测 JSON。
public struct HealthService: Sendable {
    private let client: any APIProtocol

    public init(client: any APIProtocol) {
        self.client = client
    }

    public init(serverURL: URL) {
        self.init(client: Client(serverURL: serverURL, transport: URLSessionTransport()))
    }

    public func fetch() async throws -> ServerHealth {
        let body = try await client.getHealth().ok.body.json
        let status: ServerHealth.Status = body.status == .ok ? .ok : .degraded
        return ServerHealth(status: status, version: body.version)
    }
}
