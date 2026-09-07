import { pushAccess } from "@/lib/push-policy"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card"
import { getConferenceState } from "@/lib/conference-state"
import {
  normalizeProgramFeatures,
  PROGRAM_FEATURE_DEFINITIONS
} from "@/lib/program-features"
import {
  formatProgramDateRange,
  formatProgramLocation
} from "@/lib/program-utils"
import {
  canAccessRoleManagement,
  hasPermission
} from "@/utils/permissions"
import { createClient } from "@/utils/supabase/server"
import {
  CalendarDays,
  MapPinned,
  Settings2,
  ShieldCheck
} from "lucide-react"
import Link from "next/link"

export default async function ConferenceAdminPage() {
  const supabase = await createClient()
  const {
    data: { user }
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data: notificationRoles } = await supabase.from("roles").select("role,permissions").eq("user_id", user.id)
  const notificationAccess = pushAccess(notificationRoles || [])

  const conferenceState = await getConferenceState()
  const currentProgram = conferenceState.current_program_id
    ? conferenceState.programs
    : null
  const programId = currentProgram?.id

  const [canManageConference, canManageAccess] = await Promise.all([
    hasPermission(user.id, ["admin", "steering"], ["program:edit"]),
    canAccessRoleManagement(user.id)
  ])

  const [eventsResult, categoriesResult, venueResult] = programId
    ? await Promise.all([
        supabase
          .from("events")
          .select("*", { count: "exact", head: true })
          .eq("program_id", programId),
        supabase
          .from("event_categories")
          .select("*", { count: "exact", head: true })
          .eq("program_id", programId),
        supabase
          .from("venues")
          .select("id", { count: "exact", head: true })
          .eq("program_id", programId)
      ])
    : [{ count: 0 }, { count: 0 }, { count: 0 }]

  const programFeatures = currentProgram
    ? normalizeProgramFeatures(currentProgram.features)
    : null
  const enabledFeatures = programFeatures
    ? PROGRAM_FEATURE_DEFINITIONS.filter(
        (feature) => programFeatures[feature.key]
      ).map((feature) => feature.name)
    : []

  return (
    <div className="w-full space-y-8 p-6 md:p-8">
      <div className="space-y-2">
        <p className="text-sm font-medium text-primary">
          Conference administration
        </p>
        <h1 className="text-3xl font-bold">Mobile App Control Board</h1>
        <p className="max-w-3xl text-muted-foreground">
          Configure the active conference, attendee-facing content, and who can
          manage it.
        </p>
      </div>

      <Card data-testid="current-conference-card">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>
                {currentProgram?.title || "No conference selected"}
              </CardTitle>
              <CardDescription>
                {currentProgram
                  ? `${formatProgramDateRange(currentProgram)} • ${formatProgramLocation(currentProgram)}`
                  : "Choose a conference before publishing the mobile app."}
              </CardDescription>
            </div>
            <Badge
              variant={
                conferenceState.status === "active" ? "default" : "secondary"
              }
              className="capitalize"
            >
              {conferenceState.status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg border p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CalendarDays className="h-4 w-4" />
              Program
            </div>
            <p className="mt-2 text-2xl font-semibold">
              {eventsResult.count || 0}
            </p>
            <p className="text-sm text-muted-foreground">
              events in {categoriesResult.count || 0} categories
            </p>
          </div>
          <div className="rounded-lg border p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPinned className="h-4 w-4" />
              Venue
            </div>
            <p className="mt-2 text-2xl font-semibold">
              {venueResult.count ? "Configured" : "Not configured"}
            </p>
            <p className="text-sm text-muted-foreground">
              Maps, amenities, food, and activities
            </p>
          </div>
          <div className="rounded-lg border p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Settings2 className="h-4 w-4" />
              App services
            </div>
            <p className="mt-2 text-2xl font-semibold">
              {enabledFeatures.length}
            </p>
            <p className="text-sm text-muted-foreground">
              attendee features enabled
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings2 className="h-5 w-5" />
              Conference setup
            </CardTitle>
            <CardDescription>
              Manage dates, branding, program events, venue information,
              services, safety content, and feature availability.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {canManageConference ? (
              <Button asChild data-testid="manage-conference-link">
                <Link href="/host/program-management">
                  Manage conference and app
                </Link>
              </Button>
            ) : (
              <p className="text-sm text-muted-foreground">
                Your account has view-only access.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" />
              Access control
            </CardTitle>
            <CardDescription>
              Assign administrative roles and conference-management access.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {canManageAccess ? (
              <Button
                variant="outline"
                asChild
                data-testid="manage-access-link"
              >
                <Link href="/host/role-management">Manage access</Link>
              </Button>
            ) : (
              <p className="text-sm text-muted-foreground">
                Only administrators can manage access.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {notificationAccess.send && <Card><CardHeader><CardTitle>Push notifications</CardTitle><CardDescription>Committee announcements and delivery history.</CardDescription></CardHeader><CardContent className="flex flex-wrap gap-3"><Button asChild><Link href="/host/push-notifications">Committee announcements</Link></Button>{notificationAccess.admin && <Button variant="outline" asChild><Link href="/admin/push-notifications">Administrator diagnostics</Link></Button>}</CardContent></Card>}

      {currentProgram ? (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle>Enabled attendee features</CardTitle>
              {canManageConference ? (
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                  data-testid="edit-feature-settings-link"
                >
                  <Link href="/host/program-management?settings=features">
                    Edit feature settings
                  </Link>
                </Button>
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {enabledFeatures.length > 0 ? (
              enabledFeatures.map((feature) => (
                <Badge key={feature} variant="secondary">
                  {feature}
                </Badge>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                No attendee features are enabled for this conference.
              </p>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
