// Setup type definitions for built-in Supabase Runtime APIs
import "@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "@supabase/supabase-js"

const STAFF_NOTIFICATION_ROLES = new Set(["admin", "steering", "advisory"])
const STAFF_NOTIFICATION_PERMISSIONS = new Set([
  "notifications:send",
  "send_notifications"
])
const SUPPORT_NOTIFICATION_PERMISSIONS = new Set([
  "support:edit",
  "support:manage"
])
const SUPPORTED_EVENT_TYPES = new Set([
  "schedule",
  "event",
  "main_meeting",
  "game",
  "hospitality",
  "support",
  "host"
])
const SCHEDULE_STATUSES = new Set(["requested", "accepted"])
const HOST_NOTIFICATION_ROLES = ["admin", "steering", "advisory", "host"]
const HOST_FORM_TYPES = new Set([
  "accessibility",
  "hospitality",
  "support",
  "volunteer"
])

type NotificationUser = {
  id: number | string
  expo_push_token: string | null
  settings?: Record<string, boolean> | null
}

type SupabaseFetchError = {
  code?: string
  message: string
}

type ExpoMessage = {
  to: string
  sound: string
  title: string
  body: string
  data: Record<string, unknown>
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: {
      "Content-Type": "application/json"
    },
    status
  })
}

function getErrorMessage(error) {
  return error instanceof Error ? error.message : String(error)
}

function getBearerToken(req) {
  const authHeader = req.headers.get("Authorization")
  if (!authHeader?.startsWith("Bearer ")) {
    return null
  }

  return authHeader.slice("Bearer ".length).trim()
}

async function authenticateRequest(req, supabaseClient) {
  const token = getBearerToken(req)
  if (!token) {
    return jsonResponse({ message: "Unauthorized: Missing bearer token" }, 401)
  }

  const {
    data: { user },
    error
  } = await supabaseClient.auth.getUser(token)

  if (error || !user) {
    return jsonResponse({ message: "Unauthorized: Invalid session" }, 401)
  }

  return { user }
}

async function getCallerContext(supabaseClient, authUser) {
  if (authUser.app_metadata?.provider === "discord") {
    const { data: membership, error: membershipError } = await supabaseClient
      .from("discord_memberships")
      .select("is_member, verified_at")
      .eq("user_id", authUser.id)
      .maybeSingle()

    if (membershipError) {
      console.error("Error loading caller Discord membership:", membershipError)
      return {
        response: jsonResponse(
          { message: "Unable to verify Discord membership" },
          500
        )
      }
    }

    const verifiedAt = membership?.verified_at
      ? new Date(membership.verified_at).getTime()
      : Number.NaN
    const membershipIsFresh =
      Number.isFinite(verifiedAt) &&
      Date.now() - verifiedAt < 7 * 24 * 60 * 60 * 1000

    if (!membership?.is_member || !membershipIsFresh) {
      return {
        response: jsonResponse(
          { message: "Forbidden: Discord membership is not verified" },
          403
        )
      }
    }
  }

  const [rolesResult, profileResult] = await Promise.all([
    supabaseClient
      .from("roles")
      .select("role, permissions")
      .eq("user_id", authUser.id),
    supabaseClient
      .from("users")
      .select("id, user_id, device_id, first_name, last_initial")
      .eq("user_id", authUser.id)
      .maybeSingle()
  ])

  if (rolesResult.error) {
    console.error("Error loading caller roles:", rolesResult.error)
    return {
      response: jsonResponse({ message: "Unable to verify caller role" }, 500)
    }
  }

  if (profileResult.error) {
    console.error("Error loading caller profile:", profileResult.error)
    return {
      response: jsonResponse({ message: "Unable to verify caller profile" }, 500)
    }
  }

  return {
    roles: rolesResult.data || [],
    profile: profileResult.data || null
  }
}

function hasStaffNotificationAccess(callerContext) {
  return callerContext.roles.some((roleRow) => {
    if (STAFF_NOTIFICATION_ROLES.has(roleRow.role)) {
      return true
    }

    const permissions = Array.isArray(roleRow.permissions)
      ? roleRow.permissions
      : []

    return permissions.some((permission) =>
      STAFF_NOTIFICATION_PERMISSIONS.has(permission)
    )
  })
}

function hasAnyPermission(callerContext, allowedPermissions) {
  return callerContext.roles.some((roleRow) => {
    const permissions = Array.isArray(roleRow.permissions)
      ? roleRow.permissions
      : []

    return permissions.some((permission) => allowedPermissions.has(permission))
  })
}

function normalizeRequestData(requestData) {
  const normalizedData = { ...(requestData || {}) }

  if (normalizedData.deviceId && !normalizedData.device_id) {
    normalizedData.device_id = normalizedData.deviceId
  }

  return normalizedData
}

function scheduleListIncludes(list, userId) {
  return Array.isArray(list) && list.some((item) => Number(item) === userId)
}

function isPositiveInteger(value) {
  return typeof value === "number" && Number.isInteger(value) && value > 0
}

function isRecentTimestamp(createdAt, windowMs = 10 * 60 * 1000) {
  const timestamp = new Date(createdAt).getTime()
  return Number.isFinite(timestamp) && Date.now() - timestamp <= windowMs
}

function callerOwnsRow(authUser, callerProfile, row) {
  if (!row) {
    return false
  }

  if (row.owner_id && row.owner_id === authUser.id) {
    return true
  }

  if (row.user_id && row.user_id === authUser.id) {
    return true
  }

  if (row.device_id && callerProfile?.device_id === row.device_id) {
    return true
  }

  return false
}

async function verifyHostFormNotification({
  supabaseClient,
  authUser,
  callerProfile,
  programId,
  requestData
}) {
  if (!HOST_FORM_TYPES.has(requestData.type)) {
    return {
      response: jsonResponse(
        { message: "Bad Request: Unsupported host notification type" },
        400
      )
    }
  }

  if (!isPositiveInteger(requestData.form_id)) {
    return {
      response: jsonResponse(
        { message: "Bad Request: host form notifications require form_id" },
        400
      )
    }
  }

  let formQuery
  switch (requestData.type) {
    case "accessibility":
      formQuery = supabaseClient
        .from("accessibility_forms")
        .select("id, created_at, owner_id, program_id, user_id")
        .eq("id", requestData.form_id)
        .eq("program_id", programId)
        .maybeSingle()
      break
    case "hospitality":
      formQuery = supabaseClient
        .from("hospitality_forms")
        .select("id, created_at, owner_id, program_id, user_id")
        .eq("id", requestData.form_id)
        .eq("program_id", programId)
        .maybeSingle()
      break
    case "support":
      formQuery = supabaseClient
        .from("support_chats")
        .select("id, created_at, device_id, owner_id, program_id")
        .eq("id", requestData.form_id)
        .eq("program_id", programId)
        .maybeSingle()
      break
    case "volunteer":
      formQuery = supabaseClient
        .from("volunteering_interest")
        .select("id, created_at, owner_id, program_id")
        .eq("id", requestData.form_id)
        .eq("program_id", programId)
        .maybeSingle()
      break
    default:
      return {
        response: jsonResponse(
          { message: "Bad Request: Unsupported host notification type" },
          400
        )
      }
  }

  const { data: formRow, error: formError } = await formQuery
  if (formError) {
    console.error("Error verifying host form notification:", formError)
    return {
      response: jsonResponse(
        { message: "Unable to verify host form notification" },
        500
      )
    }
  }

  if (!formRow || !isRecentTimestamp(formRow.created_at)) {
    return {
      response: jsonResponse(
        {
          message:
            "Forbidden: Host form notification does not match a recent form"
        },
        403
      )
    }
  }

  if (!callerOwnsRow(authUser, callerProfile, formRow)) {
    return {
      response: jsonResponse(
        { message: "Forbidden: Host form notification ownership mismatch" },
        403
      )
    }
  }

  return { requestData }
}

async function fetchHostNotificationUsers(supabaseClient) {
  const { data: roleRows, error: roleError } = await supabaseClient
    .from("roles")
    .select("user_id")
    .in("role", HOST_NOTIFICATION_ROLES)

  if (roleError) {
    return { data: null, error: roleError }
  }

  const hostAuthUserIds = [
    ...new Set((roleRows || []).map((row) => row.user_id).filter(Boolean))
  ]

  if (hostAuthUserIds.length === 0) {
    return { data: [], error: null }
  }

  return await supabaseClient
    .from("users")
    .select("id, expo_push_token, settings")
    .in("user_id", hostAuthUserIds)
    .eq("settings->>notifications", "true")
    .not("expo_push_token", "is", null)
    .not("expo_push_token", "eq", "")
}

async function authorizeNotificationRequest({
  supabaseClient,
  authUser,
  programId,
  eventType,
  userId,
  requestData
}) {
  if (!SUPPORTED_EVENT_TYPES.has(eventType)) {
    return {
      response: jsonResponse(
        { message: `Bad Request: Unsupported event_type '${eventType}'` },
        400
      )
    }
  }

  const callerContext = await getCallerContext(supabaseClient, authUser)
  if (callerContext.response) {
    return callerContext
  }

  const normalizedData = normalizeRequestData(requestData)

  if (eventType === "schedule") {
    if (!callerContext.profile) {
      return {
        response: jsonResponse(
          { message: "Forbidden: Schedule notifications require a profile" },
          403
        )
      }
    }

    if (!SCHEDULE_STATUSES.has(normalizedData.status)) {
      return {
        response: jsonResponse(
          { message: "Bad Request: Invalid schedule notification status" },
          400
        )
      }
    }

    const { data: shareRows, error: shareError } = await supabaseClient
      .from("users")
      .select("id, schedule")
      .in("id", [callerContext.profile.id, userId])

    if (shareError) {
      console.error("Error verifying schedule relationship:", shareError)
      return {
        response: jsonResponse(
          { message: "Unable to verify schedule notification ownership" },
          500
        )
      }
    }

    const callerSchedule = shareRows?.find(
      (row) => Number(row.id) === Number(callerContext.profile.id)
    )
    const targetSchedule = shareRows?.find((row) => Number(row.id) === userId)
    const targetRequestedCaller = scheduleListIncludes(
      targetSchedule?.schedule?.requested_share,
      callerContext.profile.id
    )
    const callerSharesWithTarget = scheduleListIncludes(
      callerSchedule?.schedule?.shared_with,
      userId
    )

    if (
      (normalizedData.status === "requested" && !targetRequestedCaller) ||
      (normalizedData.status === "accepted" && !callerSharesWithTarget)
    ) {
      return {
        response: jsonResponse(
          { message: "Forbidden: Schedule notification ownership mismatch" },
          403
        )
      }
    }

    return {
      requestData: {
        ...normalizedData,
        user: {
          first_name: callerContext.profile.first_name || "",
          last_initial: callerContext.profile.last_initial || ""
        }
      }
    }
  }

  if (eventType === "support") {
    if (
      !hasStaffNotificationAccess(callerContext) &&
      !hasAnyPermission(callerContext, SUPPORT_NOTIFICATION_PERMISSIONS)
    ) {
      return {
        response: jsonResponse(
          { message: "Forbidden: Support notifications require host access" },
          403
        )
      }
    }

    if (!normalizedData.device_id) {
      return {
        response: jsonResponse(
          { message: "Bad Request: support notifications require device_id" },
          400
        )
      }
    }

    return { requestData: normalizedData }
  }

  if (eventType === "host") {
    if (normalizedData.type === "general") {
      if (!hasStaffNotificationAccess(callerContext)) {
        return {
          response: jsonResponse(
            { message: "Forbidden: Notification send permission required" },
            403
          )
        }
      }

      return { requestData: normalizedData }
    }

    if (hasStaffNotificationAccess(callerContext)) {
      return { requestData: normalizedData }
    }

    return await verifyHostFormNotification({
      supabaseClient,
      authUser,
      callerProfile: callerContext.profile,
      programId,
      requestData: normalizedData
    })
  }

  if (!hasStaffNotificationAccess(callerContext)) {
    return {
      response: jsonResponse(
        { message: "Forbidden: Notification send permission required" },
        403
      )
    }
  }

  return { requestData: normalizedData }
}

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
  const { user_id: _user_id, ...otherRequestData } = requestData || {}
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
async function sendExpoNotifications(messages: ExpoMessage[]) {
  if (messages.length === 0) {
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
  // Split messages into batches of 100 (Expo API limit)
  const BATCH_SIZE = 100
  const batches: ExpoMessage[][] = []
  for (let i = 0; i < messages.length; i += BATCH_SIZE) {
    batches.push(messages.slice(i, i + BATCH_SIZE))
  }

  let totalSuccessful = 0
  let totalFailed = 0
  const allResponses: Array<Record<string, unknown>> = []

  // Send each batch with delay between batches to avoid rate limiting
  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex]
    // Add delay between batches to avoid hitting rate limit (except for first batch)
    if (batchIndex > 0) {
      await new Promise((resolve) => setTimeout(resolve, 250))
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
        console.error(
          `Batch ${batchIndex + 1} failed:`,
          response.status,
          responseBody
        )
        // Continue with other batches even if one fails
        totalFailed += batch.length
        allResponses.push({
          batch: batchIndex + 1,
          success: false,
          error: responseBody
        })
        continue
      }

      const successfulSends =
        responseBody.data?.filter((receipt) => receipt.status === "ok")
          .length ?? 0
      const failedSends = batch.length - successfulSends

      totalSuccessful += successfulSends
      totalFailed += failedSends

      // Log receipts with errors for debugging
      responseBody.data?.forEach((receipt) => {
        if (receipt.status !== "ok") {
          console.warn(
            `Notification receipt failed: ${receipt.message} (${receipt.details?.error})`
          )
        }
      })

      allResponses.push({
        batch: batchIndex + 1,
        success: true,
        successful: successfulSends,
        failed: failedSends
      })
    } catch (error) {
      console.error(`Error sending batch ${batchIndex + 1}:`, error)
      totalFailed += batch.length
      allResponses.push({
        batch: batchIndex + 1,
        success: false,
        error: getErrorMessage(error)
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
Deno.serve(async (req): Promise<Response> => {
  const requestTimestamp = new Date().toISOString()
  let supabase
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
    if (!supabaseUrl || !supabaseServiceRoleKey) {
      console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
      return jsonResponse(
        { message: "Internal Server Error: Missing Supabase configuration" },
        500
      )
    }

    supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {})

    const authResult = await authenticateRequest(req, supabase)
    if (authResult instanceof Response) {
      return authResult
    }
    const { user: authUser } = authResult

    // 1. Parse Request Body
    if (
      !req.headers
        .get("content-type")
        ?.toLocaleLowerCase()
        .startsWith("application/json")
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
      data: rawRequestData
    } = await req.json()
    let requestData = rawRequestData
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
      if (user_id === undefined || user_id === null) {
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
    const authorizationResult = await authorizeNotificationRequest({
      supabaseClient: supabase,
      authUser,
      programId: program_id,
      eventType: event_type,
      userId: user_id,
      requestData
    })
    if (authorizationResult.response instanceof Response) {
      return authorizationResult.response
    }
    if (!("requestData" in authorizationResult)) {
      return jsonResponse(
        { message: "Internal Server Error: Invalid authorization result" },
        500
      )
    }
    requestData = authorizationResult.requestData

    // 2. Query Supabase using the service role after caller authentication.
    // --- *** NEW: Conditional User Fetching Logic *** ---
    let usersToQuery: NotificationUser[] = []
    let fetchError: SupabaseFetchError | null = null
    if (event_type === "schedule") {
      // Fetch the specific user passed in the request
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
        const { data: hostUsersData, error: hostUsersError } =
          await fetchHostNotificationUsers(supabase)
        usersToQuery = hostUsersData || []
        fetchError = hostUsersError
      }
    } else {
      // Original logic: Fetch all users with general notifications enabled for other event types
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
    const filteredUsers = usersToQuery.filter(
      (user): user is NotificationUser & { expo_push_token: string } => {
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
          `User ${user.id} opted in for ${settingKey} but has invalid or missing expo_push_token`
        )
      }
      // For 'schedule' type, we also implicitly checked general settings via the fetch if we didn't change that part.
      // Keep the check here for consistency and safety for all types.
      // User must have general notifications ON, *and* specific notification type ON, *and* a valid token.
      return generalSettingEnabled && specificSettingEnabled && isValidToken
    })
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
    const expoMessages = filteredUsers.map((user) => ({
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
        message: `Internal Server Error: ${getErrorMessage(error)}`
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
