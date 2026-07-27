import { createServerClient } from "@supabase/ssr"
import { type NextRequest, NextResponse } from "next/server"

export const updateSession = async (request: NextRequest) => {
  // This `try/catch` block is only here for the interactive tutorial.
  // Feel free to remove once you have Supabase connected.
  try {
    // Create an unmodified response
    let response = NextResponse.next({
      request: {
        headers: request.headers
      }
    })

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(
            cookiesToSet: Array<{
              name: string
              value: string
              options?: Record<string, unknown>
            }>
          ) {
            cookiesToSet.forEach(({ name, value }) =>
              request.cookies.set(name, value)
            )
            response = NextResponse.next({
              request
            })
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(
                name,
                value,
                options as Parameters<typeof response.cookies.set>[2]
              )
            )
          }
        }
      }
    )

    // This will refresh session if expired - required for Server Components
    // https://supabase.com/docs/guides/auth/server-side/nextjs

    // Get the session first
    const { data: sessionData, error: sessionError } =
      await supabase.auth.getSession()

    if (sessionError && process.env.NODE_ENV === "development") {
      console.error("Session error in middleware:", sessionError)
    }

    // Check if there's a session before trying to get the user
    let user = null
    if (sessionData?.session) {
      // Only try to get the user if we have a session
      const { data, error } = await supabase.auth.getUser()
      user = data?.user
      if (error) {
        console.error("Error getting authenticated user:", error)
        // Fall back to session user if getUser fails
        user = sessionData?.session?.user
      }
    }

    // Add debug info to development
    if (process.env.NODE_ENV === "development") {
      const requestUrl = request.nextUrl.pathname
      console.log(`[AUTH DEBUG] Path: ${requestUrl}`)
      console.log(`[AUTH DEBUG] Session exists: ${!!sessionData?.session}`)
      console.log(`[AUTH DEBUG] User exists: ${!!user}`)

      // Check cookies for debug purposes
      const authCookies = request.cookies
        .getAll()
        .filter((cookie) => cookie.name.startsWith("sb-"))
        .map((cookie) => cookie.name)

      console.log(
        `[AUTH DEBUG] Auth cookies: ${authCookies.join(", ") || "none"}`
      )
    }

    return response
  } catch (e) {
    // If you are here, a Supabase client could not be created!
    // This is likely because you have not set up environment variables.
    // Check out http://localhost:3000 for Next Steps.
    console.error("Error in middleware:", e)
    return NextResponse.next({
      request: {
        headers: request.headers
      }
    })
  }
}
