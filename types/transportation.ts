export type Transportation = {
  // Id of the row
  id: number
  // Program the transportation belongs to
  program_id: number // Index
  // Maps
  maps: {
    // Name of the map
    name: string
    // URL of the map image
    url: string
    // Description of the map
    description: string
  }[]
  // Travel details
  travel_details: {
    // Name of the travel detail
    name: string
    // Description of the travel detail
    description: string
  }[]
}
