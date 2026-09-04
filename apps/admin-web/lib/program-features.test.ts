import { describe, expect, it } from "vitest";
import {
  DEFAULT_PROGRAM_FEATURES,
  normalizeProgramFeatures,
  PROGRAM_FEATURE_KEYS,
} from "./program-features";

describe("normalizeProgramFeatures", () => {
  it("uses the app defaults when a conference has no feature settings", () => {
    expect(normalizeProgramFeatures(null)).toEqual(DEFAULT_PROGRAM_FEATURES);
  });

  it("keeps explicit false values and fills missing feature keys", () => {
    const features = normalizeProgramFeatures({
      bid_schedule_enabled: false,
      future_feature: false,
    });

    expect(features.bid_schedule_enabled).toBe(false);
    expect(features.accessibility_enabled).toBe(true);
    expect(Object.keys(features).sort()).toEqual(
      [...PROGRAM_FEATURE_KEYS].sort(),
    );
  });
});
