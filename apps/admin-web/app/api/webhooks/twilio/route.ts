import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"
import twilio from "twilio"

// Twilio webhook signature validation
function validateTwilioSignature(
  req: NextRequest,
  params: Record<string, string>,
  signature: string
): boolean {
  const authToken = process.env.TWILIO_AUTH_TOKEN
  if (!authToken) return false

  const url = req.url
  return twilio.validateRequest(
    authToken,
    signature,
    url,
    params
  )
}

// Map Twilio status to our status types
function mapTwilioStatus(status: string): 'success' | 'failed' | 'pending' {
  switch (status.toLowerCase()) {
    case 'delivered':
      return 'success'
    case 'sent':
      return 'pending' // Message sent to carrier but not yet delivered
    case 'failed':
    case 'undelivered':
      return 'failed'
    case 'queued':
    case 'accepted':
      return 'pending'
    default:
      return 'pending'
  }
}

// Get detailed error message from Twilio error code
function getErrorMessage(errorCode?: string, errorMessage?: string): string {
  if (!errorCode && !errorMessage) return 'Unknown SMS delivery error'
  
  // Common Twilio error codes
  const errorMessages: Record<string, string> = {
    '30003': 'Unreachable destination (phone may be off or out of service)',
    '30004': 'Message blocked by carrier',
    '30005': 'Unknown destination (invalid phone number)',
    '30006': 'Landline or unreachable carrier',
    '30007': 'Carrier violation (message filtered)',
    '30008': 'Unknown error from carrier',
    '30009': 'Missing required "To" parameter',
    '30010': 'Message price exceeds max price',
    '21211': 'Invalid "To" phone number',
    '21214': 'Invalid phone number format',
    '21217': 'Phone number does not appear to be valid',
    '21401': 'Invalid phone number',
    '21407': 'Invalid phone number region',
    '21408': 'Permission to send to this phone number denied',
    '21610': 'Recipient has opted out of messages',
    '21611': 'This phone number is blacklisted',
    '21612': 'Phone number is not a valid mobile number',
    '21614': 'Invalid mobile number'
  }
  
  const mappedMessage = errorCode ? errorMessages[errorCode] : null
  
  if (mappedMessage) {
    return `${mappedMessage} (Error ${errorCode})`
  }
  
  if (errorMessage) {
    return `${errorMessage}${errorCode ? ` (Error ${errorCode})` : ''}`
  }
  
  return `SMS delivery error${errorCode ? ` (Error ${errorCode})` : ''}`
}

export async function POST(req: NextRequest) {
  try {
    // Get the raw body for signature validation
    const rawBody = await req.text()
    
    // Parse the URL-encoded body
    const params = new URLSearchParams(rawBody)
    const body: Record<string, string> = {}
    params.forEach((value, key) => {
      body[key] = value
    })

    // Validate Twilio signature (optional in development)
    if (process.env.NODE_ENV === 'production') {
      const signature = req.headers.get('x-twilio-signature')
      if (!signature || !validateTwilioSignature(req, body, signature)) {
        console.error('Invalid Twilio signature')
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    // Extract webhook data
    const {
      MessageSid,
      MessageStatus,
      To,
      ErrorCode,
      ErrorMessage,
      // Custom parameter we'll add when sending
      NotificationId,
      ReminderType
    } = body

    console.log('Twilio webhook received:', {
      MessageSid,
      MessageStatus,
      To,
      ErrorCode,
      ErrorMessage,
      NotificationId,
      ReminderType
    })

    // If we don't have a notification ID, we can't update the database
    if (!NotificationId) {
      console.warn('No NotificationId provided in webhook')
      return NextResponse.json({ success: true })
    }

    const supabase = await createClient()
    const status = mapTwilioStatus(MessageStatus)
    const errorMsg = status === 'failed' ? getErrorMessage(ErrorCode, ErrorMessage) : null

    // Log the webhook event for debugging
    await supabase
      .from('sms_delivery_logs')
      .insert({
        notification_id: NotificationId ? parseInt(NotificationId) : null,
        message_sid: MessageSid,
        message_status: MessageStatus,
        error_code: ErrorCode || null,
        error_message: ErrorMessage || null,
        to_number: To,
        from_number: body.From || null,
        reminder_type: ReminderType || 'initial',
        webhook_data: body
      })

    // Determine which fields to update based on reminder type
    let updateData: Record<string, any> = {}
    
    if (ReminderType === 'reminder2') {
      updateData = {
        reminder2_send_status: status,
        reminder2_send_error: errorMsg
      }
      // Only update sent_at timestamp if successfully delivered
      if (status === 'success' && !updateData.reminder2_followup_sent_at) {
        updateData.reminder2_followup_sent_at = new Date().toISOString()
      }
    } else if (ReminderType === 'reminder1') {
      updateData = {
        reminder_send_status: status,
        reminder_send_error: errorMsg
      }
      // Only update sent_at timestamp if successfully delivered
      if (status === 'success' && !updateData.reminder_followup_sent_at) {
        updateData.reminder_followup_sent_at = new Date().toISOString()
      }
    } else {
      // Initial notification
      updateData = {
        send_status: status,
        send_error: errorMsg
      }
      // Only update sent_at timestamp if successfully delivered
      if (status === 'success' && !updateData.notification_sent_at) {
        updateData.notification_sent_at = new Date().toISOString()
      }
    }

    // Update the notification record
    const { error } = await supabase
      .from('panel_notifications')
      .update(updateData)
      .eq('id', parseInt(NotificationId))

    if (error) {
      console.error('Error updating notification status:', error)
      // Still return 200 to Twilio to prevent retries
      return NextResponse.json({ success: true })
    }

    console.log(`Updated notification ${NotificationId} with status ${status}`)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error processing Twilio webhook:', error)
    // Return 200 to prevent Twilio from retrying
    return NextResponse.json({ success: true })
  }
}