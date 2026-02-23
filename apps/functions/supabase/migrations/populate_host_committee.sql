-- Update program with ID 3 to include the host committee data
UPDATE programs
SET host_committee = '{
  "Steering Committee": [
    {"name": "Jared H.", "role": "Chair"},
    {"name": "Jimmy B.", "role": "Co-Chair"},
    {"name": "Danielle J.", "role": "Program Chair"},
    {"name": "Dan K.", "role": "Facilities Chair"},
    {"name": "Lydia S.", "role": "Treasurer"},
    {"name": "Jamie K.", "role": "Outreach Chair"},
    {"name": "Laya W.", "role": "Registration Chair"},
    {"name": "Ting W.", "role": "Secretary"},
    {"name": "Kevin O.", "role": "Service Liaison Chair"}
  ],
  "Program Subcommittee": [
    {"name": "Kyle H.", "role": "Program Co-Chair"},
    {"name": "Bridgette M.", "role": "Speaker Researcher"},
    {"name": "Cam G.", "role": "Panelist Researcher"},
    {"name": "Caitlyn P.", "role": "Panelist Researcher Co-Chair"},
    {"name": "Luke", "role": "Marathon Meeting Chair"}
  ],
  "Entertainment Subcommittee": [
    {"name": "Bella O.", "role": "Entertainment Chair"},
    {"name": "Annelise", "role": "Entertainment Co-Chair"},
    {"name": "Henry H.", "role": "Pre-Conference Event Chair"},
    {"name": "Grace L.", "role": "Events Chair"},
    {"name": "Akaelyn A.", "role": "Events Co-Chair"}
  ],
  "Facilities Subcommittee": [
    {"name": "Alex F.", "role": "Facilities Co-Chair"},
    {"name": "George S.", "role": "Audio/Visual Chair"},
    {"name": "Pierce D.", "role": "Audio/Visual Co-Chair"},
    {"name": "Tom H.", "role": "Security Chair"},
    {"name": "Charlie M.", "role": "Hospitality Chair"},
    {"name": "Takoda S.", "role": "Hospitality Co-Chair"},
    {"name": "Praveen W.", "role": "Signage Chair"},
    {"name": "Jonah P.", "role": "Accessibility Chair"},
    {"name": "Hanock M.", "role": "Clean Up & Room Facilitator"}
  ],
  "Outreach Subcommittee": [
    {"name": "Tom H.", "role": "Outreach Co-Chair"},
    {"name": "Lucy W.", "role": "Minnesota Outreach Chair"},
    {"name": "Abbey F.", "role": "National Outreach Chair"},
    {"name": "Ami F.", "role": "International Outreach Chair"},
    {"name": "Alexa N.", "role": "LGBTQIA+ Outreach Chair"},
    {"name": "Jinx M.", "role": "LGBTQIA+ Outreach Co-Chair"},
    {"name": "Tannen H.", "role": "Social Media Chair"}
  ],
  "Registration Subcommittee": [
    {"name": "Jake S.", "role": "Registration Co-Chair"},
    {"name": "Steph R.", "role": "Arts, Graphics, and Print Chair"},
    {"name": "JP B.", "role": "Arts, Graphics, and Print Co-Chair"},
    {"name": "Lydia E.", "role": "Merchandise Chair"},
    {"name": "Cornell Z.", "role": "Greeter Chair"},
    {"name": "Josh B.", "role": "TC Information & Concessions Chair"}
  ],
  "Service Liaison Subcommittee": [
    {"name": "Alex S.", "role": "Service Liaison Co-Chair"},
    {"name": "Emery C.", "role": "General Service Liaison"},
    {"name": "Curtis R.", "role": "Public Information/CPC Chair"},
    {"name": "Daniel", "role": "Literature Chair"}
  ],
  "Other": [
    {"name": "Avram L.", "role": "Co-Treasurer"},
    {"name": "May D.", "role": "Co-Secretary"},
    {"name": "Brendan C.", "role": "Archivist"},
    {"name": "Dasha B.", "role": "Archives Photographer"},
    {"name": "Josh G.", "role": "IT Chair"},
    {"name": "Zach B.", "role": "IT Co-Chair"},
    {"name": "Noah C.", "role": "Calendar Chair"}
  ]
}'::jsonb
WHERE id = 3;