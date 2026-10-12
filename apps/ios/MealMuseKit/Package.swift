// swift-tools-version: 6.0
import PackageDescription

// iOS 业务逻辑放在这个包里：不依赖 Xcode，可用 `swift test` 在命令行验证。
let package = Package(
    name: "MealMuseKit",
    platforms: [.iOS(.v17), .macOS(.v14)],
    products: [
        .library(name: "MealMuseKit", targets: ["MealMuseKit"])
    ],
    dependencies: [
        .package(url: "https://github.com/apple/swift-openapi-generator", from: "1.7.0"),
        .package(url: "https://github.com/apple/swift-openapi-runtime", from: "1.8.0"),
        .package(url: "https://github.com/apple/swift-openapi-urlsession", from: "1.1.0"),
        .package(url: "https://github.com/apple/swift-http-types", from: "1.3.0"),
    ],
    targets: [
        // 由服务端 openapi.json 生成的类型化客户端（Types 层），不手写。
        .target(
            name: "MealMuseAPI",
            dependencies: [
                .product(name: "OpenAPIRuntime", package: "swift-openapi-runtime")
            ],
            plugins: [
                .plugin(name: "OpenAPIGenerator", package: "swift-openapi-generator")
            ]
        ),
        .target(
            name: "MealMuseKit",
            dependencies: [
                "MealMuseAPI",
                .product(name: "OpenAPIRuntime", package: "swift-openapi-runtime"),
                .product(name: "OpenAPIURLSession", package: "swift-openapi-urlsession"),
                .product(name: "HTTPTypes", package: "swift-http-types"),
            ]
        ),
        .testTarget(
            name: "MealMuseKitTests",
            dependencies: [
                "MealMuseKit",
                "MealMuseAPI",
                .product(name: "OpenAPIRuntime", package: "swift-openapi-runtime"),
                .product(name: "HTTPTypes", package: "swift-http-types"),
            ]
        ),
    ]
)
