import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card"
import USGraph from "@/components/us-graph"
import { createClient } from "@/utils/supabase/server"
import {
  CalendarDays,
  Clock,
  FileText,
  Globe2,
  Link2,
  Mail,
  MailPlus,
  MapPin,
  QrCode,
  Shield,
  Users
} from "lucide-react"
import { getTranslations } from "next-intl/server"
import Link from "next/link"

const getDaysUntil = (date: string) => {
  const conferenceDate = new Date(date)
  const today = new Date()
  const timeDiff = conferenceDate.getTime() - today.getTime()
  const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24))
  return daysDiff
}

function getPercentChange(current: number, previous: number) {
  if (!current || !previous) return 0

  const difference = Math.abs(current - previous)
  const sign = previous > current ? -1 : 1 // Negative if decreased, positive if increased
  const percentChange = (difference / previous) * 100 * sign

  return percentChange.toFixed(2)
}

function getReadableDate(dateString: string) {
  return new Date(dateString + "T12:00:00Z").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  })
}

function getReadableTime(time: string) {
  const timeDate = new Date()
  const [hours, minutes] = time.split(":")
  timeDate.setHours(+hours, +minutes)
  return timeDate.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  })
}

function timeAgo(isoTimestamp: string) {
  const currentTime = Date.now()
  const pastTime = new Date(isoTimestamp).getTime()
  const differenceInSeconds = Math.floor((currentTime - pastTime) / 1000)

  if (differenceInSeconds < 60) {
    return `${differenceInSeconds} second${differenceInSeconds === 1 ? "" : "s"}`
  }

  const differenceInMinutes = Math.floor(differenceInSeconds / 60)
  if (differenceInMinutes < 60) {
    return `${differenceInMinutes} minute${differenceInMinutes === 1 ? "" : "s"}`
  }

  const differenceInHours = Math.floor(differenceInMinutes / 60)
  if (differenceInHours < 24) {
    return `${differenceInHours} hour${differenceInHours === 1 ? "" : "s"}`
  }

  const differenceInDays = Math.floor(differenceInHours / 24)
  return `${differenceInDays} day${differenceInDays === 1 ? "" : "s"}`
}

export default async function ProtectedPage() {
  const supabase = await createClient()

  const { data: events } = await supabase
    .from("pre-conf-events")
    .select("*")
    .gt("date", new Date().toISOString())
    .order("date", { ascending: false })

  const { data: registrationsList } = await supabase
    .from("registrations")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(2)

  const { data: activityRaw } = await supabase
    .from("activity")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(5)

  const {
    data: { users }
  } = await (
    await createClient(process.env.SUPABASE_SERVICE_ROLE_KEY)
  ).auth.admin.listUsers()

  const { data: profileNames } = await supabase
    .from("profile-names")
    .select("*")

  // Get latest registration for stats
  const latestRegistration = registrationsList?.[0]

  const activity = activityRaw?.map((a: any) => {
    const user = users.find((u: any) => u.id === a.user)
    const profileName = profileNames?.find(
      (p: any) => p.user_id === a.user
    )?.profile_name
    return {
      user: profileName,
      avatar: user?.user_metadata.avatar_url || "",
      action: a.action,
      time: timeAgo(a.created_at)
    }
  })

  const registrations = registrationsList?.[0]?.registrations || 0
  const previousRegistrations = registrationsList?.[1]?.registrations || 0

  // Get current and previous stats
  const currentStats = registrationsList?.[0]
  const previousStats = registrationsList?.[1]

  const statesChange = getPercentChange(
    currentStats?.us_states || 0,
    previousStats?.us_states || 0
  )

  const countriesChange = getPercentChange(
    currentStats?.countries || 0,
    previousStats?.countries || 0
  )

  const t = await getTranslations("pages.host.ProtectedPage")

  return (
    <div className="space-y-8 p-6">
      <h1 className="text-3xl font-bold mb-6">{t("title")}</h1>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Registrations
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{registrations}</div>
            <p className="text-xs text-muted-foreground">
              {t("cards.totalRegistrations.content", {
                value: getPercentChange(registrations, previousRegistrations)
              })}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              States Registered
            </CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {currentStats?.us_states || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {Number(statesChange) > 0
                ? `+${statesChange}% from last report`
                : Number(statesChange) < 0
                  ? `${statesChange}% from last report`
                  : "No change from last report"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Countries Registered
            </CardTitle>
            <Globe2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {currentStats?.countries || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {Number(countriesChange) > 0
                ? `+${countriesChange}% from last report`
                : Number(countriesChange) < 0
                  ? `${countriesChange}% from last report`
                  : "No change from last report"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t("cards.timeToConference.title")}
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {t("cards.timeToConference.content", {
                value: getDaysUntil("2025-08-28")
              })}
            </div>
            <p className="text-xs text-muted-foreground">August 28-31, 2025</p>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
          <CardHeader>
            <CardTitle>Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Prominent Submit Report Button - Hidden for now */}
            {/* <Link href="/host/reports" className="block">
              <div className="group relative overflow-hidden rounded-lg border-2 border-primary/20 bg-gradient-to-r from-primary/5 to-primary/10 p-6 transition-all hover:border-primary/40 hover:shadow-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 group-hover:bg-primary/20 transition-colors">
                      <MailPlus className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold">Submit a Report</h3>
                      <p className="text-sm text-muted-foreground">Share your committee updates with the host</p>
                    </div>
                  </div>
                  <svg className="h-5 w-5 text-primary opacity-50 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </Link> */}

            {/* Other Actions Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-muted-foreground">
                  Registration
                </h3>
                <div className="space-y-2">
                  <Button className="w-full justify-start" asChild>
                    <Link href="/host/registration">
                      <FileText className="mr-2 h-4 w-4 flex-shrink-0" />
                      <span
                        className="truncate"
                        title="Registration Reports"
                      >
                        Registration Reports
                      </span>
                    </Link>
                  </Button>
                </div>
                <h3 className="text-sm font-medium text-muted-foreground">
                  Program
                </h3>
                <div className="space-y-2">
                  <Button className="w-full justify-start" asChild>
                    <Link href="/host/program-management">
                      <FileText className="mr-2 h-4 w-4 flex-shrink-0" />
                      <span className="truncate" title="Program Management">
                        Program Management
                      </span>
                    </Link>
                  </Button>
                  <Button className="w-full justify-start" asChild>
                    <Link href="/host/panels">
                      <FileText className="mr-2 h-4 w-4 flex-shrink-0" />
                      <span className="truncate" title="Panel Management">
                        Panel Management
                      </span>
                    </Link>
                  </Button>
                  <Button className="w-full justify-start" asChild>
                    <Link href="/host/chairpeople">
                      <Users className="mr-2 h-4 w-4 flex-shrink-0" />
                      <span className="truncate" title="Chairperson Management">
                        Chairperson Management
                      </span>
                    </Link>
                  </Button>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-medium text-muted-foreground">
                  Administration
                </h3>
                <div className="space-y-2">
                  <Button className="w-full justify-start" asChild>
                    <Link href="/host/role-management">
                      <Shield className="mr-2 h-4 w-4 flex-shrink-0" />
                      <span className="truncate" title="Role Management">
                        Role Management
                      </span>
                    </Link>
                  </Button>
                  <Button className="w-full justify-start" asChild>
                    <Link href="/host/account-linking">
                      <Link2 className="mr-2 h-4 w-4 flex-shrink-0" />
                      <span className="truncate" title="Account Linking">
                        Account Linking
                      </span>
                    </Link>
                  </Button>
                  <Button className="w-full justify-start" asChild>
                    <Link href="/host/shift-scheduling">
                      <CalendarDays className="mr-2 h-4 w-4 flex-shrink-0" />
                      <span className="truncate" title="Shift Scheduling">
                        Shift Scheduling
                      </span>
                    </Link>
                  </Button>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-medium text-muted-foreground">
                  Events
                </h3>
                <div className="space-y-2">
                  {/* Manage Volunteers button removed */}
                  <Button className="w-full justify-start" asChild>
                    <Link href="/host/volunteer-interest">
                      <Users className="mr-2 h-4 w-4 flex-shrink-0" />
                      <span className="truncate" title="Volunteer Interest">
                        Volunteer Interest
                      </span>
                    </Link>
                  </Button>
                  {/* Volunteer Notifications button removed */}
                </div>
                <h3 className="text-sm font-medium text-muted-foreground">
                  Outreach
                </h3>
                <div className="space-y-2">
                  <Button className="w-full justify-start" asChild>
                    <Link href="/host/qr-code">
                      <QrCode className="mr-2 h-4 w-4 flex-shrink-0" />
                      <span className="truncate" title="Generate QR Code">
                        Generate QR Code
                      </span>
                    </Link>
                  </Button>
                  <Button className="w-full justify-start" asChild>
                    <Link href="/host/url-generator">
                      <Link2 className="mr-2 h-4 w-4 flex-shrink-0" />
                      <span className="truncate" title="Create Location URL">
                        Create Location URL
                      </span>
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7 mt-6">
        <Card className="col-span-4 lg:col-span-2">
          <CardHeader>
            <CardTitle>{t("cards.recentActivity.title")}</CardTitle>
            <CardDescription>
              {t("cards.recentActivity.description")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {activity?.map((a, index) => (
                <div key={index} className="flex items-center">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={a.avatar} alt={a.user} />
                    <AvatarFallback>{a.user?.[0]}</AvatarFallback>
                  </Avatar>
                  <div className="ml-4 space-y-1">
                    <p className="text-sm font-medium leading-none">{a.user}</p>
                    <p className="text-sm text-muted-foreground">{a.action}</p>
                  </div>
                  <div className="ml-auto font-medium text-sm text-muted-foreground">
                    {a.time}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-4 lg:col-span-5">
          <CardHeader>
            <CardTitle>US Registrations</CardTitle>
          </CardHeader>
          <CardContent>
            <USGraph />
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Event Calendar</CardTitle>
          <CardDescription>View upcoming host events</CardDescription>
        </CardHeader>
        <CardContent>
          <iframe
            src="https://calendar.google.com/calendar/embed?src=the65thicypaahost%40gmail.com&ctz=America%2FChicago&showPrint=0&showNav=1&showTitle=0&showCalendars=0&showTz=1&mode=MONTH&wkst=1&bgcolor=%23ffffff&color=%23039BE5"
            style={{
              border: 0,
              filter: "var(--calendar-filter)",
              overflow: "hidden"
            }}
            className="[--calendar-filter:none] dark:[--calendar-filter:invert(88%)_hue-rotate(180deg)_!important]"
            width="100%"
            height="600"
          />
        </CardContent>
      </Card>

    </div>
  )
}
