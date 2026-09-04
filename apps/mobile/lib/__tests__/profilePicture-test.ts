import { getProfilePictureAuthHeaders } from "../profilePicture"
import { supabase } from "../supabase"

jest.mock("../supabase", () => ({
  getDeviceId: jest.fn(),
  supabase: {
    auth: {
      getSession: jest.fn()
    }
  }
}))

const mockGetSession = supabase.auth.getSession as jest.Mock
const originalAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY

describe("getProfilePictureAuthHeaders", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = "public-anon-key"
  })

  afterAll(() => {
    if (originalAnonKey === undefined) {
      delete process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
    } else {
      process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = originalAnonKey
    }
  })

  it("uses the public app credential for an un-signed-in attendee", async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } })

    await expect(
      getProfilePictureAuthHeaders("attendee-device-id")
    ).resolves.toEqual({
      Authorization: "Bearer public-anon-key",
      apikey: "public-anon-key",
      "x-device-id": "attendee-device-id"
    })
  })

  it("includes the signed-in session separately for an account-linked profile", async () => {
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: "user-access-token" } }
    })

    await expect(
      getProfilePictureAuthHeaders("host-device-id")
    ).resolves.toEqual({
      Authorization: "Bearer public-anon-key",
      apikey: "public-anon-key",
      "x-device-id": "host-device-id",
      "x-user-token": "user-access-token"
    })
  })

  it("keeps the public credential in authorization when a stored session exists", async () => {
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: "stale-access-token" } }
    })

    await expect(
      getProfilePictureAuthHeaders("attendee-device-id")
    ).resolves.toEqual({
      Authorization: "Bearer public-anon-key",
      apikey: "public-anon-key",
      "x-device-id": "attendee-device-id",
      "x-user-token": "stale-access-token"
    })
  })

  it("reports a configuration error when the app credential is absent", async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } })
    delete process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY

    await expect(
      getProfilePictureAuthHeaders("attendee-device-id")
    ).rejects.toThrow("Profile picture uploads are not configured for this app.")
  })
})
