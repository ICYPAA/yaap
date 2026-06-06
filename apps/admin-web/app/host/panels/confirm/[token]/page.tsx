import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card"
import { getCurrentProgramOrNull } from "@/lib/conference-state"
import { buildProgramTemplateContext } from "@/lib/panel-notification-templates"
import { createClient } from "@/utils/supabase/server"
import { CheckCircle, Clock, MapPin, Users, XCircle } from "lucide-react"
import { notFound } from "next/navigation"
import { withdrawPanelParticipation } from "./actions"

interface Props {
  params: Promise<{
    token: string
  }>
}

export default async function ConfirmPanelPage({ params }: Props) {
  const { token } = await params
  let notification
  let isTestToken = false

  if (token === "test-token") {
    // Handle test token with mock data
    isTestToken = true
    notification = {
      id: 0,
      title: "Test Panel - Communication Workshop",
      topic: "Effective Communication in Recovery",
      time_day: "Saturday 2:00 PM",
      room: "Room 101",
      description:
        "This is a test panel to demonstrate the notification system. We'll discuss how to communicate effectively in recovery, share experiences, and explore practical tools for better communication in all areas of life.",
      literature_reference: "Big Book Chapter 5 - How It Works",
      panelist_name: "Test Panelist",
      panelist_contact: "test@example.com",
      contact_type: "email",
      confirmation_token: "test-token",
      confirmed_at: null, // Show as not confirmed for testing
      denied_at: null, // Show as not denied for testing
      notification_sent_at: new Date().toISOString()
    }
  } else {
    // Normal database lookup for real tokens
    const supabase = await createClient()

    const { data, error } = await supabase
      .from("panel_notifications")
      .select("*")
      .eq("confirmation_token", token)
      .single()

    if (error || !data) {
      notFound()
    }

    notification = data

    // Auto-confirm if not already confirmed and not denied
    if (!notification.confirmed_at && !notification.denied_at) {
      const { error: updateError } = await supabase
        .from("panel_notifications")
        .update({
          confirmed_at: new Date().toISOString()
        })
        .eq("confirmation_token", token)
        .is("confirmed_at", null)

      if (!updateError) {
        notification.confirmed_at = new Date().toISOString()
      }
    }
  }

  const isAlreadyConfirmed = notification.confirmed_at !== null
  const isWithdrawn = notification.denied_at !== null
  const programContext = buildProgramTemplateContext(
    await getCurrentProgramOrNull()
  )

  return (
    <div className="min-h-screen bg-background py-12">
      <div className="container mx-auto px-4">
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold text-foreground">
              Panel Confirmation
            </h1>
            <p className="text-muted-foreground">
              {programContext.title}
            </p>
            {isTestToken && (
              <div className="mx-auto max-w-md p-3 bg-yellow-100 border border-yellow-300 rounded-lg dark:bg-yellow-900 dark:border-yellow-700">
                <p className="text-yellow-800 dark:text-yellow-200 text-sm font-medium">
                  🧪 Test Mode - This is sample data for testing purposes
                </p>
              </div>
            )}
          </div>

          <Card className="shadow-lg">
            <CardHeader className="bg-muted/50">
              <CardTitle className="flex items-center gap-2 text-foreground">
                <Users className="h-5 w-5" />
                Panel Details
              </CardTitle>
              <CardDescription>
                {isWithdrawn
                  ? "You have withdrawn from this panel"
                  : isAlreadyConfirmed
                    ? "Your participation has been confirmed"
                    : "You have been selected to participate in the following panel"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              <div className="space-y-4">
                <div>
                  <h3 className="text-xl font-semibold text-foreground">
                    {notification.title}
                  </h3>
                  {notification.topic && (
                    <p className="text-muted-foreground mt-1">
                      Topic: {notification.topic}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                    <Clock className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium text-foreground">Date & Time</p>
                      <p className="text-muted-foreground">
                        {notification.time_day}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                    <MapPin className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium text-foreground">Location</p>
                      <p className="text-muted-foreground">
                        {notification.room}
                      </p>
                    </div>
                  </div>
                </div>

                {notification.description && (
                  <div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                    <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
                      Description
                    </h4>
                    <p className="text-blue-800 dark:text-blue-200">
                      {notification.description}
                    </p>
                  </div>
                )}

                {notification.literature_reference && (
                  <div className="p-4 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800">
                    <h4 className="font-medium text-green-900 dark:text-green-100 mb-2">
                      Literature Reference
                    </h4>
                    <p className="text-green-800 dark:text-green-200">
                      {notification.literature_reference}
                    </p>
                  </div>
                )}

                <div className="border-t pt-4">
                  <h4 className="font-medium text-foreground mb-3">
                    Your Information
                  </h4>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Users className="h-4 w-4" />
                    <span className="font-medium">
                      {notification.panelist_name}
                    </span>
                    <span className="text-muted-foreground">•</span>
                    <span>{notification.panelist_contact}</span>
                  </div>
                </div>
              </div>

              <div className="border-t pt-6">
                {isWithdrawn ? (
                  <div className="flex items-center justify-center gap-3 p-4 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-800">
                    <XCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
                    <div className="text-center">
                      <p className="font-medium text-red-900 dark:text-red-100">
                        Participation Withdrawn
                      </p>
                      <p className="text-red-700 dark:text-red-300 text-sm">
                        {isTestToken
                          ? "This is a test withdrawal page"
                          : `Withdrawn on ${new Date(notification.denied_at).toLocaleDateString()}`}
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-center gap-3 p-4 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800">
                      <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
                      <div className="text-center">
                        <p className="font-medium text-green-900 dark:text-green-100">
                          Participation Confirmed
                        </p>
                        <p className="text-green-700 dark:text-green-300 text-sm">
                          {isTestToken
                            ? "This is a test confirmation page"
                            : `Confirmed on ${new Date(notification.confirmed_at).toLocaleDateString()}`}
                        </p>
                      </div>
                    </div>

                    {/* Withdraw Button */}
                    <div className="mt-4 text-center">
                      <form action={withdrawPanelParticipation}>
                        <input
                          type="hidden"
                          name="token"
                          value={token}
                        />
                        <Button
                          type="submit"
                          variant="destructive"
                          size="sm"
                          className="text-sm"
                        >
                          Withdraw from Panel
                        </Button>
                      </form>
                      <p className="text-xs text-muted-foreground mt-2">
                        If you can no longer participate, click above to
                        withdraw
                      </p>
                    </div>
                  </>
                )}

                <div className="text-center text-sm text-muted-foreground mt-4">
                  <p>
                    If you have any questions or cannot participate, please
                    contact the Program Committee at{" "}
                    <a
                      href="mailto:program@icyhost.org"
                      className="text-primary hover:underline"
                    >
                      program@icyhost.org
                    </a>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="text-center text-sm text-muted-foreground">
            <p>Thank you for your service to the fellowship!</p>
            <p className="mt-1">
              In Unity and Service,
              <br />
              {programContext.programCommitteeName}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
