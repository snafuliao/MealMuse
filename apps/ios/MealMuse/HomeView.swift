import MealMuseKit
import SwiftUI

struct HomeView: View {
    let user: CurrentUser
    let session: SessionStore
    let healthService: HealthService
    @State private var statusText = "检查服务中…"

    var body: some View {
        NavigationStack {
            VStack(spacing: 12) {
                Text("\(user.displayName)，今天吃什么？")
                    .font(.title.bold())
                    .multilineTextAlignment(.center)
                Text(statusText)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
            .padding()
            .navigationTitle("MealMuse")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Menu {
                        Button("退出登录", role: .destructive) {
                            Task { await session.signOut() }
                        }
                    } label: {
                        Image(systemName: "person.crop.circle")
                    }
                    .accessibilityLabel("账号")
                }
            }
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
