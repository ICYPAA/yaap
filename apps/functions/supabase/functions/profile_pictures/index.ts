import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7"

// CORS headers to allow cross-origin requests
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-device-id",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS, DELETE"
}

// Get Supabase credentials from environment
const supabaseUrl = Deno.env.get("SUPABASE_URL") || ""
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""

// Initialize Supabase client with service role key for admin actions
const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function handleUpload(
  request: Request,
  deviceId: string
): Promise<Response> {
  try {
    console.log("Processing upload for device ID:", deviceId)
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
    console.log("Uploading to storage path:", filePath)

    const { data, error } = await supabase.storage
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

    console.log("Generated public URL:", publicUrlData)

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
    console.log(
      "Updating user profile with image URL:",
      publicUrlData.publicUrl
    )
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

    // Return the successful response with the public URL
    console.log("Successfully processed profile picture upload")
    return new Response(
      JSON.stringify({
        success: true,
        publicUrl: publicUrlData.publicUrl
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    )
  } catch (error: any) {
    console.error("Error handling upload:", error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500
    })
  }
}

async function handleDelete(deviceId: string): Promise<Response> {
  try {
    console.log("Processing delete for device ID:", deviceId)

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
  } catch (error: any) {
    console.error("Error deleting profile picture:", error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500
    })
  }
}

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    console.log("Starting request")
    // Check for basic auth
    const authHeader = req.headers.get("Authorization")
    console.log("Auth header:", authHeader)
    if (!authHeader || !authHeader.startsWith("Basic ")) {
      return new Response(
        JSON.stringify({
          message: "Unauthorized: Missing or invalid authorization"
        }),
        {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json"
          },
          status: 401
        }
      )
    }

    console.log("Checking creds")
    // Decode and verify basic auth
    const base64Credentials = authHeader.split(" ")[1]
    const credentials = atob(base64Credentials)
    const expectedAuth = `yaap:${Deno.env.get("EDGE_PASSWORD")}`
    console.log("Expected:", expectedAuth)
    console.log("Actual:", credentials)
    if (credentials !== expectedAuth) {
      return new Response(
        JSON.stringify({
          message: "Unauthorized: Invalid credentials"
        }),
        {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json"
          },
          status: 401
        }
      )
    }

    console.log("Getting device ID")
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

    console.log("Processing request for device ID:", deviceId)
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
  } catch (error: any) {
    console.error("Unhandled error:", error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500
    })
  }
})
