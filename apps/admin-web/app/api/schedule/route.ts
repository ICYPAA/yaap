import { Shift, ShiftAssignment } from "@/app/host/shift-scheduling/types"
import { createClient } from "@/utils/supabase/server"
import { NextRequest, NextResponse } from "next/server"

// Helper function to normalize phone numbers for comparison
function normalizePhone(phone: string): string {
  let normalized = phone.replace(/\D/g, "")

  if (normalized.length === 11 && normalized.startsWith("1")) {
    normalized = normalized.substring(1)
  }

  return normalized
}

export async function GET(request: NextRequest) {
  console.log("Getting schedule")
  try {
    // Try multiple ways to get the auth token
    let authHeader =
      request.headers.get("authorization") ||
      request.headers.get("Authorization") ||
      request.headers.get("x-authorization")

    // Also check for token in query params as fallback
    const url = new URL(request.url)
    const queryToken = url.searchParams.get("token")

    if (!authHeader && queryToken) {
      authHeader = `Bearer ${queryToken}`
      console.log("Using token from query params")
    }

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.log("Missing or invalid authorization header")
      return NextResponse.json(
        {
          error: "Missing or invalid authorization header",
          tip: "You can also pass the token as a query parameter: ?token=YOUR_TOKEN"
        },
        { status: 401 }
      )
    }

    const token = authHeader.replace("Bearer ", "").trim()

    // First try with regular client
    const supabase = await createClient()
    let user = null
    let authError = null

    // Try to get user with the provided token
    const { data: userData, error: userError } =
      await supabase.auth.getUser(token)

    if (userData?.user) {
      user = userData.user
    } else if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      // If regular auth fails, try with service role
      const serviceSupabase = await createClient(
        process.env.SUPABASE_SERVICE_ROLE_KEY
      )
      const { data: serviceData, error: serviceError } =
        await serviceSupabase.auth.getUser(token)

      if (serviceData?.user) {
        user = serviceData.user
      } else {
        authError = serviceError || userError
      }
    } else {
      authError = userError
    }

    console.log("Done getting user")
    if (!user) {
      console.error("Auth error:", authError)
      return NextResponse.json(
        { error: "Invalid or expired token" },
        { status: 401 }
      )
    }

    // Get user's email and phone from auth metadata
    const userEmail = user.email?.toLowerCase()
    const userPhone =
      user.user_metadata?.phone ||
      user.user_metadata?.phone_number ||
      user.phone ||
      null
    const normalizedUserPhone = userPhone ? normalizePhone(userPhone) : null

    // Get all shifts from database
    console.log("Getting shifts")
    const { data: shifts, error: shiftsError } = await supabase
      .from("shifts")
      .select("*")
      .order("date", { ascending: true })
      .order("start_time", { ascending: true })

    if (shiftsError) {
      console.error("Error fetching shifts:", shiftsError)
      return NextResponse.json(
        { error: "Failed to fetch shifts" },
        { status: 500 }
      )
    }

    // Get user's volunteer record if exists
    console.log("Getting volunteer records")
    const { data: volunteerRecords } = await supabase
      .from("volunteering_interest")
      .select("id, name, email, phone, type")
      .or(`email.ilike.${userEmail},phone.eq.${userPhone}`)

    // Get user's chairperson record if exists (by phone only)
    let chairpersonRecords: any[] = []
    if (normalizedUserPhone) {
      console.log("Getting chairperson records")
      const { data: chairpeople } = await supabase
        .from("panel_chairpeople")
        .select("*")

      // Manual filtering for phone normalization
      chairpersonRecords = (chairpeople || []).filter(
        (c) => c.phone && normalizePhone(c.phone) === normalizedUserPhone
      )
    }

    // Filter shifts to find ones where user is assigned
    console.log("Filtering shifts")
    const userShifts: Shift[] = []

    for (const shift of shifts || []) {
      const userAssignments: ShiftAssignment[] = []

      // Check each assignment in the shift
      for (const assignment of shift.assignments || []) {
        let isUserAssignment = false

        // Check by contact info (email or phone)
        if (assignment.contact) {
          const assignmentContact = assignment.contact.toLowerCase()

          // Check if it's an email match
          if (
            assignmentContact.includes("@") &&
            userEmail &&
            assignmentContact === userEmail
          ) {
            isUserAssignment = true
          }
          // Check if it's a phone match
          else if (!assignmentContact.includes("@") && normalizedUserPhone) {
            const normalizedAssignmentPhone = normalizePhone(assignment.contact)
            if (normalizedAssignmentPhone === normalizedUserPhone) {
              isUserAssignment = true
            }
          }
        }

        // Check by volunteer ID if linked
        if (
          !isUserAssignment &&
          assignment.volunteering_interest_id &&
          volunteerRecords
        ) {
          const matchingVolunteer = volunteerRecords.find(
            (v) => v.id === assignment.volunteering_interest_id
          )
          if (matchingVolunteer) {
            isUserAssignment = true
          }
        }

        // Check if assignment type is panel_chair and user is a chairperson
        if (
          !isUserAssignment &&
          assignment.type === "panel_chair" &&
          chairpersonRecords.length > 0
        ) {
          // Check if assignment name matches any chairperson record
          const matchingChair = chairpersonRecords.find(
            (c) => c.name.toLowerCase() === assignment.name.toLowerCase()
          )
          if (matchingChair) {
            isUserAssignment = true
          }
        }

        if (isUserAssignment) {
          userAssignments.push(assignment)
        }
      }

      // If user has assignments in this shift, add it to their schedule
      if (userAssignments.length > 0) {
        userShifts.push({
          ...shift,
          assignments: userAssignments // Only include user's assignments
        })
      }
    }

    console.log("Formatting response")
    // Format the response
    const response = {
      user: {
        id: user.id,
        email: userEmail,
        phone: userPhone,
        name:
          user.user_metadata?.full_name ||
          user.user_metadata?.name ||
          volunteerRecords?.[0]?.name ||
          chairpersonRecords?.[0]?.name ||
          null
      },
      shifts: userShifts.map((shift) => ({
        id: shift.id,
        date: shift.date,
        start_time: shift.start_time,
        end_time: shift.end_time,
        job_type: shift.job_type,
        location: shift.location || [],
        assignments: shift.assignments,
        notes: shift.notes
      })),
      summary: {
        total_shifts: userShifts.length,
        volunteer_records: volunteerRecords?.length || 0,
        chairperson_records: chairpersonRecords.length,
        dates: Array.from(new Set(userShifts.map((s) => s.date))).sort()
      }
    }

    return NextResponse.json(response, {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers":
          "Content-Type, Authorization, x-authorization"
      }
    })
  } catch (error) {
    console.error("Error in schedule API:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

// Handle OPTIONS requests for CORS preflight
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers":
        "Content-Type, Authorization, x-authorization",
      "Access-Control-Max-Age": "86400"
    }
  })
}
