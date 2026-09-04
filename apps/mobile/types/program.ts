export type Program = {
  // Id of the program
  id: number
  // Title of the conference
  title: string
  // Description of the conference
  description: string
  // Image for the conference
  logo?: string
  // Start date of the conference
  start_date: string
  // End date of the conference
  end_date: string
  // IANA timezone for all conference-local dates and times
  timezone: string
  // Location of the conference
  location: {
    name: string
    address: {
      street: string
      suite: string
      city: string
      state: string
      zip: string
    }
  }
  // Venue rooms where events are held
  venue_rooms: string[]
  // Hospitality details
  hospitality?: {
    location?: string
    times?: {
      day: string
      start_time: string
      end_time: string
    }[]
  } | null
  // The conference theme
  theme: string
  // Passage from the Big Book
  big_book_passage: string
  // Conference design
  design: ConferenceDesign
  // Reference to the events that are promoted
  promote?: number[]
  // Content to override in the app
  content?: ProgramContent
  // Conference-specific safety policy content
  ndah_content?: NDAHContent | null
}

export type NDAHContent = {
  safety_statement?: string
  anti_harassment_short?: string
  anti_discrimination_short?: string
  ndah_link?: string
  report_crime?: {
    info?: string
    emergency_number?: string
    non_emergency_number?: string
  }
  committee_contact?: {
    info?: string
    contact?: string
  }
}

export type Event = {
  // Id of the event
  id: number
  // Title of the event
  title: string
  // Description of the event
  description: string
  // Image for the event
  image?: string
  // Day the event is on
  date: string
  // Start time of the event
  start_time: string
  // End time of the event
  end_time: string
  // Location of the event within the venue
  location: string
  // Type of event
  type: EventCategory
  // Whether the event can be saved to the user's schedule
  can_save: boolean
  // Speakers for the event
  speakers: string[]
  // Program the event belongs to
  program_id: number // Index
  // Foreign key to event category
  event_category_id: number
  // Optional nested category data from Supabase join
  event_categories?: {
    title: string
    color: string
  } | null
  // Optional link for promoted events
  link?: string
  // Optional CTA link for event details modal
  cta_link?: string
  // Accessibility and service features
  asl?: boolean // American Sign Language interpretation
  hybrid?: boolean // Hybrid meeting (in-person + virtual)
  languages?: string[] // Language translations available (e.g., ["ES", "SOM", "HMN"])
  services?: {
    asl?: boolean
    spanish?: boolean
    french?: boolean
    hmong?: boolean
    somali?: boolean
    hybrid?: boolean
    childcare?: boolean
    wheelchair?: boolean
  }
}

export type EventCategory = {
  // Id of the event category
  id: number
  // Title of the event category
  title: string
  // Color of the event category
  color: string
  // Program the event belongs to
  program_id: number // Index
}

// TODO
export type ConferenceDesign = {
  colors?: {
    info?: string
    error?: string
    primary?: string
    success?: string
    warning?: string
    secondary?: string
    primaryDark?: string
    secondaryDark?: string
  }
  font?: {
    family?: string
  }
}

export type ProgramContent = {
  // Services to override
  services?: {
    rides?: {
      // Title of the service
      title?: string
      // Content of the service
      description?: string
      // Content for the service's page
      internal_description?: string
    }
    hospitality?: {
      // Title of the service
      title?: string
      // Content of the service
      description?: string
      // Content for the service's page
      internal_description?: string
    }
    volunteering?: {
      // Title of the service
      title?: string
      // Content of the service
      description?: string
      // Content for the service's page
      internal_description?: string
      // Whether the service card opens the in-app form or SignUpGenius
      signup_destination?: "internal" | "external"
      // HTTPS SignUpGenius link used when signup_destination is external
      external_signup_url?: string
    }
    accessibility?: {
      // Title of the service
      title?: string
      // Content of the service
      description?: string
      // Content for the service's page
      internal_description?: string
    }
    support?: {
      // Title of the service
      title?: string
      // Content of the service
      description?: string
    }
  }
  faq?: {
    question: string
    answer: string
  }[]
}
