"use server"

import { createClient } from "@/utils/supabase/server"
import twilio from "twilio"

export interface ChairpersonNotification {
  chairpersonId: number
  chairpersonName: string
  chairpersonPhone: string
  panelTitle: string
  dayTime: string
  room: string
  panelists: number
  isHybrid: boolean
}

export interface NotificationStatus {
  chairpersonId: number
  chairpersonName: string
  phone: string
  status: 'pending' | 'sent' | 'failed' | 'delivered' | 'undelivered'
  messageSid?: string
  errorMessage?: string
  sentAt?: string
}

// Get all chairpeople with their panel information for notification
export async function getChairpeopleForNotification() {
  const supabase = await createClient()
  
  // First get all chairpeople with phone numbers
  const { data: chairpeople, error: chairError } = await supabase
    .from("panel_chairpeople")
    .select("*")
    .not("phone", "is", null)
    .order("day_time", { ascending: true })
  
  if (chairError) {
    console.error("Error fetching chairpeople:", chairError)
    return []
  }
  
  // Get all panels for matching
  const { data: panels, error: panelError } = await supabase
    .from("panel_notifications")
    .select("*")
  
  if (panelError) {
    console.error("Error fetching panels:", panelError)
  }
  
  // Transform the data for easier use
  const transformedData = (chairpeople || []).map(chair => {
    // Find the linked panel
    const linkedPanel = panels?.find(p => p.id === chair.panel_id) || 
                       panels?.find(p => p.title.toLowerCase() === chair.panel_name.toLowerCase())
    
    return {
      chairpersonId: chair.id,
      chairpersonName: chair.name,
      chairpersonPhone: chair.phone,
      panelTitle: linkedPanel?.title || chair.panel_name,
      dayTime: linkedPanel?.time_day || chair.day_time,
      room: linkedPanel?.room || "TBD",
      panelists: linkedPanel?.panelists || 4,
      isHybrid: linkedPanel?.room === "Orchestra C"
    }
  })
  
  // Sort by day and time properly
  const dayOrder = ['thursday', 'friday', 'saturday', 'sunday']
  
  return transformedData.sort((a, b) => {
    // Extract day and time from dayTime string
    const getDayIndex = (dayTime: string) => {
      const lower = dayTime.toLowerCase()
      for (let i = 0; i < dayOrder.length; i++) {
        if (lower.includes(dayOrder[i])) return i
      }
      return 999 // Put unknown days at the end
    }
    
    const getTimeValue = (dayTime: string) => {
      // Extract time pattern like "9:00 AM" or "1:30 PM"
      const timeMatch = dayTime.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i)
      if (!timeMatch) return 0
      
      let hours = parseInt(timeMatch[1])
      const minutes = parseInt(timeMatch[2])
      const isPM = timeMatch[3].toUpperCase() === 'PM'
      
      // Convert to 24-hour format for sorting
      if (isPM && hours !== 12) hours += 12
      if (!isPM && hours === 12) hours = 0
      
      return hours * 60 + minutes
    }
    
    // First sort by day
    const dayDiff = getDayIndex(a.dayTime) - getDayIndex(b.dayTime)
    if (dayDiff !== 0) return dayDiff
    
    // Then sort by time
    return getTimeValue(a.dayTime) - getTimeValue(b.dayTime)
  })
}

// Send notification to selected chairpeople
export async function sendChairpersonNotifications(
  chairpersonIds: number[],
  customMessage?: string
) {
  const supabase = await createClient()
  
  // Initialize Twilio client
  const twilioClient = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
  )
  
  // Get chairpeople details
  const { data: chairpeople, error: chairError } = await supabase
    .from("panel_chairpeople")
    .select("*")
    .in("id", chairpersonIds)
    .not("phone", "is", null)
  
  if (chairError) {
    console.error("Error fetching chairpeople:", chairError)
    throw new Error("Failed to fetch chairpeople data")
  }
  
  // Get all panels for matching
  const { data: panels, error: panelError } = await supabase
    .from("panel_notifications")
    .select("*")
  
  if (panelError) {
    console.error("Error fetching panels:", panelError)
  }
  
  const results: NotificationStatus[] = []
  
  for (const chair of chairpeople || []) {
    // Find the linked panel
    const panel = panels?.find(p => p.id === chair.panel_id) || 
                 panels?.find(p => p.title.toLowerCase() === chair.panel_name.toLowerCase())
    const isHybrid = panel?.room === "Orchestra C"
    
    // Format the message
    const message = customMessage || formatChairpersonMessage(
      chair.name,
      panel?.time_day || chair.day_time,
      panel?.room || "TBD",
      panel?.title || chair.panel_name,
      panel?.panelists || 4,
      isHybrid
    )
    
    try {
      // Send SMS via Twilio
      const twilioMessage = await twilioClient.messages.create({
        body: message,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: chair.phone
      })
      
      // Store notification record
      await supabase.from("twilio_messages").insert({
        to_number: chair.phone,
        from_number: process.env.TWILIO_PHONE_NUMBER,
        message_body: message,
        message_sid: twilioMessage.sid,
        status: twilioMessage.status,
        sent_at: new Date().toISOString(),
        metadata: {
          type: "chairperson_notification",
          chairperson_id: chair.id,
          panel_id: panel?.id
        }
      })
      
      results.push({
        chairpersonId: chair.id,
        chairpersonName: chair.name,
        phone: chair.phone,
        status: "sent",
        messageSid: twilioMessage.sid,
        sentAt: new Date().toISOString()
      })
    } catch (error: any) {
      console.error(`Failed to send SMS to ${chair.phone}:`, error)
      
      results.push({
        chairpersonId: chair.id,
        chairpersonName: chair.name,
        phone: chair.phone,
        status: "failed",
        errorMessage: error.message || "Failed to send message"
      })
    }
  }
  
  return results
}

// Format the chairperson notification message
function formatChairpersonMessage(
  name: string,
  dayTime: string,
  room: string,
  panelTitle: string,
  panelists: number,
  isHybrid: boolean
): string {
  const firstName = name.split(" ")[0]
  
  let message = `Hello ${firstName}, thank you for serving as a chairperson at The 65th ICYPAA!

📅 Day & Time: ${dayTime}
📍 Room: ${room}
🎤 Panel Title: ${panelTitle}
👥 Number of Panelists: ${panelists}`

  if (isHybrid) {
    message += `
💻 If Your Panel is Located in Orchestra C it is a (Hybrid Panel), for questions on how we'll protect your anonymity or to withdraw from this service commitment, reach out to Dani at 518-708-7458`
  }

  message += `

Expectations:
• Arrive 15 minutes early to greet panelists and settle in.
• Each panelist will share for 10–15 minutes. Manage time fairly so all voices are heard.
• After the panelists' shares, please moderate an Ask It Basket session (collect and read questions, keep time, and ensure respectful, experience-based discussion).
• Maintain a welcoming atmosphere and keep the focus on AA's primary purpose.
• Please dress appropriately as a trusted servant.

Thank you for your service in helping showcase these featured conversations in our new and wonderful world.

In love and service,
The 65th ICYPAA Host Committee`

  return message
}

// Check status of sent messages from Twilio
export async function checkMessageStatuses(messageSids: string[]) {
  const twilioClient = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
  )
  
  const supabase = await createClient()
  const statuses: NotificationStatus[] = []
  
  for (const sid of messageSids) {
    try {
      // Fetch message status from Twilio
      const message = await twilioClient.messages(sid).fetch()
      
      // Update status in database
      await supabase
        .from("twilio_messages")
        .update({ 
          status: message.status,
          updated_at: new Date().toISOString()
        })
        .eq("message_sid", sid)
      
      // Get chairperson info from database
      const { data: dbMessage } = await supabase
        .from("twilio_messages")
        .select("*")
        .eq("message_sid", sid)
        .single()
      
      if (dbMessage) {
        statuses.push({
          chairpersonId: dbMessage.metadata?.chairperson_id,
          chairpersonName: dbMessage.metadata?.chairperson_name || "Unknown",
          phone: dbMessage.to_number,
          status: message.status as any,
          messageSid: sid,
          sentAt: dbMessage.sent_at
        })
      }
    } catch (error: any) {
      console.error(`Failed to check status for ${sid}:`, error)
      statuses.push({
        chairpersonId: 0,
        chairpersonName: "Unknown",
        phone: "Unknown",
        status: "failed",
        messageSid: sid,
        errorMessage: error.message
      })
    }
  }
  
  return statuses
}

// Get notification history
export async function getNotificationHistory() {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from("twilio_messages")
    .select("*")
    .eq("metadata->type", "chairperson_notification")
    .order("sent_at", { ascending: false })
    .limit(100)
  
  if (error) {
    console.error("Error fetching notification history:", error)
    return []
  }
  
  return data || []
}