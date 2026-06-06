import { afterEach, describe, expect, it } from "vitest"
import { getEmailApiHeaders } from "./email-api"

const originalEmailApiSecret = process.env.EMAIL_API_SECRET

afterEach(() => {
  if (originalEmailApiSecret === undefined) {
    delete process.env.EMAIL_API_SECRET
  } else {
    process.env.EMAIL_API_SECRET = originalEmailApiSecret
  }
})

describe("getEmailApiHeaders", () => {
  it("sets the email API content headers", () => {
    delete process.env.EMAIL_API_SECRET

    expect(getEmailApiHeaders("contact")).toEqual({
      "Content-Type": "application/json",
      "email-type": "contact"
    })
  })

  it("adds bearer authorization when EMAIL_API_SECRET is configured", () => {
    process.env.EMAIL_API_SECRET = "test-secret"

    expect(getEmailApiHeaders("report")).toEqual({
      "Content-Type": "application/json",
      "email-type": "report",
      Authorization: "Bearer test-secret"
    })
  })
})
