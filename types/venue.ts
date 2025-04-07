export type Venue = {
  // Id of the row
  id: number
  // Program the venue belongs to
  program_id: number // Index
  // Floors in the venue
  floors: {
    // Name of the floor
    name: string
    // Map of the floor
    url: string
    // Description of the floor
    description: string
  }[]
  amenities: {
    // Name of the amenity
    name: string
    // Description of the amenity
    description: string
  }[]
}
