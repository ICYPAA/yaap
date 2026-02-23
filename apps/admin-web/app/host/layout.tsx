import { createClient } from "@/utils/supabase/server"
import { headers } from "next/headers"
import { redirect } from "next/navigation"

export default async function HostLayout({
  children
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const pathname = (await headers()).get("x-current-path") || ""
  console.log("Pathname:", pathname)

  const {
    data: { user }
  } = await supabase.auth.getUser()

  if (!user && !pathname.startsWith("/host/panels/confirm")) {
    console.log("Redirecting from host layout to / due to missing user")
    return redirect("/")
  }

  return <div className="w-full max-w-[1400px] mx-auto">{children}</div>
}
