/// 邀请码输入规整：与服务端一致，只保留字母、数字和连字符并转为大写。
public enum InviteCode {
    public static func normalizeForDisplay(_ input: String) -> String {
        String(input.uppercased().filter { ($0.isASCII && ($0.isLetter || $0.isNumber)) || $0 == "-" })
    }
}
