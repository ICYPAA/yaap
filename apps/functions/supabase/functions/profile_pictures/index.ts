import "@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "@supabase/supabase-js"

// CORS headers to allow cross-origin requests
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-device-id, x-user-token",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS, DELETE"
}

// Get Supabase credentials from environment
const supabaseUrl = Deno.env.get("SUPABASE_URL") || ""
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || ""
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""

// Initialize Supabase client with service role key for admin actions
const supabase = createClient(supabaseUrl, supabaseServiceKey)

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status
  })
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function getBearerToken(request: Request): string | null {
  const authHeader = request.headers.get("Authorization")
  if (!authHeader?.startsWith("Bearer ")) {
    return null
  }

  return authHeader.slice("Bearer ".length).trim()
}

function isPublicAppCredential(request: Request, token: string): boolean {
  const apiKey = request.headers.get("apikey")

  return Boolean(
    apiKey &&
      ((token === apiKey && token === supabaseAnonKey) ||
        apiKey.startsWith("sb_publishable_"))
  )
}

async function authenticateDeviceOwner(
  request: Request,
  deviceId: string
): Promise<Response | null> {
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error("Missing Supabase configuration")
    return jsonResponse({ message: "Internal server error" }, 500)
  }

  const token = getBearerToken(request)
  if (!token) {
    return jsonResponse({ message: "Unauthorized: Missing bearer token" }, 401)
  }

  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("id, user_id")
    .eq("device_id", deviceId)
    .maybeSingle()

  if (profileError) {
    console.error("Error loading profile owner:", profileError)
    return jsonResponse({ message: "Unable to verify profile owner" }, 500)
  }

  if (!profile) {
    return jsonResponse({ message: "Profile not found" }, 404)
  }

  // Attendee profiles are intentionally device-based and do not require an
  // account. The public project key authenticates the app request while the
  // device ID identifies an unlinked attendee profile. Once a profile is
  // linked to an account, only that account's session may change its image.
  if (isPublicAppCredential(request, token)) {
    if (!profile.user_id) {
      return null
    }

    const userToken = request.headers.get("x-user-token")
    if (!userToken) {
      return jsonResponse(
        { message: "Please sign in before updating your profile picture." },
        401
      )
    }

    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser(userToken)

    if (authError || !user) {
      return jsonResponse({ message: "Unauthorized: Invalid session" }, 401)
    }

    return profile.user_id === user.id
      ? null
      : jsonResponse({ message: "Forbidden: Device profile mismatch" }, 403)
  }

  const {
    data: { user },
    error: authError
  } = await supabase.auth.getUser(token)

  if (authError || !user) {
    return jsonResponse({ message: "Unauthorized: Invalid session" }, 401)
  }

  if (profile.user_id && profile.user_id !== user.id) {
    return jsonResponse({ message: "Forbidden: Device profile mismatch" }, 403)
  }

  if (!profile.user_id) {
    const { error: linkError } = await supabase
      .from("users")
      .update({ user_id: user.id })
      .eq("id", profile.id)

    if (linkError) {
      console.error("Error linking profile owner:", linkError)
      return jsonResponse({ message: "Unable to link profile owner" }, 500)
    }
  }

  return null
}

async function handleUpload(
  request: Request,
  deviceId: string
): Promise<Response> {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File

    if (!file) {
      return new Response(JSON.stringify({ error: "No file provided" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400
      })
    }

    // Convert File to ArrayBuffer
    const arrayBuffer = await file.arrayBuffer()
    const fileBuffer = new Uint8Array(arrayBuffer)

    // Upload to Supabase Storage with device_id as filename
    const filePath = `profile-${deviceId}`

    const { error } = await supabase.storage
      .from("profile-images")
      .upload(filePath, fileBuffer, {
        upsert: true,
        contentType: file.type
      })

    if (error) {
      console.error("Error uploading file:", error)
      return new Response(JSON.stringify({ error: error.message }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500
      })
    }

    // Get the public URL for the uploaded image
    const { data: publicUrlData } = supabase.storage
      .from("profile-images")
      .getPublicUrl(filePath)

    if (!publicUrlData || !publicUrlData.publicUrl) {
      console.error("Failed to get public URL")
      return new Response(
        JSON.stringify({ error: "Failed to generate public URL" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500
        }
      )
    }

    // Update user profile with the profile pic URL - using device_id to identify user
    const { error: updateError } = await supabase
      .from("users")
      .update({ profile_image: publicUrlData.publicUrl })
      .eq("device_id", deviceId)

    if (updateError) {
      console.error("Error updating user profile:", updateError)
      return new Response(JSON.stringify({ error: updateError.message }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500
      })
    }

    return new Response(
      JSON.stringify({
        success: true,
        publicUrl: publicUrlData.publicUrl
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    )
  } catch (error) {
    console.error("Error handling upload:", error)
    return new Response(JSON.stringify({ error: getErrorMessage(error) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500
    })
  }
}

async function handleDelete(deviceId: string): Promise<Response> {
  try {
    // Delete the file from storage
    const filePath = `profile-${deviceId}`
    const { error: deleteError } = await supabase.storage
      .from("profile-images")
      .remove([filePath])

    if (deleteError) {
      console.error("Error deleting file:", deleteError)
      return new Response(JSON.stringify({ error: deleteError.message }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500
      })
    }

    // Update user profile to remove profile picture URL
    const { error: updateError } = await supabase
      .from("users")
      .update({ profile_image: null })
      .eq("device_id", deviceId)

    if (updateError) {
      console.error("Error updating user profile:", updateError)
      return new Response(JSON.stringify({ error: updateError.message }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500
      })
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    })
  } catch (error) {
    console.error("Error deleting profile picture:", error)
    return new Response(JSON.stringify({ error: getErrorMessage(error) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500
    })
  }
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    // Get the device ID from the header instead of query param
    const deviceId = req.headers.get("x-device-id")

    if (!deviceId) {
      return new Response(
        JSON.stringify({
          error: "Device ID is required in x-device-id header"
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400
        }
      )
    }

    const authError = await authenticateDeviceOwner(req, deviceId)
    if (authError) {
      return authError
    }

    // Handle different operations based on request method
    if (req.method === "POST") {
      return await handleUpload(req, deviceId)
    } else if (req.method === "DELETE") {
      return await handleDelete(deviceId)
    } else {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 405
      })
    }
  } catch (error) {
    console.error("Unhandled error:", error)
    return new Response(JSON.stringify({ error: getErrorMessage(error) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500
    })
  }
})
