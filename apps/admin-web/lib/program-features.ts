export const PROGRAM_FEATURE_GROUPS = [
  {
    title: "Attendee services",
    description:
      "Help attendees find support and participate in the conference.",
    features: [
      {
        key: "accessibility_enabled",
        name: "Accessibility services",
        description: "Show accessibility information and request options.",
      },
      {
        key: "child_care_enabled",
        name: "Childcare",
        description: "Show childcare information and request options.",
      },
      {
        key: "hospitality_enabled",
        name: "Hospitality",
        description: "Show hospitality suite information and schedules.",
      },
      {
        key: "support_chat_enabled",
        name: "Support chat",
        description: "Allow attendees to contact the conference support team.",
      },
      {
        key: "volunteering_enabled",
        name: "Volunteering",
        description: "Show volunteer information and sign-up options.",
      },
    ],
  },
  {
    title: "Program tools",
    description: "Control optional tools around the conference schedule.",
    features: [
      {
        key: "bid_schedule_enabled",
        name: "Bid schedule",
        description: "Show bid presentations and related schedule information.",
      },
      {
        key: "schedule_sharing_enabled",
        name: "Schedule sharing",
        description: "Let attendees share their saved personal schedules.",
      },
      {
        key: "language_option_enabled",
        name: "Language selection",
        description:
          "Show language controls when translated content is available.",
      },
    ],
  },
  {
    title: "Communication",
    description: "Manage how conference updates reach attendees.",
    features: [
      {
        key: "push_notifications_enabled",
        name: "Push notifications",
        description: "Allow conference announcements and event reminders.",
      },
    ],
  },
] as const;

export type ProgramFeatureKey =
  (typeof PROGRAM_FEATURE_GROUPS)[number]["features"][number]["key"];

export type ProgramFeatureFlags = Record<ProgramFeatureKey, boolean>;

type ProgramFeatureDefinition =
  (typeof PROGRAM_FEATURE_GROUPS)[number]["features"][number];

function flattenFeatureGroups(
  groups: readonly {
    features: readonly ProgramFeatureDefinition[];
  }[],
) {
  const definitions: ProgramFeatureDefinition[] = [];
  for (const group of groups) definitions.push(...group.features);
  return definitions;
}

export const PROGRAM_FEATURE_DEFINITIONS = flattenFeatureGroups(
  PROGRAM_FEATURE_GROUPS,
);

export const PROGRAM_FEATURE_KEYS = PROGRAM_FEATURE_DEFINITIONS.map(
  (feature) => feature.key,
) as ProgramFeatureKey[];

export const DEFAULT_PROGRAM_FEATURES = Object.fromEntries(
  PROGRAM_FEATURE_KEYS.map((key) => [key, true]),
) as ProgramFeatureFlags;

export function normalizeProgramFeatures(
  features: Record<string, unknown> | null | undefined,
): ProgramFeatureFlags {
  return Object.fromEntries(
    PROGRAM_FEATURE_KEYS.map((key) => [
      key,
      typeof features?.[key] === "boolean"
        ? features[key]
        : DEFAULT_PROGRAM_FEATURES[key],
    ]),
  ) as ProgramFeatureFlags;
}
