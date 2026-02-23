"use server"

import twilio from "twilio"
import { createClient } from "@/utils/supabase/server"
import {
  generateOneDayReminderEmailTemplate,
  generateOneDayReminderSMSTemplate,
  generateOneHourReminderEmailTemplate,
  generateOneHourReminderSMSTemplate,
  generateInitialEmailTemplate,
  generateInitialSMSTemplates
} from "@/lib/panel-notification-templates"
import {
  generateVolunteerReminderEmailTemplate,
  generateVolunteerReminderSMSTemplate,
  VolunteerShiftDetails
} from "@/lib/volunteer-notification-templates"
import { PanelNotification } from "@/app/host/panels/actions"
import { Shift } from "@/app/host/shift-scheduling/types"

// Test recipients - ALWAYS use these for test notifications
const TEST_EMAIL = "josh@themindfulpug.com"
const TEST_PHONE = "6513320330" // Will be normalized to +16513320330

// Helper function to normalize phone numbers for SMS
function normalizePhoneNumber(phone: string): string {
  const digits = phone.replace(/\D/g, "")
  
  if (digits.length === 10) {
    return `+1${digits}`
  } else if (digits.length === 11 && digits.startsWith("1")) {
    return `+${digits}`
  } else {
    return `+${digits}`
  }
}

// Helper function to send SMS using Twilio
async function sendTestSMS(message: string): Promise<{ success: boolean; error?: string; messageId?: string }> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const fromNumber = process.env.TWILIO_PHONE_NUMBER

  if (!accountSid || !authToken || !fromNumber) {
    console.error("Missing Twilio configuration")
    return { success: false, error: "Missing Twilio configuration" }
  }

  const normalizedPhone = normalizePhoneNumber(TEST_PHONE)

  try {
    const client = twilio(accountSid, authToken)
    
    const sentMessage = await client.messages.create({
      from: fromNumber,
      to: normalizedPhone,
      body: `[TEST NOTIFICATION]\n\n${message}`
    })

    console.log(`Test SMS sent successfully to ${normalizedPhone}. Message ID: ${sentMessage.sid}`)
    return { success: true, messageId: sentMessage.sid }
  } catch (error: any) {
    console.error(`Error sending test SMS to ${normalizedPhone}:`, error)
    
    let errorMessage = "Failed to send SMS"
    
    if (error.code === 21211 || error.code === 21614) {
      errorMessage = "Invalid phone number format"
    } else if (error.code === 21408) {
      errorMessage = "Permission denied to send to this number"
    } else if (error.code === 21610) {
      errorMessage = "Recipient has opted out of messages"
    } else if (error.code === 21612) {
      errorMessage = "Not a valid mobile number (may be landline)"
    } else if (error.message) {
      errorMessage = error.message
    }
    
    return { success: false, error: errorMessage }
  }
}

// Helper function to send email
async function sendTestEmail(subject: string, content: string): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/email`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "email-type": "test-notification"
        },
        body: JSON.stringify({
          to: TEST_EMAIL,
          subject: `[TEST] ${subject}`,
          emailContent: `[THIS IS A TEST NOTIFICATION]\n\n${content}`
        })
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      return { success: false, error: errorText || "Failed to send email" }
    }

    return { success: true }
  } catch (error: any) {
    console.error("Error sending test email:", error)
    return { success: false, error: error.message || "Failed to send email" }
  }
}

// Format chairperson message (copied from notify-actions.ts)
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

// Fetch real data from database
export async function getTestNotificationData() {
  const supabase = await createClient()
  
  try {
    // Get panels
    const { data: panels, error: panelsError } = await supabase
      .from("panel_notifications")
      .select("*")
      .order("time_day", { ascending: true })
    
    if (panelsError) {
      console.error("Error fetching panels:", panelsError)
    }
    
    // Get shifts with assignments
    const { data: shifts, error: shiftsError } = await supabase
      .from("shifts")
      .select("*")
      .not("assignments", "eq", "[]")
      .order("date", { ascending: true })
      .order("start_time", { ascending: true })
    
    if (shiftsError) {
      console.error("Error fetching shifts:", shiftsError)
    }
    
    // Get chairpeople
    const { data: chairpeople, error: chairError } = await supabase
      .from("panel_chairpeople")
      .select("*")
      .order("name", { ascending: true })
    
    if (chairError) {
      console.error("Error fetching chairpeople:", chairError)
    }
    
    return {
      panels: panels || [],
      shifts: shifts || [],
      chairpeople: chairpeople || []
    }
  } catch (error) {
    console.error("Error fetching test data:", error)
    return {
      panels: [],
      shifts: [],
      chairpeople: []
    }
  }
}

export async function sendTestNotification({
  type,
  method,
  customMessage,
  panelId,
  shiftId,
  chairpersonId
}: {
  type: "panel-1day" | "panel-1hour" | "volunteer-12hour" | "chairperson" | "panel-initial"
  method: "email" | "sms"
  customMessage?: string
  panelId?: number
  shiftId?: string
  chairpersonId?: number
}) {
  const supabase = await createClient()
  
  try {
    let subject = ""
    let content = ""
    let smsMessages: string[] = []
    let usedData: any = null
    
    // Generate content based on notification type
    switch (type) {
      case "panel-initial":
      case "panel-1day":
      case "panel-1hour":
        // Fetch real panel data if panelId provided
        if (panelId) {
          const { data: panel, error } = await supabase
            .from("panel_notifications")
            .select("*")
            .eq("id", panelId)
            .single()
          
          if (!error && panel) {
            // Override contact with test recipient
            const testPanel: PanelNotification = {
              ...panel,
              panelist_contact: method === "email" ? TEST_EMAIL : TEST_PHONE,
              contact_type: method
            }
            usedData = panel
            
            if (type === "panel-initial") {
              const confirmationLink = "https://icyhost.org/test-confirmation-link"
              if (method === "email") {
                subject = "Invitation to Speak - 65th ICYPAA Panel"
                content = generateInitialEmailTemplate(testPanel, confirmationLink)
              } else {
                smsMessages = generateInitialSMSTemplates(testPanel, confirmationLink)
              }
            } else if (type === "panel-1day") {
              if (method === "email") {
                subject = `Reminder: Speaking Tomorrow - ${testPanel.title}`
                content = generateOneDayReminderEmailTemplate(testPanel)
              } else {
                content = generateOneDayReminderSMSTemplate(testPanel)
              }
            } else if (type === "panel-1hour") {
              if (method === "email") {
                subject = `Starting Soon: ${testPanel.title}`
                content = generateOneHourReminderEmailTemplate(testPanel)
              } else {
                content = generateOneHourReminderSMSTemplate(testPanel)
              }
            }
          }
        }
        break
        
      case "volunteer-12hour":
        // Fetch real shift data if shiftId provided
        if (shiftId) {
          const { data: shift, error } = await supabase
            .from("shifts")
            .select("*")
            .eq("id", shiftId)
            .single()
          
          if (!error && shift && shift.assignments?.length > 0) {
            // Use first assignment as test data
            const assignment = shift.assignments[0]
            const testVolunteer: VolunteerShiftDetails = {
              volunteerId: assignment.id,
              volunteerName: assignment.name,
              volunteerContact: method === "email" ? TEST_EMAIL : TEST_PHONE,
              shiftDate: shift.date,
              startTime: shift.start_time,
              endTime: shift.end_time,
              jobType: shift.job_type,
              location: shift.location
            }
            usedData = { shift, assignment }
            
            if (method === "email") {
              subject = `Volunteer Reminder: ${shift.job_type} Tomorrow`
              content = generateVolunteerReminderEmailTemplate(testVolunteer)
            } else {
              content = generateVolunteerReminderSMSTemplate(testVolunteer)
            }
          }
        }
        break
        
      case "chairperson":
        // Fetch real chairperson data if chairpersonId provided
        if (chairpersonId) {
          const { data: chairperson, error: chairError } = await supabase
            .from("panel_chairpeople")
            .select("*")
            .eq("id", chairpersonId)
            .single()
          
          if (!chairError && chairperson) {
            // Get linked panel info
            const { data: panels } = await supabase
              .from("panel_notifications")
              .select("*")
            
            const linkedPanel = panels?.find(p => p.id === chairperson.panel_id) || 
                               panels?.find(p => p.title.toLowerCase() === chairperson.panel_name.toLowerCase())
            
            const isHybrid = linkedPanel?.room === "Orchestra C"
            usedData = { chairperson, linkedPanel }
            
            if (customMessage) {
              content = customMessage
              subject = "Chairperson Notification - 65th ICYPAA"
            } else {
              content = formatChairpersonMessage(
                chairperson.name,
                linkedPanel?.time_day || chairperson.day_time,
                linkedPanel?.room || "TBD",
                linkedPanel?.title || chairperson.panel_name,
                linkedPanel?.panelists || 4,
                isHybrid
              )
              subject = "Chairperson Information - 65th ICYPAA"
            }
          }
        }
        break
    }
    
    // Send the notification
    let result: { success: boolean; error?: string; messageId?: string }
    
    if (!content && smsMessages.length === 0) {
      return {
        success: false,
        message: "No data selected or data not found. Please select a panel, shift, or chairperson.",
        details: { type, method }
      }
    }
    
    if (method === "email") {
      result = await sendTestEmail(subject, content)
    } else {
      // For SMS, handle multiple messages for panel-initial
      if (smsMessages.length > 0) {
        // Send multiple SMS messages
        const results = []
        for (const msg of smsMessages) {
          const smsResult = await sendTestSMS(msg)
          results.push(smsResult)
          if (!smsResult.success) {
            return {
              success: false,
              message: `Failed to send SMS: ${smsResult.error}`,
              details: { results, usedData }
            }
          }
          // Add a small delay between messages to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 1000))
        }
        result = { success: true, messageId: results.map(r => r.messageId).join(", ") }
      } else {
        result = await sendTestSMS(content)
      }
    }
    
    if (result.success) {
      return {
        success: true,
        message: `Test ${type} notification sent successfully via ${method} to ${method === "email" ? TEST_EMAIL : TEST_PHONE}`,
        details: {
          type,
          method,
          recipient: method === "email" ? TEST_EMAIL : TEST_PHONE,
          messageId: result.messageId,
          timestamp: new Date().toISOString(),
          usedData
        }
      }
    } else {
      return {
        success: false,
        message: `Failed to send test notification: ${result.error}`,
        details: {
          type,
          method,
          error: result.error,
          usedData
        }
      }
    }
  } catch (error) {
    console.error("Error in sendTestNotification:", error)
    return {
      success: false,
      message: error instanceof Error ? error.message : "An unexpected error occurred",
      details: { error: String(error) }
    }
  }
}