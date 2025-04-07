export type User = {
  // Id of the row
  id: number
  // Device id
  device_id: string
  // First name
  first_name: string
  // Last initial
  last_initial: string
  // Profile image
  profile_image: string
  // Saved schedule for the user
  schedule: Schedule
  // Settings for the user
  settings: {
    notifications: boolean
    schedule_notifications: boolean
    event_notifications: boolean
    main_meeting_notifications: boolean
    game_notifications: boolean
    hospitality_notifications: boolean
  }
  // Link to host/advisory member account if applicable
  user_id?: string
}

export type Schedule = {
  // Id of events that are saved
  saved_events: number[]
  // Id of users that you have shared your schedule with
  shared_with: number[]
  // Id of users that have shared their schedule with you
  shared_by: number[]
}
