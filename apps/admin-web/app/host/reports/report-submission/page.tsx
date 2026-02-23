"use client"

import { useToast } from "@/components/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Combobox, ComboboxOption } from "@/components/ui/combobox"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Toaster } from "@/components/ui/toaster"
import { createClient } from "@/utils/supabase/client"
import { Loader2 } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useState, useTransition } from "react"
import { submitNothingToReport, submitReport } from "./actions"

export default function ReportSubmissionPage() {
  const [selectedPosition, setSelectedPosition] = useState<string>("")
  const [user, setUser] = useState<any>(null)
  const [isPending, startTransition] = useTransition()
  const { toast } = useToast()
  const searchParams = useSearchParams()
  const router = useRouter()

  useEffect(() => {
    // Check for success message in URL
    const success = searchParams.get("success")
    const message = searchParams.get("message")
    if (success === "true" && message) {
      toast({
        title: "Success",
        description: message,
        duration: 5000
      })

      // Remove query params after showing toast
      router.replace("/host/reports")
    }
  }, [searchParams, toast, router])

  useEffect(() => {
    // Get user data
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user)
    })
  }, [])

  const chairPositions = [
    "Chair",
    "Co-Chair",
    "Program Chair",
    "Program Co-Chair",
    "Speaker Researcher",
    "Panelist Researcher",
    "Panelist Researcher Co-Chair",
    "Marathon Meeting Chair",
    "Entertainment Chair",
    "Entertainment Co-Chair",
    "Pre-Conference Event Chair",
    "Events Chair",
    "Events Co-Chair",
    "Facilities Chair",
    "Facilities Co-Chair",
    "Audio/Visual Chair",
    "Audio/Visual Co-Chair",
    "Security Chair",
    "Security Co-Chair",
    "Hospitality Chair",
    "Hospitality Co-Chair",
    "Signage Chair",
    "Accessibility Chair",
    "Transportation Chair",
    "Clean Up & Room Facilitator",
    "Treasurer",
    "Co-Treasurer",
    "Outreach Chair",
    "Outreach Co-Chair",
    "Minnesota Outreach Chair",
    "MNYPAA Liaison",
    "National Outreach Chair",
    "International Outreach Chair",
    "Foreign Languages Outreach Chair",
    "LGBTQIA+ Outreach Chair",
    "Social Media Chair",
    "Bid Committee Liaison",
    "IT Chair",
    "IT Co-Chair",
    "Calendar Chair",
    "Registration Chair",
    "Registration Co-Chair",
    "Arts, Graphics, & Print (AGP) Chair",
    "Arts, Graphics, & Print (AGP) Co-Chair",
    "Merchandise Chair",
    "Merchandise Co-Chair",
    "Souvenirs and Memorabilia Chair",
    "Volunteer Chair",
    "Greeter Chair",
    "Twin Cities Information & Concessions Chair",
    "Secretary",
    "Service Liaison Chair",
    "Service Liaison Co-Chair",
    "General Service Liaison",
    "Central Office/Intergroup Liaison",
    "12th Step Call Chair",
    "H&I/HTF/CFC Chair",
    "PI/CPC",
    "Literature Chair",
    "Grapevine Chair",
    "Al-Anon/Alateen Liaison",
    "Co-Secretary",
    "Current Practices (Bylaws) Chair",
    "Archivist",
    "Archives Photographer",
    "Serenity/Unity Chair",
    "ICYPAA Service Representative",
    "Member-at-Large"
  ]

  const positionOptions: ComboboxOption[] = chairPositions.map((position) => ({
    value: position,
    label: position
  }))

  const handleSubmitReport = (formData: FormData) => {
    startTransition(async () => {
      try {
        await submitReport(formData)
        // Toast is handled by URL parameters
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to submit report. Please try again.",
          variant: "destructive"
        })
      }
    })
  }

  const handleSubmitNothingToReport = (formData: FormData) => {
    startTransition(async () => {
      try {
        await submitNothingToReport(formData)
        // Toast is handled by URL parameters
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to submit report. Please try again.",
          variant: "destructive"
        })
      }
    })
  }

  return (
    <div className="container mx-auto py-8">
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <h1 className="text-2xl font-bold">Submit Report</h1>
          <p className="text-sm text-muted-foreground">
            Reports will be sent to the Main Meeting
          </p>
        </CardHeader>
        <CardContent>
          <form className="space-y-6">
            <input type="hidden" name="userId" value={user?.id} />
            <input type="hidden" name="team" value="MAIN_MEETING" />

            <div className="space-y-2">
              <Label htmlFor="chairPosition">Position</Label>
              <Combobox
                options={positionOptions}
                value={selectedPosition}
                onValueChange={setSelectedPosition}
                placeholder="Select a position..."
                searchPlaceholder="Search position..."
                emptyMessage="No position found."
                name="chairPosition"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="completedWork">
                What have you completed since the last meeting?
              </Label>
              <Textarea
                id="completedWork"
                name="completedWork"
                rows={4}
                placeholder="Describe tasks or projects you've completed since the last meeting..."
                className="resize-none"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="currentWork">What are you working on?</Label>
              <Textarea
                id="currentWork"
                name="currentWork"
                rows={4}
                placeholder="Describe your current projects and tasks..."
                className="resize-none"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="needsHelp">What do you need help with?</Label>
              <Textarea
                id="needsHelp"
                name="needsHelp"
                rows={4}
                placeholder="Describe any challenges or areas where you need assistance..."
                className="resize-none"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="shareInMeeting">
                What feels pertinent to verbally share in the meeting?
              </Label>
              <Textarea
                id="shareInMeeting"
                name="shareInMeeting"
                rows={4}
                placeholder="Describe anything that feels pertinent to verbally share in the meeting..."
                className="resize-none"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="teamMeetingItems">
                What can be done in our team meeting to help?
              </Label>
              <Textarea
                id="teamMeetingItems"
                name="teamMeetingItems"
                rows={4}
                placeholder="Suggest topics or actions for the team meeting..."
                className="resize-none"
              />
            </div>

            <div className="flex space-x-4">
              <Button
                type="submit"
                className="flex-1"
                formAction={handleSubmitReport}
                disabled={isPending}
              >
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  "Submit Report"
                )}
              </Button>
              <Button
                type="submit"
                className="flex-1"
                variant="outline"
                formAction={handleSubmitNothingToReport}
                disabled={isPending}
              >
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  "Submit Nothing to Report"
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
      <Toaster />
    </div>
  )
}
