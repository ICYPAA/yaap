"use client"

import { createClient } from "./client"

/**
 * Utility function to debug Supabase authentication state
 * Call this function from a client component to check the auth state
 */
export async function debugAuthState() {
  const supabase = createClient()

  // Check session
  const { data: sessionData, error: sessionError } =
    await supabase.auth.getSession()
  console.log("Session Data:", sessionData)
  if (sessionError) {
    console.error("Session Error:", sessionError)
  }

  // Check user
  const { data: userData, error: userError } = await supabase.auth.getUser()
  console.log("User Data:", userData)
  if (userError) {
    console.error("User Error:", userError)
  }

  // Check cookies
  const cookies = document.cookie.split(";").reduce(
    (acc, cookie) => {
      const [key, value] = cookie.trim().split("=")
      if (key.startsWith("sb-")) {
        acc[key] = value
      }
      return acc
    },
    {} as Record<string, string>
  )

  console.log("Supabase Cookies:", cookies)

  return {
    session: sessionData,
    user: userData,
    cookies
  }
}
