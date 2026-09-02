import { describe, expect, it } from "vitest";
import { HELP_SECTIONS, filterHelpSections } from "./help-content";

describe("filterHelpSections", () => {
  it("returns all help content for an empty search", () => {
    expect(filterHelpSections(HELP_SECTIONS, "")).toBe(HELP_SECTIONS);
  });

  it("finds topics by examples and operational details", () => {
    const results = filterHelpSections(HELP_SECTIONS, "SignUpGenius");

    expect(results).toHaveLength(1);
    expect(results[0].id).toBe("services");
    expect(results[0].topics.map((topic) => topic.title)).toEqual([
      "Volunteering",
    ]);
  });

  it("finds the map workflow using natural search terms", () => {
    const results = filterHelpSections(HELP_SECTIONS, "public image URL");

    expect(results.some((section) => section.id === "maps-venue")).toBe(true);
  });

  it("returns no sections when no topic matches", () => {
    expect(filterHelpSections(HELP_SECTIONS, "fax machine toner")).toEqual([]);
  });
});
