import Foundation
import HTTPTypes
import MealMuseAPI
import OpenAPIRuntime
import OpenAPIURLSession

/// 给每个请求加上设备令牌（有令牌时）。
struct AuthMiddleware: ClientMiddleware {
    let tokenStore: any TokenStore

    func intercept(
        _ request: HTTPRequest,
        body: HTTPBody?,
        baseURL: URL,
        operationID: String,
        next: (HTTPRequest, HTTPBody?, URL) async throws -> (HTTPResponse, HTTPBody?)
    ) async throws -> (HTTPResponse, HTTPBody?) {
        var request = request
        if let token = tokenStore.load() {
            request.headerFields[.authorization] = "Bearer \(token)"
        }
        return try await next(request, body, baseURL)
    }
}

public enum APIClientFactory {
    /// serverURL 是服务端根地址（如 http://localhost:8787），接口路径自带 /api 前缀。
    public static func make(serverURL: URL, tokenStore: any TokenStore) -> any APIProtocol {
        Client(
            serverURL: serverURL,
            transport: URLSessionTransport(),
            middlewares: [AuthMiddleware(tokenStore: tokenStore)]
        )
    }
}
