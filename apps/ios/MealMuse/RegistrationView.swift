import MealMuseKit
import SwiftUI
import UIKit

struct RegistrationView: View {
    let session: SessionStore
    @State private var code = ""
    @State private var displayName = ""
    @State private var errorMessage: String?
    @State private var submitting = false

    private var canSubmit: Bool {
        !code.trimmingCharacters(in: .whitespaces).isEmpty
            && !displayName.trimmingCharacters(in: .whitespaces).isEmpty && !submitting
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    // 邀请码不能被自动更正改写（实测 st8v 会被改成 stove）：一次性码类型 + ASCII 键盘 + 关闭自动更正。
                    // 不在输入过程中改写绑定值（会吞掉快速输入的字符），提交时再规整。
                    TextField("邀请码，如 ABCD-2345", text: $code)
                        .textContentType(.oneTimeCode)
                        .keyboardType(.asciiCapable)
                        .textInputAutocapitalization(.characters)
                        .autocorrectionDisabled()
                        .accessibilityIdentifier("inviteCode")
                    TextField("你的昵称", text: $displayName)
                        .accessibilityIdentifier("displayName")
                } header: {
                    Text("加入 MealMuse")
                } footer: {
                    Text("邀请码由管理员在管理端生成。")
                }
                if let errorMessage {
                    Section {
                        Text(errorMessage).foregroundStyle(.red)
                    }
                }
                Section {
                    Button {
                        Task { await submit() }
                    } label: {
                        if submitting {
                            ProgressView()
                        } else {
                            Text("加入").frame(maxWidth: .infinity)
                        }
                    }
                    .disabled(!canSubmit)
                    .accessibilityIdentifier("join")
                }
            }
            .navigationTitle("MealMuse")
        }
    }

    private func submit() async {
        submitting = true
        errorMessage = nil
        defer { submitting = false }
        do {
            try await session.register(
                code: InviteCode.normalizeForDisplay(code),
                displayName: displayName,
                deviceName: UIDevice.current.name
            )
        } catch let error as UserFacingError {
            errorMessage = error.message
        } catch {
            errorMessage = "注册失败，请重试"
        }
    }
}
