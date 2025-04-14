import AsyncStorage from "@react-native-async-storage/async-storage"
import { createClient } from "@supabase/supabase-js"
import "react-native-url-polyfill/auto"

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || ""
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || ""

// Create the Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false
  }
})

// Helper function to get device ID from AsyncStorage
export async function getDeviceId(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem("device_id")
  } catch (error) {
    console.error("Error retrieving device ID:", error)
    return null
  }
}

// Use this function to add the device ID header to your requests
export async function addDeviceIdHeader() {
  const deviceId = await getDeviceId()
  const headers: Record<string, string> = {}

  if (deviceId) {
    headers["x-device-id"] = deviceId
  }

  return headers
}
