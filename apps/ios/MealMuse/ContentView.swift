import MealMuseKit
import SwiftUI

struct ContentView: View {
    let healthService: HealthService
    @State private var statusText = "检查服务中…"

    var body: some View {
        NavigationStack {
            VStack(spacing: 12) {
                Text("今天吃什么？")
                    .font(.largeTitle.bold())
                Text(statusText)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
            .navigationTitle("MealMuse")
        }
        .task { await refreshHealth() }
    }

    private func refreshHealth() async {
        do {
            let health = try await healthService.fetch()
            statusText = "服务\(health.status == .ok ? "正常" : "降级") · v\(health.version)"
        } catch {
            statusText = "服务不可达"
        }
    }
}
