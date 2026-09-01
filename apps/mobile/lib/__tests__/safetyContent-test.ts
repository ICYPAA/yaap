import { DEFAULT_NDAH_CONTENT, resolveNDAHContent } from "../safetyContent"

describe("resolveNDAHContent", () => {
  it("supplies complete policy text for an older program without NDAH data", () => {
    expect(resolveNDAHContent(null)).toEqual(DEFAULT_NDAH_CONTENT)
  })

  it("replaces blank legacy values with safe defaults", () => {
    const content = resolveNDAHContent({
      safety_statement: "",
      anti_harassment_short: "   ",
      anti_discrimination_short: null
    })

    expect(content.safety_statement).toBe(
      DEFAULT_NDAH_CONTENT.safety_statement
    )
    expect(content.anti_harassment_short).toBe(
      DEFAULT_NDAH_CONTENT.anti_harassment_short
    )
    expect(content.anti_discrimination_short).toBe(
      DEFAULT_NDAH_CONTENT.anti_discrimination_short
    )
  })

  it("keeps program-specific text and reporting contacts", () => {
    const content = resolveNDAHContent({
      safety_statement: "Conference-specific safety statement",
      committee_contact: {
        info: "Contact the safety committee",
        contact: "safety@example.com"
      }
    })

    expect(content.safety_statement).toBe(
      "Conference-specific safety statement"
    )
    expect(content.committee_contact).toEqual({
      info: "Contact the safety committee",
      contact: "safety@example.com"
    })
  })
})
