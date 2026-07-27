import { createClient } from "@/utils/supabase/server"
import { NextResponse } from "next/server"

function safeDestination(value: string | null): string {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/host"
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const destination = safeDestination(searchParams.get("next"))

  if (!code) {
    return NextResponse.redirect(`${origin}/auth/auth-code-error`)
  }

  const supabase = await createClient()
  const {
    data: { user },
    error
  } = await supabase.auth.exchangeCodeForSession(code)

  if (error || !user) {
    console.error("Authentication callback failed:", error)
    return NextResponse.redirect(`${origin}/auth/auth-code-error`)
  }

  const profileName =
    user.user_metadata?.full_name || user.user_metadata?.name || null

  if (profileName) {
    const { error: profileError } = await supabase
      .from("profile-names")
      .upsert(
        {
          modified_at: new Date().toISOString(),
          user_id: user.id,
          profile_name: profileName
        },
        { onConflict: "user_id" }
      )

    if (profileError) {
      console.error("Unable to update the admin profile name:", profileError)
    }
  }

  const forwardedHost = request.headers.get("x-forwarded-host")
  const destinationOrigin =
    process.env.NODE_ENV === "development" || !forwardedHost
      ? origin
      : `https://${forwardedHost}`

  return NextResponse.redirect(`${destinationOrigin}${destination}`)
}
