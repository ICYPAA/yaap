export function getEmailApiHeaders(emailType: string): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "email-type": emailType
  }

  if (process.env.EMAIL_API_SECRET) {
    headers.Authorization = `Bearer ${process.env.EMAIL_API_SECRET}`
  }

  return headers
}
