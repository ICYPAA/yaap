import "@supabase/functions-js/edge-runtime.d.ts"
import { createClient, type User } from "@supabase/supabase-js"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
}

const supabaseUrl = Deno.env.get("SUPABASE_URL") || ""
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
const discordGuildId = Deno.env.get("DISCORD_GUILD_ID") || ""

type DiscordUser = { id: string }
type DiscordGuildMember = { pending?: boolean; roles?: string[] }

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status
  })
}

function getBearerToken(request: Request): string | null {
  const authHeader = request.headers.get("Authorization")
  return authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length).trim()
    : null
}

function getDiscordIdentityId(user: User): string | null {
  const discordIdentity = user.identities?.find(
    (identity) => identity.provider === "discord"
  )
  const identityData = discordIdentity?.identity_data as
    | Record<string, unknown>
    | undefined
  const candidates = [
    identityData?.sub,
    identityData?.provider_id,
    user.user_metadata?.provider_id,
    user.user_metadata?.sub
  ]

  return (
    candidates.find(
      (candidate): candidate is string =>
        typeof candidate === "string" && candidate.length > 0
    ) ?? null
  )
}

async function getDiscordResource<T>(
  path: string,
  providerToken: string
): Promise<{ data?: T; response: Response }> {
  const response = await fetch(`https://discord.com/api/v10${path}`, {
    headers: { Authorization: `Bearer ${providerToken}` }
  })

  return response.ok
    ? { data: (await response.json()) as T, response }
    : { response }
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405)
  }

  if (!supabaseUrl || !supabaseServiceKey || !discordGuildId) {
    console.error("Discord verification is missing server configuration")
    return jsonResponse({ error: "Discord verification is unavailable" }, 503)
  }

  const accessToken = getBearerToken(request)
  if (!accessToken) {
    return jsonResponse({ error: "Missing Supabase session" }, 401)
  }

  let requestBody: { provider_token?: unknown }
  try {
    requestBody = await request.json()
  } catch {
    return jsonResponse({ error: "Invalid request body" }, 400)
  }

  const providerToken = requestBody.provider_token
  if (typeof providerToken !== "string" || providerToken.length === 0) {
    return jsonResponse({ error: "Missing Discord authorization" }, 400)
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  })
  const {
    data: { user },
    error: authError
  } = await supabase.auth.getUser(accessToken)

  if (authError || !user) {
    return jsonResponse({ error: "Invalid Supabase session" }, 401)
  }

  if (user.app_metadata?.provider !== "discord") {
    return jsonResponse({ error: "Discord sign-in is required" }, 403)
  }

  const expectedDiscordUserId = getDiscordIdentityId(user)
  if (!expectedDiscordUserId) {
    console.error("Discord identity is missing for authenticated user", user.id)
    return jsonResponse({ error: "Discord identity is unavailable" }, 403)
  }

  const currentUserResult = await getDiscordResource<DiscordUser>(
    "/users/@me",
    providerToken
  )
  if (!currentUserResult.data) {
    return jsonResponse(
      { error: "Discord authorization is invalid or expired" },
      currentUserResult.response.status === 401 ? 401 : 502
    )
  }

  if (currentUserResult.data.id !== expectedDiscordUserId) {
    console.warn("Discord identity did not match Supabase identity", user.id)
    return jsonResponse({ error: "Discord account mismatch" }, 403)
  }

  const memberResult = await getDiscordResource<DiscordGuildMember>(
    `/users/@me/guilds/${discordGuildId}/member`,
    providerToken
  )
  const now = new Date().toISOString()

  if (!memberResult.data || memberResult.data.pending) {
    const { error: membershipError } = await supabase
      .from("discord_memberships")
      .upsert(
        {
          user_id: user.id,
          discord_user_id: expectedDiscordUserId,
          guild_id: discordGuildId,
          discord_roles: [],
          is_member: false,
          verified_at: now,
          verification_source: "oauth"
        },
        { onConflict: "user_id" }
      )

    if (membershipError) {
      console.error("Unable to record failed Discord membership", membershipError)
    }

    return jsonResponse(
      {
        error: memberResult.data?.pending
          ? "Complete the Discord server membership screening before signing in"
          : "Join the configured Discord server before signing in"
      },
      403
    )
  }

  const discordRoles = Array.isArray(memberResult.data.roles)
    ? memberResult.data.roles
    : []
  const { error: membershipError } = await supabase
    .from("discord_memberships")
    .upsert(
      {
        user_id: user.id,
        discord_user_id: expectedDiscordUserId,
        guild_id: discordGuildId,
        discord_roles: discordRoles,
        is_member: true,
        verified_at: now,
        verification_source: "oauth"
      },
      { onConflict: "user_id" }
    )

  if (membershipError) {
    console.error("Unable to save Discord membership", membershipError)
    return jsonResponse({ error: "Unable to save Discord membership" }, 500)
  }

  const { error: profileError } = await supabase
    .from("profile-names")
    .update({ discord_roles: discordRoles, modified_at: now })
    .eq("user_id", user.id)

  if (profileError) {
    console.error("Unable to update cached Discord roles", profileError)
  }

  const { error: roleError } = await supabase.from("roles").upsert(
    { user_id: user.id, role: "host", permissions: [] },
    { onConflict: "user_id", ignoreDuplicates: true }
  )

  if (roleError) {
    console.error("Unable to create the default host role", roleError)
    return jsonResponse({ error: "Unable to provision host access" }, 500)
  }

  return jsonResponse({ success: true })
})
