import MealMuseKit
import SwiftUI

@main
struct MealMuseApp: App {
    private let healthService = HealthService(serverURL: AppEnvironment.serverURL)

    var body: some Scene {
        WindowGroup {
            ContentView(healthService: healthService)
        }
    }
}

enum AppEnvironment {
    /// 服务端地址来自 Info.plist 的 MealMuseServerURL（按 Debug / Release 配置注入）。
    static var serverURL: URL {
        guard
            let raw = Bundle.main.object(forInfoDictionaryKey: "MealMuseServerURL") as? String,
            let url = URL(string: raw)
        else {
            preconditionFailure("Info.plist 缺少有效的 MealMuseServerURL")
        }
        return url
    }
}
