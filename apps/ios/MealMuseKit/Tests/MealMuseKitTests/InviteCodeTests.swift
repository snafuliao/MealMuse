import Testing

@testable import MealMuseKit

@Suite struct InviteCodeTests {
    @Test(arguments: [
        ("scur-st8v", "SCUR-ST8V"),
        (" ab cd-23 45 ", "ABCD-2345"),
        ("ab，cd", "ABCD"),
    ])
    func normalizes(input: String, expected: String) {
        #expect(InviteCode.normalizeForDisplay(input) == expected)
    }
}
