import MealMuseKit
import SwiftUI

/// 按登录状态切换页面：恢复中 → 注册 / 首页 / 出错可重试。
struct RootView: View {
    let session: SessionStore
    let healthService: HealthService

    var body: some View {
        Group {
            switch session.state {
            case .restoring:
                ProgressView("正在恢复登录…")
            case .signedOut:
                RegistrationView(session: session)
            case .signedIn(let user):
                HomeView(user: user, session: session, healthService: healthService)
            case .failed(let error):
                ContentUnavailableView {
                    Label("连接失败", systemImage: "wifi.exclamationmark")
                } description: {
                    Text(error.message)
                } actions: {
                    Button("重试") { Task { await session.restore() } }
                        .buttonStyle(.borderedProminent)
                }
            }
        }
        .task { await session.restore() }
    }
}
