import { getExternalVolunteerSignupUrl } from "../volunteerSignup"

describe("getExternalVolunteerSignupUrl", () => {
  it("uses the internal form by default", () => {
    expect(getExternalVolunteerSignupUrl()).toBeNull()
    expect(
      getExternalVolunteerSignupUrl({
        external_signup_url: "https://www.signupgenius.com/go/example"
      })
    ).toBeNull()
  })

  it("accepts HTTPS SignUpGenius signup links", () => {
    const url = "https://www.signupgenius.com/go/example"

    expect(
      getExternalVolunteerSignupUrl({
        signup_destination: "external",
        external_signup_url: url
      })
    ).toBe(url)
  })

  it("accepts official SignUpGenius short links", () => {
    const url = "https://sugeni.us/example"

    expect(
      getExternalVolunteerSignupUrl({
        signup_destination: "external",
        external_signup_url: url
      })
    ).toBe(url)
  })

  it.each([
    "http://www.signupgenius.com/go/example",
    "https://signupgenius.example.com/go/example",
    "https://signupgenius.com.example.org/go/example",
    "https://sugeni.us.example.org/example",
    "https://user:password@signupgenius.com/go/example",
    "https://signupgenius.com:8443/go/example",
    "not a URL"
  ])("rejects an untrusted external URL: %s", (url) => {
    expect(
      getExternalVolunteerSignupUrl({
        signup_destination: "external",
        external_signup_url: url
      })
    ).toBeNull()
  })
})
