import { NextResponse } from "next/server"
// The client you created from the Server-Side Auth instructions
import { createClient } from "@/utils/supabase/server"

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  // if "next" is in param, use it as the redirect URL
  const next = searchParams.get("next") ?? "/host"

  console.log("code", code)
  console.log("next", next)
  console.log("origin", origin)

  if (code) {
    const supabase = await createClient()
    const {
      data: { user, session },
      error
    } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      // Log session details for debugging
      console.log("Session established:", !!session)
      console.log("User authenticated:", !!user)
      console.log("User ID:", user?.id)

      let guilds: any
      let icypaa_server: any

      try {
        guilds = await fetch(`${user?.user_metadata.iss}/users/@me/guilds`, {
          headers: {
            authorization: `Bearer ${session?.provider_token}`
          }
        }).then((res) => res.json())
      } catch (error) {
        console.error("Error fetching guilds:", error)
      }

      if (guilds) {
        icypaa_server = guilds.find(
          (guild: any) =>
            guild.id === process.env.NEXT_PUBLIC_DISCORD_HOST_SERVER
        )
      } else {
        console.error("No guilds found")
      }

      // Try to update profile if user is in the ICYPAA server
      if (icypaa_server) {
        let server_profile: any
        try {
          server_profile = await fetch(
            `${user?.user_metadata.iss}/users/@me/guilds/${process.env.NEXT_PUBLIC_DISCORD_HOST_SERVER}/member`,
            {
              headers: {
                authorization: `Bearer ${session?.provider_token}`
              }
            }
          ).then((res) => res.json())
        } catch (error) {
          console.error("Error fetching server profile:", error)
        }

        // Log the server profile to see the structure of the response
        console.log("Server profile:", JSON.stringify(server_profile, null, 2))

        // Extract roles from the server profile
        const userRoles = server_profile?.roles || []

        if (server_profile && user?.id) {
          // Update profile-names table with the user's nickname and roles
          const { error: profileError } = await supabase.from("profile-names").upsert(
            {
              modified_at: new Date().toISOString(),
              user_id: user.id,
              profile_name: server_profile?.nick || user?.user_metadata?.full_name || user?.user_metadata?.name,
              discord_roles: userRoles // Store the roles array from Discord
            },
            {
              onConflict: "user_id"
            }
          )
          
          if (profileError) {
            console.error("Error updating profile-names:", profileError)
            // Don't fail the auth flow, just log the error
            // The profile can be updated later
          } else {
            console.log("Profile updated successfully")
          }
        } else {
          console.error("No server profile found, skipping profile update")
        }
      } else {
        console.error("User not in ICYPAA server, but continuing with auth")
      }
      
      // Always redirect on successful auth, regardless of profile update status
      const forwardedHost = request.headers.get("x-forwarded-host") // original origin before load balancer
      const isLocalEnv = process.env.NODE_ENV === "development"

      // Set cookies more explicitly in local environment
      // Let's create response early so we can modify it
      let response

      if (isLocalEnv) {
        // we can be sure that there is no load balancer in between, so no need to watch for X-Forwarded-Host
        console.log("isLocalEnv is true")
        response = NextResponse.redirect(`${origin}${next}`)
      } else if (forwardedHost) {
        console.log("forwardedHost header is present")
        response = NextResponse.redirect(`https://${forwardedHost}${next}`)
      } else {
        console.log("no forwardedHost header, using origin")
        response = NextResponse.redirect(`${origin}${next}`)
      }

      console.log("Returning response")
      return response
    } else {
      console.error("Authentication error:", error)
    }
  } else {
    console.error("No code parameter found in the URL")
  }

  // return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/auth/auth-code-error`)
}
