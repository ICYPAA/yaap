import AsyncStorage from "@react-native-async-storage/async-storage"
import { createClient } from "@supabase/supabase-js"
import "react-native-url-polyfill/auto"
import { getOrCreateDeviceId } from "./security/deviceId"
import { withRateLimit } from "./security/rateLimiter"

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || ""
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || ""

/**
 * Helper function to get device ID from AsyncStorage
 * Now uses secure device ID generation from security module
 */
export async function getDeviceId(): Promise<string | null> {
  try {
    return await getOrCreateDeviceId()
  } catch (error) {
    console.error("Error retrieving device ID:", error)
    return null
  }
}

/**
 * Store device ID in AsyncStorage
 * @deprecated Use getOrCreateDeviceId() instead - it handles storage automatically
 */
export async function storeDeviceId(deviceId: string): Promise<void> {
  try {
    await AsyncStorage.setItem("device_id", deviceId)
  } catch (error) {
    console.error("Error storing device ID:", error)
  }
}

/**
 * Create the Supabase client
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false
  },
  global: {
    headers: {
      "x-device-id": ""
    }
  }
})

/**
 * A middleware function that adds the device ID to the request headers.
 * Now includes rate limiting for API protection.
 * Call this before making requests to Supabase that need the device ID.
 *
 * Example:
 * const supabaseWithDeviceId = await withDeviceId()
 * const { data, error } = await supabaseWithDeviceId
 *   .from('users')
 *   .select('*')
 * 
 * With rate limiting for specific endpoints:
 * const supabaseWithDeviceId = await withDeviceId(supabase, '/schedule/share')
 */
export async function withDeviceId(supabaseClient = supabase, endpoint?: string) {
  // Get secure device ID
  let deviceId: string | null = null
  try {
    deviceId = await getOrCreateDeviceId()
  } catch (error) {
    console.error("Error retrieving device ID:", error)
  }

  if (!deviceId) {
    console.warn("No device ID available for headers")
    return supabaseClient
  }

  // Create a new client with the device ID header
  const clientWithDeviceId = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false
    },
    global: {
      headers: {
        "x-device-id": deviceId
      }
    }
  })

  // Apply rate limiting if endpoint is specified
  if (endpoint) {
    return withRateLimit(endpoint, async () => clientWithDeviceId, deviceId)
      .then(client => client)
      .catch(error => {
        console.error(`Rate limit exceeded for ${endpoint}:`, error)
        throw error
      })
  }

  return clientWithDeviceId
}
