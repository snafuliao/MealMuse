import MealMuseAPI
import Testing

@testable import MealMuseKit

@Suite struct HealthServiceTests {
    @Test func mapsHealthyPayload() async throws {
        let api = FakeAPI()
        let health = try await HealthService(client: api).fetch()
        #expect(health == ServerHealth(status: .ok, version: "0.1.0"))
    }

    @Test func mapsDegradedPayload() async throws {
        let api = FakeAPI()
        api.health = .init(status: .degraded, version: "0.1.0", checks: .init(database: .unreachable))
        let health = try await HealthService(client: api).fetch()
        #expect(health.status == .degraded)
    }
}
