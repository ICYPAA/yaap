import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card"
import { hasPermission } from "@/utils/permissions"
import { createClient } from "@/utils/supabase/server"
import { AlertTriangle } from "lucide-react"
import { redirect } from "next/navigation"
import ProgramManagementContent from "./program-management-content"

export default async function ProgramManagementPage() {
  const supabase = await createClient()

  // Get current user
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser()

  if (userError || !user) {
    redirect("/auth/login")
  }

  // Check if user has permission to access program management
  const hasAccess = await hasPermission(
    user.id,
    ["admin", "steering"],
    ["program:edit"]
  )

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
              You don&apos;t have permission to access this page
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Insufficient Permissions</AlertTitle>
              <AlertDescription>
                Conference-management access is required to manage the app.
                Please contact an administrator if you believe this is an
                error.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    )
  }

  return <ProgramManagementContent />
}
