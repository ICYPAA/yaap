// Email templates for volunteer notifications
// Each template is a function that takes volunteer data and returns email subject and body

export interface EmailTemplate {
  subject: string
  body: (data: any) => string
}

export const emailTemplates: Record<string, EmailTemplate> = {
  general: {
    subject: "Thank You for Volunteering at ICYPAA 65!",
    body: (data) => `
Dear ${data.name || 'Volunteer'},

Thank you for signing up to volunteer at the 65th International Conference of Young People in Alcoholics Anonymous (ICYPAA)!

We're excited to have you join our team and help make this conference a memorable experience for everyone attending.

Your volunteer information:
- Name: ${data.name} ${data.last_initial || ''}
- Contact: ${data.email || data.phone || 'Not provided'}
${data.comments ? `- Additional notes: ${data.comments}` : ''}

We'll be in touch soon with more details about your volunteer assignment and schedule.

If you have any questions in the meantime, please don't hesitate to reach out to us.

With gratitude,
The ICYPAA 65 Volunteer Committee

---
This email was sent to confirm your volunteer registration. If you did not sign up to volunteer, please let us know immediately.
    `.trim()
  },

  security: {
    subject: "Security Volunteer Confirmation - ICYPAA 65",
    body: (data) => `
Dear ${data.name || 'Security Volunteer'},

Thank you for signing up to help with security at ICYPAA 65! Your commitment to keeping our conference safe is greatly appreciated.

Your security volunteer information:
- Name: ${data.name} ${data.last_initial || ''}
- Phone: ${data.phone}
- Email: ${data.email}
- Selected time slots: ${data.timeSlots?.join(', ') || 'To be assigned'}

${data.timeSlots?.length >= 2 ? '🎉 Great news! Since you signed up for 2 or more shifts, you\'re eligible for a free security t-shirt (first 60 volunteers only)!' : ''}

Important reminders:
• Please arrive 15 minutes before your scheduled shift
• Wear comfortable shoes and clothing
• Bring a water bottle to stay hydrated
• Your shift coordinator will provide specific instructions upon arrival

${data.comments ? `Your additional notes: ${data.comments}` : ''}

We'll send you a final schedule confirmation closer to the conference date.

Thank you for helping us maintain a safe and welcoming environment!

Best regards,
The ICYPAA 65 Security Team

---
Questions? Reply to this email or contact our security coordinator.
    `.trim()
  },

  registration: {
    subject: "Registration Volunteer Confirmation - ICYPAA 65",
    body: (data) => `
Dear ${data.name || 'Registration Volunteer'},

Thank you for volunteering to help with registration at ICYPAA 65! Your assistance will help ensure a smooth check-in process for all attendees.

Your registration volunteer details:
- Name: ${data.name} ${data.last_initial || ''}
- Contact: ${data.email || data.phone}
- Preferred shifts: ${data.day ? `${data.day} - ${data.time_slot}` : 'To be scheduled'}
${data.previousExperience ? '- Previous experience: Yes' : ''}
${data.groupName ? `- Home group: ${data.groupName}` : ''}

What to expect:
• Help attendees check in and receive their conference materials
• Answer basic questions about the conference schedule and venue
• Direct attendees to appropriate areas
• Maintain an organized and welcoming registration area

${data.comments ? `Your notes: ${data.comments}` : ''}

We'll send you more details about your specific assignment and any training sessions.

Looking forward to working with you!

Warm regards,
The ICYPAA 65 Registration Team

---
Need to update your availability? Just reply to this email.
    `.trim()
  },

  hospitality: {
    subject: "Hospitality Volunteer Confirmation - ICYPAA 65",
    body: (data) => `
Dear ${data.name || 'Hospitality Volunteer'},

Welcome to the ICYPAA 65 Hospitality Team! Thank you for volunteering to help create a warm and welcoming environment for our attendees.

Your hospitality volunteer information:
- Name: ${data.name} ${data.last_initial || ''}
- Contact: ${data.email || data.phone}
- Scheduled time: ${data.day ? `${data.day} - ${data.time_slot}` : 'To be scheduled'}
${data.previousExperience ? '- Previous hospitality experience: Yes' : ''}
${data.groupName ? `- Home group: ${data.groupName}` : ''}

Your hospitality duties may include:
• Setting up and maintaining refreshment stations
• Keeping hospitality areas clean and organized
• Greeting attendees and providing assistance
• Restocking supplies as needed
• Creating a welcoming atmosphere

${data.comments ? `Your additional notes: ${data.comments}` : ''}

We truly appreciate your service and look forward to working with you!

With gratitude,
The ICYPAA 65 Hospitality Team

---
Questions about your assignment? We're here to help - just reply to this email.
    `.trim()
  },

  marathon_meeting: {
    subject: "Marathon Meeting Volunteer Confirmation - ICYPAA 65",
    body: (data) => `
Dear ${data.name || 'Marathon Meeting Volunteer'},

Thank you for volunteering to support the Marathon Meetings at ICYPAA 65! Your service helps maintain this vital recovery space throughout the conference.

Your marathon meeting volunteer details:
- Name: ${data.name} ${data.last_initial || ''}
- Contact: ${data.email || data.phone}
- Available times: ${data.timeSlots?.join(', ') || 'To be scheduled'}
${data.previousExperience ? '- Previous experience: Yes' : ''}

Marathon Meeting responsibilities:
• Ensure meeting rooms are set up properly
• Welcome attendees and explain meeting format
• Help facilitate smooth transitions between meetings
• Maintain a respectful and recovery-focused environment
• Assist with any technical needs (microphones, etc.)

${data.comments ? `Your notes: ${data.comments}` : ''}

The Marathon Meetings run continuously throughout the conference, providing 24/7 recovery support. Your contribution is invaluable!

In fellowship,
The ICYPAA 65 Marathon Meeting Committee

---
Need to adjust your schedule? Please let us know as soon as possible.
    `.trim()
  },

  merch: {
    subject: "Merchandise Volunteer Confirmation - ICYPAA 65",
    body: (data) => `
Dear ${data.name || 'Merch Volunteer'},

Thank you for signing up to help with merchandise at ICYPAA 65! Your help will ensure attendees can take home memories from this special event.

Your merchandise volunteer information:
- Name: ${data.name} ${data.last_initial || ''}
- Contact: ${data.email || data.phone}
- T-shirt size: ${data.shirtSize || 'Not specified'}
- Scheduled shifts: ${data.timeSlots?.join(', ') || 'To be assigned'}
${data.previousExperience ? '- Previous merch experience: Yes' : ''}

Merchandise volunteer duties:
• Assist attendees with merchandise selection
• Process sales and handle cash/credit transactions
• Maintain organized merchandise displays
• Track inventory levels
• Provide excellent customer service

${data.comments ? `Your additional notes: ${data.comments}` : ''}

We'll provide training on our point-of-sale system and merchandise handling procedures.

Looking forward to having you on the team!

Best,
The ICYPAA 65 Merchandise Team

---
Questions about merchandise volunteering? Reply to this email for assistance.
    `.trim()
  },

  outreach: {
    subject: "Outreach Volunteer Confirmation - ICYPAA 65",
    body: (data) => `
Dear ${data.name || 'Outreach Volunteer'},

Thank you for volunteering to help with outreach at ICYPAA 65! Your efforts help spread the message and welcome newcomers to our conference.

Your outreach volunteer details:
- Name: ${data.name} ${data.last_initial || ''}
- Contact: ${data.email || data.phone}
- Availability: ${data.availability || 'Flexible'}
${data.previousExperience ? '- Previous outreach experience: Yes' : ''}

Outreach activities may include:
• Welcoming first-time attendees
• Providing conference information
• Distributing flyers and schedules
• Connecting people with meetings and events
• Being a friendly face and resource

${data.comments ? `Your notes: ${data.comments}` : ''}

Your enthusiasm and willingness to carry the message is what makes ICYPAA special!

In service,
The ICYPAA 65 Outreach Committee

---
Want to get more involved? Let us know how we can best utilize your talents!
    `.trim()
  },

  specific_event: {
    subject: "Event Volunteer Confirmation - ICYPAA 65",
    body: (data) => `
Dear ${data.name || 'Event Volunteer'},

Thank you for volunteering for specific events at ICYPAA 65! Your support helps make our special events memorable and successful.

Your event volunteer information:
- Name: ${data.name} ${data.last_initial || ''}
- Contact: ${data.email || data.phone}
- Events interested in: ${data.events?.join(', ') || 'Various events'}
${data.previousExperience ? '- Previous event experience: Yes' : ''}

Depending on the event, duties may include:
• Event setup and breakdown
• Registration and check-in
• Crowd management
• Activity coordination
• Technical support
• General assistance as needed

${data.comments ? `Your additional notes: ${data.comments}` : ''}

We'll contact you with specific event assignments based on your availability and interests.

Thank you for your flexibility and enthusiasm!

Warmly,
The ICYPAA 65 Events Team

---
Have a specific event in mind? Let us know your preferences!
    `.trim()
  }
}

// Helper function to get email template for a volunteer type
export function getEmailTemplate(type: string): EmailTemplate {
  // Default to general template if type not found
  return emailTemplates[type] || emailTemplates.general
}

// Function to generate email content for a volunteer
export function generateEmailContent(type: string, data: any): { subject: string; body: string } {
  const template = getEmailTemplate(type)
  return {
    subject: template.subject,
    body: template.body(data)
  }
}