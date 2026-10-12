import MealMuseAPI
import Testing

@testable import MealMuseKit

private struct StubClient: APIProtocol {
    let payload: Components.Schemas.HealthStatus

    func getHealth(_ input: Operations.GetHealth.Input) async throws -> Operations.GetHealth.Output {
        .ok(.init(body: .json(payload)))
    }
}

@Suite struct HealthServiceTests {
    @Test func mapsHealthyPayload() async throws {
        let service = HealthService(
            client: StubClient(
                payload: .init(status: .ok, version: "0.1.0", checks: .init(database: .ok))
            )
        )
        let health = try await service.fetch()
        #expect(health == ServerHealth(status: .ok, version: "0.1.0"))
    }

    @Test func mapsDegradedPayload() async throws {
        let service = HealthService(
            client: StubClient(
                payload: .init(status: .degraded, version: "0.1.0", checks: .init(database: .unreachable))
            )
        )
        let health = try await service.fetch()
        #expect(health.status == .degraded)
    }
}
