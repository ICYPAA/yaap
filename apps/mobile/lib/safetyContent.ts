import { NDAHContent } from "../types/program"

export const DEFAULT_NDAH_CONTENT: Required<
  Pick<
    NDAHContent,
    | "safety_statement"
    | "anti_harassment_short"
    | "anti_discrimination_short"
    | "ndah_link"
  >
> = {
  safety_statement:
    "Our group endeavors to provide a safe meeting place for all attendees and encourages each person here to foster a secure and welcoming environment in which our meetings can take place. We ask that attendees refrain from behavior that might compromise another person's safety and take the precautions they feel are necessary for their own personal safety.",
  anti_harassment_short:
    "ICYPAA expressly prohibits harassment or sexual harassment by or against Advisory Council members, Host Committee members, Bid Committee members, conference attendees, and participants in ICYPAA-operated or moderated online spaces.",
  anti_discrimination_short:
    "ICYPAA expressly prohibits discrimination based on age, race, color, religion, sex, national origin, creed, disability, veteran status, sexual orientation, gender identity, or gender expression.",
  ndah_link: "https://icypaa.org/ndahp.pdf"
}

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null

const nonEmptyString = (value: unknown, fallback: string): string =>
  typeof value === "string" && value.trim() ? value : fallback

export const resolveNDAHContent = (value: unknown): NDAHContent => {
  const content = asRecord(value)
  const reportCrime = asRecord(content?.report_crime)
  const committeeContact = asRecord(content?.committee_contact)

  return {
    safety_statement: nonEmptyString(
      content?.safety_statement,
      DEFAULT_NDAH_CONTENT.safety_statement
    ),
    anti_harassment_short: nonEmptyString(
      content?.anti_harassment_short,
      DEFAULT_NDAH_CONTENT.anti_harassment_short
    ),
    anti_discrimination_short: nonEmptyString(
      content?.anti_discrimination_short,
      DEFAULT_NDAH_CONTENT.anti_discrimination_short
    ),
    ndah_link: nonEmptyString(
      content?.ndah_link,
      DEFAULT_NDAH_CONTENT.ndah_link
    ),
    ...(reportCrime && {
      report_crime: reportCrime as NDAHContent["report_crime"]
    }),
    ...(committeeContact && {
      committee_contact: committeeContact as NDAHContent["committee_contact"]
    })
  }
}
