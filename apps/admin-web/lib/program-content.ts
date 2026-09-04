import * as z from "zod"

const optionalCopy = z
  .string()
  .optional()
  .transform((value) => (value ? value.trim() : value))

const faqItemSchema = z.object({
  question: z
    .string()
    .min(1, "Question is required")
    .transform((value) => value.trim()),
  answer: z
    .string()
    .min(1, "Answer is required")
    .transform((value) => value.trim())
})

const serviceSchema = z.object({
  title: optionalCopy,
  description: optionalCopy,
  internal_description: optionalCopy
})

const volunteeringServiceSchema = serviceSchema
  .extend({
    signup_destination: z.enum(["internal", "external"]).default("internal"),
    external_signup_url: optionalCopy
  })
  .superRefine((service, context) => {
    if (service.signup_destination !== "external") return

    try {
      const url = new URL(service.external_signup_url || "")
      const isSignupGenius =
        url.hostname === "signupgenius.com" ||
        url.hostname.endsWith(".signupgenius.com") ||
        url.hostname === "sugeni.us" ||
        url.hostname.endsWith(".sugeni.us")

      if (
        url.protocol !== "https:" ||
        !isSignupGenius ||
        url.username ||
        url.password ||
        url.port
      ) {
        throw new Error("Untrusted SignUpGenius URL")
      }
    } catch {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["external_signup_url"],
        message: "Enter a valid HTTPS SignUpGenius URL"
      })
    }
  })

export const programContentSchema = z.object({
  faq: z.array(faqItemSchema),
  services: z.object({
    rides: serviceSchema.optional(),
    support: serviceSchema.optional(),
    hospitality: serviceSchema.optional(),
    volunteering: volunteeringServiceSchema.optional(),
    accessibility: serviceSchema.optional()
  })
})

export type ProgramContentFormValues = z.infer<typeof programContentSchema>
