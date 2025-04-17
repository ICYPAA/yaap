export type Activity = {
  // Id of the row
  id: number
  // Program the activities belong to
  program_id: number // Index
  // Activity category
  category: string
  // Name of the activity
  name: string
  // Description of the activity
  description: string
  // Image for the activity
  image?: string
  // Location of the activity
  location: string
  // Distance from the main venue in miles
  distance: number
}

export type Food = {
  // Id of the row
  id: number
  // Program the activities belong to
  program_id: number // Index
  // Activity category
  category: string
  // Name of the activity
  name: string
  // Description of the activity
  description: string
  // Image for the activity
  image?: string
  // Location of the activity
  location: string
  // Distance from the main venue in miles
  distance: number
  // URL to a menu for this food location
  menu?: string
}
