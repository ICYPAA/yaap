import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Toaster } from "@/components/ui/toaster"
import { createClient } from "@/utils/supabase/server"
import Link from "next/link"

export default async function ReportsPage() {
  const supabase = await createClient()

  // Get the current user
  const {
    data: { user }
  } = await supabase.auth.getUser()

  // Get the user's profile name
  const { data: profileData } = await supabase
    .from("profile-names")
    .select("profile_name")
    .eq("user_id", user?.id)
    .single()

  // Get reports for the current user only
  const { data: reports } = await supabase
    .from("reports")
    .select("*")
    .eq("user_id", user?.id)
    .order("created_at", { ascending: false })

  // Use profile_name, fallback to user metadata, or default to "Your Report"
  const userName =
    profileData?.profile_name || user?.user_metadata?.full_name || "Your Report"

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">My Reports</h1>
        <Link href="/host/reports/report-submission">
          <Button>Submit New Report</Button>
        </Link>
      </div>

      <Card>
        <CardContent>
          {!reports?.length ? (
            <div className="py-12 text-center">
              <h3 className="text-lg font-medium text-muted-foreground mb-4">
                No reports submitted yet
              </h3>
              <p className="text-sm text-muted-foreground mb-6">
                Get started by submitting your first report
              </p>
              <Link href="/host/reports/report-submission">
                <Button>Create Report</Button>
              </Link>
            </div>
          ) : (
            <Accordion type="single" collapsible className="w-full">
              {reports.map((report) => (
                <AccordionItem key={report.id} value={report.id}>
                  <AccordionTrigger className="text-left">
                    <div>
                      <p className="font-semibold">{userName}</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(report.created_at).toLocaleDateString()} -{" "}
                        {report.chair_position}
                      </p>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-4 p-4 bg-muted/50 rounded-md">
                      {report.is_nothing_to_report ? (
                        <div>
                          <p className="italic text-muted-foreground">
                            Nothing to report
                          </p>
                        </div>
                      ) : (
                        <>
                          <div>
                            <h3 className="font-semibold mb-2">
                              Completed Since Last Meeting
                            </h3>
                            <p className="whitespace-pre-wrap">
                              {report.completed_work ||
                                "No completed work reported"}
                            </p>
                          </div>
                          <div>
                            <h3 className="font-semibold mb-2">Current Work</h3>
                            <p className="whitespace-pre-wrap">
                              {report.current_work ||
                                "No current work reported"}
                            </p>
                          </div>
                          <div>
                            <h3 className="font-semibold mb-2">
                              Needs Help With
                            </h3>
                            <p className="whitespace-pre-wrap">
                              {report.needs_help || "No help needed"}
                            </p>
                          </div>
                          <div>
                            <h3 className="font-semibold mb-2">
                              Team Meeting Items
                            </h3>
                            <p className="whitespace-pre-wrap">
                              {report.share_in_meeting || "No pertinent items"}
                            </p>
                          </div>
                          <div>
                            <h3 className="font-semibold mb-2">
                              Team Meeting Items
                            </h3>
                            <p className="whitespace-pre-wrap">
                              {report.team_meeting_items ||
                                "No team meeting items"}
                            </p>
                          </div>
                        </>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </CardContent>
      </Card>
      <Toaster />
    </div>
  )
}
