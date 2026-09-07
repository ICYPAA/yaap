export type HelpTopic = {
  title: string;
  body?: string[];
  steps?: string[];
  checklist?: string[];
  example?: string;
  caution?: string;
  keywords?: string[];
};

export type HelpSection = {
  id: string;
  label: string;
  title: string;
  summary: string;
  keywords: string[];
  topics: HelpTopic[];
};

export const HELP_SECTIONS: HelpSection[] = [
  {
    id: "push-notifications",
    label: "Push notifications",
    title: "Send announcements and verify delivery",
    summary: "Host committee permissions, administrator setup, and single-device live tests.",
    keywords: ["push", "notifications", "token", "Expo", "APNs", "FCM", "notifications:send"],
    topics: [
      { title: "Host committee access", body: ["An administrator grants selected host accounts notifications:send in Manage access. Program editing access alone does not allow announcements. Open Dashboard → Committee announcements. A current active conference is required.", "Announcements go to all opted-in app devices, not just people who saved that program. Hosts can review their own delivery history; full administrators can review all attempts."], steps: ["Confirm the active conference and compose a short title and message.", "Review the text and audience, then send once.", "Check the delivery attempt and fetch receipts after about 15 minutes. Escalate errors instead of resending blindly.", "Remove sending permission at committee handoff. Clearing the current program disables committee announcements."] },
      { title: "Administrator live test", body: ["Dashboard → Administrator diagnostics is restricted to the admin role. It sends a [TEST] notification to one entered Expo token and remains available with no active conference."], steps: ["Install the intended native build on your own physical device and allow notifications.", "In the app, open Notification diagnostics under Host → Notification diagnostics, signed in as a full administrator. Tap Refresh token and copy the displayed Expo token.", "Paste it into Administrator diagnostics, review a test message, and send.", "Verify the actual device in foreground, background, and locked states. Repeat on iOS and Android.", "Check receipts after about 15 minutes, within 24 hours. Expo acceptance is not proof the user received a notification."] },
      { title: "Server and native configuration", checklist: ["Apply the push_notification_runs migration and deploy the admin app and notification_service Edge Function.", "Set SUPABASE_SERVICE_ROLE_KEY only on the admin server, for the same Supabase project.", "Verify EAS APNs credentials for the iOS bundle and FCM v1 credentials plus Google services configuration for Android.", "If enhanced Expo push security is enabled, set EXPO_ACCESS_TOKEN on both the admin server and Edge Function.", "Use the app's Expo project ID and a fresh token from an installed native build. A simulator UI test cannot verify remote push delivery."] },
      { title: "Common delivery failures", body: ["InvalidCredentials or MismatchSenderId: check APNs/FCM credentials and project mapping. UNAUTHORIZED: check the Expo access token in the sending service.", "DeviceNotRegistered: have the administrator remove the obsolete token from the user's profile until the device registers again. Tokens are not automatically pruned by this dashboard.", "No recipients: check profile existence, notifications preference, and token registration. A single-device test does not require a profile.", "Accepted but silent: fetch receipts, then inspect OS permission, Focus, lock-screen settings, and Android channels.", "A partial or interrupted send can have an uncertain result. Refresh history and inspect receipts before retrying.", "Automatic event/service messages use the separate notification_service Edge Function; inspect its logs, caller session, and category preferences. Dashboard history covers dashboard sends only."] }
    ]
  },
  {
    id: "getting-started",
    label: "Start here",
    title: "Set up and publish a conference",
    summary:
      "The safe order of operations, from creating the program to making it available in the attendee app.",
    keywords: ["publish", "launch", "setup", "workflow", "select program"],
    topics: [
      {
        title: "Recommended setup order",
        body: [
          "Build and review the conference while its status is Planning. Planning shows attendees a holding screen; Active unlocks the full conference experience.",
        ],
        steps: [
          "Open Dashboard → Manage conference and app.",
          "Select the program you intend to edit in the program selector.",
          "Set the current conference to Planning and save the state.",
          "Complete program details, categories, events, maps, content, design, services, food, and activities.",
          "Turn on only the app features your team is prepared to operate.",
          "Have a second person test the attendee app on a real device.",
          "Change the current conference status to Active and save the state.",
        ],
        caution:
          "Selecting a program for editing does not make it the attendee-facing conference. The Current Conference card controls what the mobile app loads.",
      },
      {
        title: "Before you make it active",
        body: [
          "Treat activation like publishing. Check that dates, rooms, links, maps, contact workflows, and service staffing are final enough for attendees to rely on.",
        ],
        checklist: [
          "The intended program is selected as the current conference.",
          "Every event has the correct date, conference-local time, room, and category.",
          "Map and menu links open without requiring a private account.",
          "Promoted events are intentional and not an accidental carryover.",
          "Each enabled request or chat service has an assigned response team.",
          "Brand colors have readable contrast in both light and dark mode.",
        ],
      },
    ],
  },
  {
    id: "conference-state",
    label: "Publishing",
    title: "Current conference and status",
    summary:
      "Choose which program attendees receive and whether the app is closed, in planning, or fully active.",
    keywords: ["current", "none", "planning", "active", "status", "mobile app"],
    topics: [
      {
        title: "What each status means",
        body: [
          "No Current removes the attendee-facing conference. Planning associates a program but keeps the full program behind a branded holding screen. Active makes the selected program and its enabled features available.",
          "After changing either the status or program, choose Save State. Changes are picked up when the attendee app refreshes its conference settings; some cached visual changes may require an app restart.",
        ],
      },
      {
        title: "Switching conferences safely",
        body: [
          "First select the new program in the Current Conference card, keep it in Planning while you verify it, then activate it. The program selector at the top only changes what you are editing.",
        ],
        caution:
          "Never activate an unfinished program simply to preview it. Use Planning and test with an administrator before launch.",
      },
    ],
  },
  {
    id: "program-details",
    label: "Program",
    title: "Program identity, dates, and rooms",
    summary:
      "Configure the conference name, theme, venue address, date range, rooms, and attendee-facing description.",
    keywords: [
      "title",
      "theme",
      "dates",
      "time zone",
      "address",
      "rooms",
      "logo",
      "passage",
    ],
    topics: [
      {
        title: "Editing the program",
        body: [
          "From Overview, choose Edit Program. Title is the conference name. Theme is the short conference theme or slogan. Description is the attendee-facing overview. Big Book Passage is optional supporting copy.",
          "The start and end values define the conference range. The venue name and complete address are used anywhere the app describes the conference location. The dashboard suggests a time zone from the venue state; confirm the selection because some states span multiple zones.",
        ],
        steps: [
          "Enter the official title, theme, and concise description.",
          "Enter the venue state and confirm the Conference Time Zone. Grand Rapids, Michigan uses Eastern Time (America/Detroit).",
          "Set the start and end values in that conference time zone.",
          "Enter the venue name and complete postal address.",
          "Add every room name exactly as it should appear in the schedule.",
          "Save, then verify the Overview card.",
        ],
      },
      {
        title: "Venue rooms",
        body: [
          "Venue rooms become the reusable location choices for events and define columns in schedule views. Use one consistent spelling for each physical room.",
        ],
        example:
          "Good: “Ambassador Ballroom A/B” everywhere. Avoid mixing “Ambassador AB,” “Ballroom A/B,” and “Ambassador Ballroom A & B.”",
      },
    ],
  },
  {
    id: "events",
    label: "Schedule",
    title: "Categories and events",
    summary:
      "Build the schedule foundation, add complete event records, and label accessibility and interpretation options.",
    keywords: [
      "event",
      "category",
      "schedule",
      "speaker",
      "chairperson",
      "asl",
      "hybrid",
      "language",
    ],
    topics: [
      {
        title: "Create categories first",
        body: [
          "Every event requires a category. Categories group and color events in the attendee program, so create a small, stable set before entering events.",
        ],
        steps: [
          "Open the Events tab and choose Add Category.",
          "Use a short attendee-friendly title and choose a distinct, readable color.",
          "Save the category, then use it when adding events.",
        ],
        example:
          "Useful categories include Main Meetings, Panels, Workshops, Entertainment, Marathon Meetings, and Bid Committees.",
        caution:
          "Deleting a category that is already used can leave events without the grouping attendees expect. Reassign its events first.",
      },
      {
        title: "Add an event",
        body: [
          "Title, description, date, start time, end time, location, and category are required. Optional speakers and chairpeople appear with the event. Can Save Event lets attendees add it to their personal schedule.",
        ],
        steps: [
          "Choose Add Event from the Events tab.",
          "Enter attendee-ready title and description copy.",
          "Set the date and times in the program’s Conference Time Zone and select the exact room.",
          "Choose a category and decide whether attendees may save the event.",
          "Add speakers and chairpeople, if known.",
          "Mark ASL, Spanish, French, Hmong, Somali, or Hybrid only when confirmed.",
          "Save and use search/filters to find and review the event.",
        ],
      },
      {
        title: "Schedule quality checks",
        body: [
          "Use the Events search, category, location, day, and time filters to spot inconsistencies. Sort by date and start time for a final run-through.",
        ],
        checklist: [
          "No event ends before it starts.",
          "Locations match the program’s venue-room spelling.",
          "Service badges reflect confirmed accommodations only.",
          "Descriptions do not contain private phone numbers or internal notes.",
        ],
      },
    ],
  },
  {
    id: "promoted-events",
    label: "Schedule",
    title: "Promoted events",
    summary:
      "Feature a deliberate shortlist of high-priority program items more prominently in the attendee experience.",
    keywords: ["promote", "featured", "highlight", "hero", "main meeting"],
    topics: [
      {
        title: "What promotion means",
        body: [
          "A promoted event is still a normal schedule event, but it is selected for extra visibility. Promotion does not duplicate the event or change its category.",
        ],
        example:
          "Opening meeting, keynote/main speaker meeting, sobriety countdown, featured entertainment, and closing meeting are common choices.",
      },
      {
        title: "Choose promoted events",
        steps: [
          "Create and save the events first.",
          "On Overview, find Promoted Events and choose Manage.",
          "Search the event list and select the items to feature.",
          "Use Show selected only to review the final shortlist.",
          "Save the selection and confirm the promoted count on Overview.",
        ],
        body: [
          "Keep the list short enough to feel curated. Attendees should immediately understand why each item is featured.",
        ],
        caution:
          "Editing or deleting a promoted event affects the same underlying event. Revisit the promoted list after major schedule changes.",
      },
    ],
  },
  {
    id: "design",
    label: "Branding",
    title: "Design colors",
    summary:
      "Apply the conference identity to primary actions, accents, status messages, and dark-mode surfaces.",
    keywords: [
      "brand",
      "theme color",
      "primary",
      "secondary",
      "dark mode",
      "hex",
    ],
    topics: [
      {
        title: "Color roles",
        body: [
          "Primary is the main action and navigation accent. Secondary supports highlights. Primary Dark and Secondary Dark are intended for dark-mode variants. Info, Success, Warning, and Error are semantic colors for messages and states.",
        ],
        steps: [
          "On Overview, choose Edit in the Design card.",
          "Enter six-digit hex colors or use the color pickers.",
          "Save, restart the attendee app if needed, and inspect light and dark mode.",
        ],
        example:
          "Use the official brand palette, such as primary #17406A and secondary #E6C29A, rather than sampling compressed social-media artwork.",
      },
      {
        title: "Accessibility checks",
        body: [
          "Color should never be the only way meaning is communicated. Verify that buttons and labels remain readable and that category colors are distinguishable on both white and dark backgrounds.",
        ],
        caution:
          "The dashboard preview is not a substitute for checking the actual attendee app on a device.",
      },
    ],
  },
  {
    id: "faq-content",
    label: "Content",
    title: "FAQ and service copy",
    summary:
      "Answer recurring attendee questions and customize the titles and descriptions shown on service cards and forms.",
    keywords: [
      "faq",
      "question",
      "answer",
      "content",
      "copy",
      "internal description",
    ],
    topics: [
      {
        title: "What the FAQ is for",
        body: [
          "FAQ entries give attendees a fast, self-service answer to questions that are broadly applicable and unlikely to change minute by minute. Write the question in the attendee’s words and put the direct answer first.",
        ],
        steps: [
          "On Overview, choose Edit in the Content card.",
          "Choose Add FAQ, then enter a question and answer.",
          "Repeat for each topic, remove obsolete items, and choose Update Content.",
        ],
        example:
          "Question: “Where do I pick up my registration badge?” Answer: “Badge pickup is in the Grand Gallery on the lobby level. Bring your confirmation email and photo ID.”",
      },
      {
        title: "Good FAQ subjects",
        body: [
          "Registration hours, badge pickup, parking, hotel check-in, accessibility, quiet rooms, lost and found, refunds, merchandise hours, meeting etiquette, and who to contact are good candidates.",
        ],
        caution:
          "Do not publish private staff contact information, security procedures, or an answer your team cannot keep current.",
      },
      {
        title: "Description vs. internal description",
        body: [
          "The Description is the short text on a service card. Internal Description is the longer introduction shown after an attendee opens supported request forms. Despite its name, it is attendee-facing—not a place for staff-only notes.",
          "All service-copy fields are optional. Leave them blank to use the app’s built-in wording, and do not fill them in merely because a service is disabled.",
        ],
      },
    ],
  },
  {
    id: "services",
    label: "Operations",
    title: "Attendee services and readiness",
    summary:
      "Understand what each service does, what content controls it, and what must exist before you enable it.",
    keywords: [
      "accessibility",
      "childcare",
      "hospitality",
      "support",
      "volunteer",
      "rides",
      "signupgenius",
    ],
    topics: [
      {
        title: "Accessibility services",
        body: [
          "Shows a service card and request form for physical assistance, ASL, language interpretation, and related needs. Title, card description, and form introduction are edited under Content.",
        ],
        checklist: [
          "An accessibility lead owns the request queue.",
          "Hosts with the right access are signed in and monitoring notifications.",
          "There is a documented response and escalation process.",
          "The attendee-facing copy states realistic response expectations.",
          "Accessibility services is enabled under App Features.",
        ],
      },
      {
        title: "Childcare",
        body: [
          "Shows a childcare information card and request form. The current form presents a success message but does not persist or deliver the request to staff.",
        ],
        checklist: [
          "A qualified provider, safeguarding policy, capacity, hours, ages, and emergency process are confirmed.",
          "A real submission and staff-notification workflow has been implemented and tested.",
          "Legal, insurance, and background-check requirements have been reviewed.",
          "Only then enable Childcare under App Features.",
        ],
        caution:
          "Do not enable childcare in its current state if attendees could rely on the form to reserve care; submissions are not saved.",
      },
      {
        title: "Hospitality",
        body: [
          "Shows hospitality-suite information and lets attendees submit what food or supplies they plan to bring. The Hospitality card on Overview controls the suite location and open time slots. Content controls the card and form copy.",
        ],
        checklist: [
          "Suite location and daily hours are complete.",
          "A hospitality team monitors submissions and can receive supplies.",
          "Food-safety, allergy, hotel, and disposal rules are settled.",
          "Hospitality is enabled under App Features.",
        ],
      },
      {
        title: "Support chat",
        body: [
          "Allows attendees to start and continue conference-specific chats with the support team. Content controls the card title and description.",
        ],
        checklist: [
          "Named hosts are signed in and assigned to monitor support chats.",
          "Coverage hours, response targets, and escalation contacts are defined.",
          "The team knows how to resolve, reopen, and hand off conversations.",
          "Support Chat is enabled under App Features.",
        ],
        caution:
          "A visible but unstaffed support channel is worse than leaving it off. Publish alternate help instructions in the FAQ when chat is unavailable.",
      },
      {
        title: "Volunteering",
        body: [
          "Offers either the built-in volunteer interest form or an external SignUpGenius page. Configure the title, descriptions, and Signup Destination under Content.",
        ],
        checklist: [
          "Choose Internal only if a volunteer lead will monitor and act on submissions.",
          "Choose External only with a tested HTTPS signupgenius.com or sugeni.us link.",
          "Shifts, responsibilities, check-in instructions, and a volunteer contact are ready.",
          "Volunteering is enabled under App Features.",
        ],
      },
      {
        title: "Rides",
        body: [
          "The Content editor contains rides title and description fields, but the current attendee Services screen does not expose a rides card or route. Treat these fields as reserved for future use.",
        ],
        caution:
          "Do not promise an in-app ride-request service based on these fields alone. Use the FAQ or another staffed channel until a complete rides workflow is available.",
      },
    ],
  },
  {
    id: "feature-switches",
    label: "Operations",
    title: "App feature switches",
    summary:
      "Control attendee-facing tools without confusing availability with operational readiness.",
    keywords: [
      "toggle",
      "enable",
      "disable",
      "bid",
      "sharing",
      "notifications",
      "language",
    ],
    topics: [
      {
        title: "How switches work",
        body: [
          "On Overview, choose Manage in App Features. Check only the features that should be available for this program, then save. Existing programs with no saved feature settings default to all features enabled, so review every switch deliberately.",
        ],
      },
      {
        title: "Bid schedule",
        body: [
          "Shows a dedicated bid schedule assembled from events whose category name contains “bid,” such as Bid Committees. Create the category and events first, then enable Bid Schedule.",
        ],
        checklist: [
          "A bid-named category exists.",
          "Bid events have complete dates, times, rooms, and descriptions.",
          "The resulting list is checked in the attendee app.",
        ],
      },
      {
        title: "Schedule sharing",
        body: [
          "Lets attendees share saved personal schedules. Enable it when the team is comfortable with the attendee flow and has included basic privacy guidance where appropriate.",
        ],
      },
      {
        title: "Language selection",
        body: [
          "Intended to expose language controls when translated content is available. The current profile language-picker UI is not active, so enabling this switch alone does not create translations or a working selector.",
        ],
        caution:
          "Do not advertise a translated app until the target languages and navigation have been tested end to end.",
      },
      {
        title: "Push notifications",
        body: [
          "Shows notification controls and allows supported conference announcements and event reminders. It requires a production mobile build with push credentials, attendee permission, and an authorized host workflow for sending messages.",
        ],
        checklist: [
          "Push credentials and the production app build are verified.",
          "A real device has successfully received a test notification.",
          "Authorized senders, message standards, and emergency-use rules are defined.",
          "Push Notifications is enabled under App Features.",
        ],
      },
    ],
  },
  {
    id: "maps-venue",
    label: "Venue",
    title: "Maps, floors, and amenities",
    summary:
      "Add zoomable floor-plan images and concise venue information attendees can use while moving through the hotel.",
    keywords: ["map", "floor", "image url", "amenity", "venue", "directions"],
    topics: [
      {
        title: "Prepare a map image",
        body: [
          "Each floor map is loaded from a public image URL. The dashboard does not upload the file for you. Export a clear PNG or JPEG, place it at a stable HTTPS URL that opens without signing in, and test it on a phone.",
        ],
        checklist: [
          "Text remains readable when zoomed on a phone.",
          "Room labels match the event schedule exactly.",
          "The image contains no private staff-only locations or contact details.",
          "The HTTPS URL opens in a private/incognito browser window.",
          "Portrait/landscape orientation and file size are reasonable for mobile data.",
        ],
      },
      {
        title: "Add a floor map",
        steps: [
          "Open the program Overview and find Venue Information.",
          "Choose Edit Venue, then Add Floor.",
          "Enter a short floor name such as Lobby Level or Second Floor.",
          "Describe the major rooms or landmarks on that floor.",
          "Paste the public image URL into Image URL.",
          "Add other floors, choose Save Changes, and test every map in the attendee app.",
        ],
        body: [
          "Attendees can open and zoom each floor image. Use one record per useful floor or map view.",
        ],
        example:
          "Name: “Lobby Level.” Description: “Registration, Grand Gallery, hotel front desk, and elevators.” Image URL: a public HTTPS link ending in .png or .jpg.",
      },
      {
        title: "Add amenities",
        body: [
          "Amenities are short venue reference items shown below the maps. Add one item per useful facility and explain where attendees can find it in the description.",
        ],
        steps: [
          "In Edit Venue, choose Add Amenity.",
          "Enter the amenity name and a precise, attendee-friendly description.",
          "Save and verify the ordering and wording in the app.",
        ],
        example:
          "Name: “Accessible restrooms.” Description: “Lobby level, across from the Grand Gallery elevators.”",
      },
    ],
  },
  {
    id: "hospitality-hours",
    label: "Venue",
    title: "Hospitality location and hours",
    summary:
      "Publish where the hospitality suite is and the windows during which attendees can use it.",
    keywords: ["hospitality", "hours", "time slot", "suite", "location"],
    topics: [
      {
        title: "Configure the schedule",
        steps: [
          "On Overview, choose Edit in the Hospitality card.",
          "Enter the exact public location.",
          "Add one time slot for each open day with start and end times.",
          "Save and compare the hours with hotel agreements and staffing plans.",
        ],
        body: [
          "These structured hours are separate from the Hospitality title and descriptions under Content. Complete both areas before enabling the feature.",
        ],
      },
    ],
  },
  {
    id: "food-activities",
    label: "Local guide",
    title: "Food and activities",
    summary:
      "Create a useful nearby guide with accurate locations, optional distances, images, and menu links.",
    keywords: [
      "restaurant",
      "food",
      "menu",
      "activity",
      "nearby",
      "distance",
      "image",
    ],
    topics: [
      {
        title: "Food options",
        body: [
          "Food entries help attendees compare nearby restaurants and other food sources. Category, name, description, and location are required. Distance, image URL, and menu URL are optional.",
        ],
        steps: [
          "Open the Food tab and choose Add Food Option.",
          "Use a consistent category such as Quick Service, Coffee, Grocery, or Late Night.",
          "Add concise details, address/location, and walking or driving distance.",
          "Use public HTTPS links for images and menus, then save and test them.",
        ],
        example:
          "Category: “Coffee.” Name: “Lantern Coffee.” Description: “Local café with pastries and non-dairy options.” Location: “100 Commerce Ave SW.” Distance: 0.3 miles.",
      },
      {
        title: "Activities",
        body: [
          "Activity entries cover nearby sober-friendly attractions or practical off-site options. Category, name, description, and location are required; distance and image are optional.",
        ],
        steps: [
          "Open the Activities tab and choose Add Activity.",
          "Use categories such as Outdoors, Museum, Shopping, or Family.",
          "Describe cost, hours, transportation, or age restrictions when they matter.",
          "Save and verify that the recommendation is current and appropriate.",
        ],
      },
      {
        title: "Link and recommendation hygiene",
        checklist: [
          "Links work without an account and use HTTPS.",
          "Distances are measured from the conference venue.",
          "Descriptions avoid guarantees about hours, pricing, or availability.",
          "Recommendations align with the conference’s safety and sobriety expectations.",
        ],
      },
    ],
  },
  {
    id: "access-control",
    label: "Administration",
    title: "Accounts, roles, and permissions",
    summary:
      "Give people only the dashboard access they need and understand who can manage programs or other accounts.",
    keywords: [
      "role",
      "permission",
      "admin",
      "steering",
      "staff",
      "program edit",
      "account",
    ],
    topics: [
      {
        title: "Role levels",
        body: [
          "Admin has full conference and access control and is database-managed. Administrator has full conference management and can manage access. Conference staff can view the board; the program edit permission adds conference management but never account management.",
        ],
      },
      {
        title: "Grant access",
        steps: [
          "Ask the person to sign in once so their account appears.",
          "Open Dashboard → Manage access.",
          "Choose Administrator only for trusted people who may manage other accounts.",
          "Choose Conference staff for operational users and add program edit only when they need to change conference data.",
          "Remove the role when access is no longer required.",
        ],
        caution:
          "Use individual accounts. Never share a dashboard login or grant Administrator merely to solve a forgotten-password problem.",
      },
    ],
  },
  {
    id: "review-troubleshooting",
    label: "Reference",
    title: "Review, testing, and common surprises",
    summary:
      "Catch the most common publishing mistakes and know what to inspect when the attendee app does not match the dashboard.",
    keywords: [
      "test",
      "refresh",
      "restart",
      "missing",
      "not showing",
      "troubleshoot",
    ],
    topics: [
      {
        title: "When content is not showing",
        checklist: [
          "Confirm you edited the same program selected in Current Conference.",
          "Confirm the current status is Active for full attendee features.",
          "Confirm the relevant App Feature switch is enabled.",
          "Confirm required supporting data exists—for example hospitality hours or bid-category events.",
          "Refresh or restart the attendee app to clear cached conference data.",
          "Open external URLs in a signed-out browser to verify public access.",
        ],
      },
      {
        title: "Two-person launch review",
        body: [
          "Have one person make changes and another person review the attendee experience without being coached. Test search, maps, promoted events, every enabled service, external links, and dark mode on real devices.",
        ],
      },
      {
        title: "Known limitations to plan around",
        body: [
          "Childcare submissions are not currently persisted. Rides content is not currently exposed in the attendee Services screen. Enabling Language Selection does not by itself expose the currently inactive profile language picker. Map files must be hosted elsewhere and supplied as public URLs.",
        ],
      },
    ],
  },
];

export function getHelpTopicId(title: string) {
  return title
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function getHelpSection(id: string) {
  return HELP_SECTIONS.find((section) => section.id === id);
}

function normalizeSearchText(value: string) {
  return value
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function topicSearchText(topic: HelpTopic) {
  return normalizeSearchText(
    [
      topic.title,
      ...(topic.body ?? []),
      ...(topic.steps ?? []),
      ...(topic.checklist ?? []),
      topic.example ?? "",
      topic.caution ?? "",
      ...(topic.keywords ?? []),
    ].join(" "),
  );
}

export function filterHelpSections(
  sections: HelpSection[],
  query: string,
): HelpSection[] {
  const terms = normalizeSearchText(query).split(" ").filter(Boolean);
  if (terms.length === 0) return sections;

  return sections.flatMap((section) => {
    const sectionText = normalizeSearchText(
      [section.label, section.title, section.summary].join(" "),
    );
    const sectionMatches = terms.every((term) => sectionText.includes(term));
    const matchingTopics = section.topics.filter((topic) => {
      const combinedText = `${sectionText} ${topicSearchText(topic)}`;
      return terms.every((term) => combinedText.includes(term));
    });
    const keywordText = normalizeSearchText(section.keywords.join(" "));
    const keywordsMatch = terms.every((term) => keywordText.includes(term));

    if (!sectionMatches && !keywordsMatch && matchingTopics.length === 0) {
      return [];
    }
    return [
      {
        ...section,
        topics:
          sectionMatches || (keywordsMatch && matchingTopics.length === 0)
            ? section.topics
            : matchingTopics,
      },
    ];
  });
}
