import Foundation
import MealMuseAPI
import Testing

@testable import MealMuseKit

@MainActor
@Suite struct SessionStoreTests {
    @Test func startsSignedOutWithoutToken() async {
        let session = SessionStore(client: FakeAPI(), tokenStore: InMemoryTokenStore())
        await session.restore()
        #expect(session.state == .signedOut)
    }

    @Test func restoresUserFromSavedToken() async {
        let api = FakeAPI()
        api.meResult = .success(.ok(.init(body: .json(FakeAPI.me))))
        let session = SessionStore(client: api, tokenStore: InMemoryTokenStore(token: "mm_saved"))
        await session.restore()
        #expect(session.state == .signedIn(CurrentUser(id: "u-1", displayName: "小明", isAdmin: false)))
    }

    @Test func dropsRevokedTokenOnRestore() async {
        let tokens = InMemoryTokenStore(token: "mm_revoked")
        let session = SessionStore(client: FakeAPI(), tokenStore: tokens)
        await session.restore()
        #expect(session.state == .signedOut)
        #expect(tokens.load() == nil)
    }

    @Test func keepsTokenWhenOffline() async {
        let api = FakeAPI()
        api.meResult = .failure(URLError(.notConnectedToInternet))
        let tokens = InMemoryTokenStore(token: "mm_saved")
        let session = SessionStore(client: api, tokenStore: tokens)
        await session.restore()
        #expect(session.state == .failed(UserFacingError.network))
        #expect(tokens.load() == "mm_saved")
    }

    @Test func registersWithInviteAndStoresToken() async throws {
        let api = FakeAPI()
        api.redeemResult = .success(.ok(.init(body: .json(.init(token: "mm_new", user: FakeAPI.me)))))
        let tokens = InMemoryTokenStore()
        let session = SessionStore(client: api, tokenStore: tokens)

        try await session.register(code: "  abcd-2345 ", displayName: "小明 ", deviceName: "iPhone")

        #expect(tokens.load() == "mm_new")
        #expect(api.redeemRequests.first?.code == "abcd-2345")
        #expect(api.redeemRequests.first?.displayName == "小明")
        if case .signedIn(let user) = session.state {
            #expect(user.displayName == "小明")
        } else {
            Issue.record("expected signedIn, got \(session.state)")
        }
    }

    @Test func surfacesServerMessageForBadInvite() async {
        let api = FakeAPI()
        api.redeemResult = .success(.badRequest(.init(body: .json(FakeAPI.error("邀请码无效、已过期或已用完")))))
        let session = SessionStore(client: api, tokenStore: InMemoryTokenStore())
        await #expect(throws: UserFacingError(message: "邀请码无效、已过期或已用完")) {
            try await session.register(code: "x", displayName: "a", deviceName: "b")
        }
    }

    @Test func signOutClearsTokenEvenIfServerFails() async {
        let api = FakeAPI()
        let tokens = InMemoryTokenStore(token: "mm_saved")
        let session = SessionStore(client: api, tokenStore: tokens)
        await session.signOut()
        #expect(api.logoutCalls == 1)
        #expect(tokens.load() == nil)
        #expect(session.state == .signedOut)
    }
}
