import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card"
import { canAccessReminders } from "@/utils/permissions"
import { createClient } from "@/utils/supabase/server"
import { AlertTriangle } from "lucide-react"
import { redirect } from "next/navigation"
import { MeetingReminders } from "./components/meeting-reminders"

export default async function RemindersPage() {
  const supabase = await createClient()

  // Get current user
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser()

  if (userError || !user) {
    redirect("/auth/login")
  }

  // Check if user has permission to access reminders
  const hasAccess = await canAccessReminders(user.id)

  if (!hasAccess) {
    return (
      <div className="flex-1 w-full flex flex-col gap-8 p-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Access Denied
            </CardTitle>
            <CardDescription>
              You don't have permission to access this page
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Insufficient Permissions</AlertTitle>
              <AlertDescription>
                You need to have admin, steering committee roles, or the
                'reminders:edit' permission to manage reminders. Please contact
                an administrator if you believe this is an error.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Fetch host meeting reminders data
  const { data: remindersData } = await supabase.from("reminders").select("*")

  const reminders =
    remindersData?.reduce(
      (acc, reminder) => ({
        ...acc,
        [reminder.type]: reminder
      }),
      {} as Record<string, any>
    ) || {}

  return (
    <div className="flex-1 w-full flex flex-col gap-8 p-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Manage Reminders</h1>
        <p className="text-muted-foreground">
          Configure and manage host meeting reminders and outreach meeting
          reminders
        </p>
      </div>

      <MeetingReminders />
    </div>
  )
}
