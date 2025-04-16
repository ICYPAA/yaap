import AsyncStorage from "@react-native-async-storage/async-storage"
import { createClient } from "@supabase/supabase-js"
import "react-native-url-polyfill/auto"

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || ""
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || ""

/**
 * Helper function to get device ID from AsyncStorage
 */
export async function getDeviceId(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem("device_id")
  } catch (error) {
    console.error("Error retrieving device ID:", error)
    return null
  }
}

/**
 * Store device ID in AsyncStorage
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
 * Call this before making requests to Supabase that need the device ID.
 *
 * Example:
 * const supabaseWithDeviceId = await withDeviceId()
 * const { data, error } = await supabaseWithDeviceId
 *   .from('users')
 *   .select('*')
 */
export async function withDeviceId(supabaseClient = supabase) {
  // Get device ID directly from AsyncStorage to avoid circular dependency
  let deviceId: string | null = null
  try {
    deviceId = await AsyncStorage.getItem("device_id")
    // console.log("withDeviceId: Got device ID:", deviceId)
  } catch (error) {
    console.error("Error retrieving device ID:", error)
  }

  if (!deviceId) {
    console.warn("No device ID available for headers")
    return supabaseClient
  }

  // Create a new client with the device ID header for this request
  // console.log(
  //   "withDeviceId: Creating new Supabase client with device ID header:",
  //   deviceId
  // )
  return createClient(supabaseUrl, supabaseAnonKey, {
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
}
