import { supabase } from "./supabase"

// Simple mock response type
interface SupabaseResponse {
  data: any
  error: Error | null
  count?: number
}

// Mock data for different types of requests in debug mode
const mockData: Record<string, any[]> = {
  profiles: [
    {
      id: "123",
      full_name: "Debug User",
      email: "debug@example.com",
      role: "host",
      created_at: new Date().toISOString()
    }
  ],
  accessibility_requests: [
    {
      id: "1",
      user_id: "123",
      request_type: "mobility",
      details: "Need accessible seating",
      request_details: "Need accessible seating near the front",
      status: "pending",
      created_at: new Date().toISOString(),
      profiles: {
        full_name: "Debug User",
        email: "debug@example.com"
      }
    },
    {
      id: "2",
      user_id: "123",
      request_type: "hearing",
      details: "Need sign language interpreter",
      request_details: "Need sign language interpreter for main meeting",
      status: "in_progress",
      created_at: new Date(Date.now() - 86400000).toISOString(), // yesterday
      profiles: {
        full_name: "Debug User",
        email: "debug@example.com"
      }
    }
  ],
  ride_requests: [
    {
      id: "1",
      user_id: "123",
      pickup_location: "Airport",
      dropoff_location: "Hotel",
      status: "pending",
      created_at: new Date().toISOString()
    }
  ],
  volunteer_signups: [
    {
      id: "1",
      user_id: "123",
      role: "greeter",
      time_slot: "Friday 2-4pm",
      status: "pending",
      created_at: new Date().toISOString()
    }
  ],
  hospitality_notifications: [
    {
      id: "1",
      title: "Coffee Available",
      message: "Fresh coffee is now available in the hospitality room",
      status: "pending",
      created_at: new Date().toISOString()
    }
  ],
  support_chats: [
    {
      id: "1",
      user_id: "123",
      message: "Need help finding the main meeting room",
      status: "unread",
      created_at: new Date().toISOString()
    }
  ]
}

// Helper function for debug mode to emulate Supabase responses
function createMockResponse(table: string, count = false): SupabaseResponse {
  const tableData = mockData[table] || []
  return {
    data: tableData,
    error: null,
    ...(count ? { count: tableData.length } : {})
  }
}

// Generic request helper function
export async function makeRequest({
  table,
  isDebugMode = false,
  query = () => supabase.from(table).select("*")
}: {
  table: string
  isDebugMode: boolean
  query: () => any
}): Promise<SupabaseResponse> {
  if (isDebugMode) {
    console.log(`DEBUG MODE: Mock request to ${table}`)
    return createMockResponse(table)
  }

  try {
    const response = await query()
    return response
  } catch (error) {
    console.error(`Error making request to ${table}:`, error)
    return { data: null, error: error as Error }
  }
}

// Helper for count queries
export async function makeCountRequest({
  table,
  isDebugMode = false,
  query = () => supabase.from(table).select("*", { count: "exact", head: true })
}: {
  table: string
  isDebugMode: boolean
  query: () => any
}): Promise<{ count: number; error: Error | null }> {
  if (isDebugMode) {
    console.log(`DEBUG MODE: Mock count request to ${table}`)
    const mockResponse = createMockResponse(table, true)
    return { count: mockResponse.count || 0, error: null }
  }

  try {
    const { count, error } = await query()
    return { count: count || 0, error }
  } catch (error) {
    console.error(`Error making count request to ${table}:`, error)
    return { count: 0, error: error as Error }
  }
}
