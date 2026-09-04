import { describe, expect, it } from "vitest"
import { programContentSchema } from "./program-content"

describe("program content validation", () => {
  it("allows FAQ changes when service overrides are blank", () => {
    const result = programContentSchema.safeParse({
      faq: [
        {
          question: "Where is registration?",
          answer: "Registration is in the main lobby."
        }
      ],
      services: {
        rides: { title: "", description: "", internal_description: "" },
        support: { title: "", description: "" },
        hospitality: { title: "", description: "" },
        volunteering: {
          title: "",
          description: "",
          signup_destination: "internal",
          external_signup_url: ""
        },
        accessibility: { title: "", description: "" }
      }
    })

    expect(result.success).toBe(true)
  })

  it("still validates an external volunteer signup destination", () => {
    const result = programContentSchema.safeParse({
      faq: [],
      services: {
        volunteering: {
          signup_destination: "external",
          external_signup_url: "https://example.com/signup"
        }
      }
    })

    expect(result.success).toBe(false)
  })
})
