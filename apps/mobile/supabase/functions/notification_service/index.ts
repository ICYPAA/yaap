// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"
// --- Helper Function: Map event type to the setting key ---
function getNotificationSettingKey(eventType) {
  switch (eventType) {
    case "schedule":
      return "schedule_notifications"
    case "event":
      return "event_notifications"
    case "main_meeting":
      return "main_meeting_notifications"
    case "game":
      return "game_notifications"
    case "hospitality":
      return "hospitality_notifications"
    case "support":
      return "placeholder"
    case "host":
      return "placeholder"
    // Add more event types and their corresponding setting keys here
    default:
      console.warn(
        `Unknown event_type received for setting key lookup: ${eventType}`
      )
      return null
  }
}
// --- Helper Function: Get Title, Body, and Base Data for Notification ---
function getNotificationContent(eventType, programId, requestData) {
  let title = ""
  let body = ""
  // Base data includes eventType and programId, useful for app routing/handling
  const baseData = {
    event_type: eventType,
    program_id: programId,
    // Add user_id to base data if it exists in requestData, might be useful client-side
    ...(requestData?.user_id && {
      target_user_id: requestData.user_id
    })
  }
  // --- Define content per event type ---
  switch (eventType) {
    case "schedule":
      title = "Schedule Sharing"
      body =
        requestData.status === "requested"
          ? `${requestData.user.first_name} ${requestData.user.last_initial} requested to follow your schedule.`
          : `${requestData.user.first_name} ${requestData.user.last_initial} accepted your follow.`
      break
    case "event":
      title = "Event Starting!"
      body = `${requestData.event_title} is starting soon.`
      break
    case "main_meeting":
      title = "Meeting Reminder!"
      body = `The main meeting is starting soon. See details in the app.`
      break
    case "game":
      title = requestData.title
      body = requestData.message
      break
    case "hospitality":
      title = "Hospitality Update!"
      body = requestData.item_description
      break
    case "support":
      title = requestData.title
      body = requestData.message
      break
    case "host":
      if (requestData.type && requestData.type === "general") {
        title = requestData.title
        body = requestData.message
      } else {
        title = "Host"
        body =
          requestData.type === "support"
            ? `New support message for chat ${requestData.title}`
            : "New host form submitted"
      }
      break
    // Add more cases for other event types
    default:
      console.warn(`Cannot get content for unknown event_type: ${eventType}`)
      return null // Event type not configured for content
  }
  // Merge baseData with optional requestData. requestData will override baseData keys if they conflict.
  // Filter out user_id from requestData before merging if it exists, as it's handled separately in baseData if needed
  const { user_id, ...otherRequestData } = requestData || {}
  const finalData = {
    ...baseData,
    ...otherRequestData
  }
  return {
    title,
    body,
    data: finalData
  }
}
// --- Helper Function: Send Notifications via Expo API ---
async function sendExpoNotifications(messages) {
  if (messages.length === 0) {
    console.log("No messages to send.")
    // Return 200 OK, but indicate no one was notified
    return new Response(
      JSON.stringify({
        success: true,
        message:
          "No users opted in, met criteria, or qualified for this notification type."
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json"
        }
      }
    )
  }
  console.log(`Attempting to send ${messages.length} notification(s).`)
  
  // Split messages into batches of 100 (Expo API limit)
  const BATCH_SIZE = 100
  const batches = []
  for (let i = 0; i < messages.length; i += BATCH_SIZE) {
    batches.push(messages.slice(i, i + BATCH_SIZE))
  }
  
  console.log(`Split into ${batches.length} batch(es) of up to ${BATCH_SIZE} notifications each.`)
  
  let totalSuccessful = 0
  let totalFailed = 0
  const allResponses = []
  
  // Send each batch with delay between batches to avoid rate limiting
  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex]
    console.log(`Sending batch ${batchIndex + 1}/${batches.length} with ${batch.length} notifications...`)
    
    // Add delay between batches to avoid hitting rate limit (except for first batch)
    if (batchIndex > 0) {
      console.log(`Waiting 250ms before sending next batch to avoid rate limit...`)
      await new Promise(resolve => setTimeout(resolve, 250))
    }
    
    try {
      const response = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Accept-encoding": "gzip, deflate",
          "Content-Type": "application/json"
        },
        body: JSON.stringify(batch)
      })
      const responseBody = await response.json()
      
      if (!response.ok) {
        console.error(`Batch ${batchIndex + 1} failed:`, response.status, responseBody)
        // Continue with other batches even if one fails
        totalFailed += batch.length
        allResponses.push({
          batch: batchIndex + 1,
          success: false,
          error: responseBody
        })
        continue
      }
      
      console.log(`Batch ${batchIndex + 1} response:`, responseBody)
      
      const successfulSends =
        responseBody.data?.filter((receipt) => receipt.status === "ok").length ?? 0
      const failedSends = batch.length - successfulSends
      
      totalSuccessful += successfulSends
      totalFailed += failedSends
      
      // Log receipts with errors for debugging
      responseBody.data?.forEach((receipt: any) => {
        if (receipt.status !== "ok") {
          console.warn(
            `Notification failed for token ${
              receipt.__debug?.sentTo ?? "UNKNOWN"
            }: ${receipt.message} (${receipt.details?.error})`
          )
        }
      })
      
      allResponses.push({
        batch: batchIndex + 1,
        success: true,
        data: responseBody
      })
      
    } catch (error) {
      console.error(`Error sending batch ${batchIndex + 1}:`, error)
      totalFailed += batch.length
      allResponses.push({
        batch: batchIndex + 1,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      })
    }
  }
  
  // Return overall results
  const overallSuccess = totalFailed === 0
  return new Response(
    JSON.stringify({
      success: overallSuccess,
      message: `Notifications sent. Total Successful: ${totalSuccessful}, Total Failed/Skipped: ${totalFailed}. Processed ${batches.length} batch(es).`,
      details: {
        batches: batches.length,
        totalMessages: messages.length,
        successful: totalSuccessful,
        failed: totalFailed,
        batchResponses: allResponses
      }
    }),
    {
      status: overallSuccess ? 200 : 207, // 207 Multi-Status for partial success
      headers: {
        "Content-Type": "application/json"
      }
    }
  )
}
// --- Main Edge Function ---
Deno.serve(async (req) => {
  const requestTimestamp = new Date().toISOString()
  console.log(`Received request at: ${requestTimestamp}`)
  let supabase
  try {
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
            "Content-Type": "application/json"
          },
          status: 401
        }
      )
    }
    // 1. Parse Request Body
    if (
      req.headers.get("content-type")?.toLocaleLowerCase() !==
      "application/json"
    ) {
      return new Response(
        JSON.stringify({
          message: "Bad Request: Content-Type must be application/json"
        }),
        {
          status: 415,
          headers: {
            "Content-Type": "application/json"
          }
        }
      )
    }
    // Destructure expected fields and optional 'data' and potentially 'user_id'
    const {
      program_id,
      event_type,
      user_id,
      data: requestData
    } = await req.json()
    // Basic input validation
    if (!program_id || !event_type) {
      return new Response(
        JSON.stringify({
          message: "Bad Request: program_id and event_type are required"
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json"
          }
        }
      )
    }
    if (typeof program_id !== "number" || typeof event_type !== "string") {
      return new Response(
        JSON.stringify({
          message:
            "Bad Request: program_id must be a number and event_type must be a string"
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json"
          }
        }
      )
    }
    // --- *** NEW: Conditional validation for user_id when event_type is 'schedule' *** ---
    if (event_type === "schedule") {
      if (!user_id) {
        return new Response(
          JSON.stringify({
            message:
              'Bad Request: user_id is required when event_type is "schedule"'
          }),
          {
            status: 400,
            headers: {
              "Content-Type": "application/json"
            }
          }
        )
      }
      if (typeof user_id !== "number") {
        return new Response(
          JSON.stringify({
            message:
              'Bad Request: user_id must be a number when event_type is "schedule"'
          }),
          {
            status: 400,
            headers: {
              "Content-Type": "application/json"
            }
          }
        )
      }
      console.log(
        `Processing 'schedule' notification targeted at user_id: ${user_id}`
      )
    } else if (user_id) {
      // Optional: Warn if user_id is provided for non-schedule types where it's ignored for targeting
      console.warn(
        `user_id ('${user_id}') provided for event_type '${event_type}', but it will only be used for 'schedule' type targeting.`
      )
    }
    // Validate optional requestData - must be an object if provided
    if (
      requestData !== undefined &&
      (typeof requestData !== "object" ||
        requestData === null ||
        Array.isArray(requestData))
    ) {
      return new Response(
        JSON.stringify({
          message:
            'Bad Request: Optional field "data" must be a JSON object if provided.'
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json"
          }
        }
      )
    }
    console.log(
      `Processing notification for program_id: ${program_id}, event_type: ${event_type}, requestData: ${JSON.stringify(
        requestData
      )}`
    )
    // 2. Initialize Supabase Client (using Service Role Key)
    const supabaseUrl = Deno.env.get("SUPABASE_URL")
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
    if (!supabaseUrl || !supabaseServiceRoleKey) {
      console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
      return new Response(
        JSON.stringify({
          message: "Internal Server Error: Missing Supabase configuration"
        }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json"
          }
        }
      )
    }
    supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {})
    // --- *** NEW: Conditional User Fetching Logic *** ---
    let usersToQuery = []
    let fetchError = null
    if (event_type === "schedule") {
      // Fetch the specific user passed in the request
      console.log(
        `Workspaceing specific user ${user_id} for schedule notification...`
      )
      const { data: specificUserData, error: specificUserError } =
        await supabase
          .from("users")
          .select("id, expo_push_token, settings")
          .eq("id", user_id) // Target the specific user ID
          .not("expo_push_token", "is", null) // Still ensure they have a token
          .not("expo_push_token", "eq", "")
      usersToQuery = specificUserData || [] // Ensure users is an array, even if 0 or 1 result
      fetchError = specificUserError
    } else if (event_type === "support") {
      const { data: specificUserData, error: specificUserError } =
        await supabase
          .from("users")
          .select("id, expo_push_token, settings")
          .eq("device_id", requestData.device_id) // Target the specific user ID
          .not("expo_push_token", "is", null) // Still ensure they have a token
          .not("expo_push_token", "eq", "")
      usersToQuery = specificUserData || [] // Ensure users is an array, even if 0 or 1 result
      fetchError = specificUserError
    } else if (event_type === "host") {
      if (requestData.type && requestData.type === "general") {
        const { data: allUsersData, error: allUsersError } = await supabase
          .from("users")
          .select("id, expo_push_token, settings") // Select needed columns
          .eq("settings->>notifications", "true") // Check general notification setting
          .not("expo_push_token", "is", null) // Ensure push token exists
          .not("expo_push_token", "eq", "") // Ensure push token is not empty
        usersToQuery = allUsersData || []
        fetchError = allUsersError
      } else {
        // Modified logic: Fetch users with general notifications enabled,
        // a valid push token, AND a defined user_id.
        console.log(
          "Fetching users with notifications enabled, valid token, and defined user_id..."
        )
        const { data: allUsersData, error: allUsersError } = await supabase
          .from("users")
          .select("id, expo_push_token, settings") // Select needed columns
          .eq("settings->>notifications", "true") // Check general notification setting
          .not("expo_push_token", "is", null) // Ensure push token exists
          .not("expo_push_token", "eq", "") // Ensure push token is not empty
          .not("user_id", "is", null) // *** NEW: Ensure user_id is defined (not null) ***
        // The rest of your logic remains the same
        usersToQuery = allUsersData || []
        fetchError = allUsersError
      }
    } else {
      // Original logic: Fetch all users with general notifications enabled for other event types
      console.log("Fetching users with general notifications enabled...")
      const { data: allUsersData, error: allUsersError } = await supabase
        .from("users")
        .select("id, expo_push_token, settings")
        .eq("settings->>notifications", "true") // General setting check
        .not("expo_push_token", "is", null)
        .not("expo_push_token", "eq", "")
      usersToQuery = allUsersData || []
      fetchError = allUsersError
    }
    // --- *** End of Conditional User Fetching Logic *** ---
    // 3. Handle Fetch Errors
    if (fetchError) {
      console.error("Supabase fetch error:", fetchError)
      // Distinguish between client error (e.g., invalid UUID format for user_id) vs server error
      const status = fetchError.code?.startsWith("22P") ? 400 : 500 // Example: 22P02 is invalid text representation for UUID
      return new Response(
        JSON.stringify({
          success: false,
          message: `Supabase fetch error: ${fetchError.message}`,
          code: fetchError.code
        }),
        {
          status: status,
          headers: {
            "Content-Type": "application/json"
          }
        }
      )
    }
    // 4. Handle No Users Found (Applies to both single user and multi-user fetch)
    if (!usersToQuery || usersToQuery.length === 0) {
      const message =
        event_type === "schedule"
          ? `Target user ${user_id} not found or has no valid push token.`
          : "No users found with general notifications enabled or valid push tokens."
      console.log(message)
      return new Response(
        JSON.stringify({
          success: true,
          message: message
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json"
          }
        }
      )
    }
    console.log(
      `Found ${usersToQuery.length} potential user(s) after initial fetch.`
    )
    // 5. Filter Users by Specific Event Type Notification Setting (This logic remains the same)
    const settingKey = getNotificationSettingKey(event_type)
    if (!settingKey) {
      // This case should ideally be caught earlier if event_type is unknown, but keep as safety net
      return new Response(
        JSON.stringify({
          message: `Bad Request: Unsupported event_type '${event_type}' for notification settings`
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json"
          }
        }
      )
    }
    const filteredUsers = usersToQuery.filter((user: any) => {
      // Check if the specific notification type (e.g., 'schedule_notifications') is explicitly true
      const specificSettingEnabled =
        event_type !== "host" && event_type !== "support"
          ? user.settings?.[settingKey] === true
          : true // Check for explicit true
      // Check if the general notifications setting is also true (might be redundant if fetched correctly, but safe)
      const generalSettingEnabled = user.settings?.notifications === true // Or user.settings?.['notifications'] === true
      // Validate token format (prevents sending to malformed tokens)
      const isValidToken =
        typeof user.expo_push_token === "string" &&
        user.expo_push_token.startsWith("ExponentPushToken[")
      if (!isValidToken && specificSettingEnabled && generalSettingEnabled) {
        // Log if a user *should* receive it based on settings but has a bad token
        console.warn(
          `User ${user.id} opted in for ${settingKey} but has invalid or missing expo_push_token: ${user.expo_push_token}`
        )
      }
      // For 'schedule' type, we also implicitly checked general settings via the fetch if we didn't change that part.
      // Keep the check here for consistency and safety for all types.
      // User must have general notifications ON, *and* specific notification type ON, *and* a valid token.
      return generalSettingEnabled && specificSettingEnabled && isValidToken
    })
    // Refine log message based on event type
    if (event_type === "schedule") {
      if (filteredUsers.length === 1) {
        console.log(
          `User ${user_id} is opted-in for '${settingKey}' and has a valid token.`
        )
      } else {
        console.log(
          `User ${user_id} was fetched but is not opted-in for '${settingKey}' or lacks a valid token.`
        )
      }
    } else {
      console.log(
        `Filtered down to ${filteredUsers.length} users opted-in for event_type '${event_type}' (${settingKey}) with valid tokens.`
      )
    }
    // 6. Prepare Expo Notification Payloads using dynamic content
    const notificationContent = getNotificationContent(event_type, program_id, {
      ...requestData,
      user_id
    }) // Pass user_id along if present
    if (!notificationContent) {
      // This means getNotificationContent didn't have a case for the event_type
      return new Response(
        JSON.stringify({
          message: `Bad Request: No notification content defined for event_type '${event_type}'`
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json"
          }
        }
      )
    }
    const expoMessages = filteredUsers.map((user: any) => ({
      to: user.expo_push_token,
      sound: "default",
      title: notificationContent.title,
      body: notificationContent.body,
      data: notificationContent.data // Contains event_type, program_id, and other custom data
    }))
    // 7. Send Notifications
    return await sendExpoNotifications(expoMessages) // This function already handles the case where expoMessages is empty
  } catch (error) {
    console.error(`Caught error in main handler at ${requestTimestamp}:`, error)
    if (error instanceof SyntaxError) {
      return new Response(
        JSON.stringify({
          message: `Bad Request: Invalid JSON payload. ${error.message}`
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json"
          }
        }
      )
    }
    // Catch other potential errors during processing
    return new Response(
      JSON.stringify({
        success: false,
        message: `Internal Server Error: ${error.message}`
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json"
        }
      }
    )
  }
})
console.log("Notification function initialized with conditional user fetching.")
