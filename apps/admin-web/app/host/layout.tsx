import { createClient } from "@/utils/supabase/server"
import { getUserRoles } from "@/utils/permissions"
import { redirect } from "next/navigation"

export default async function HostLayout({
  children
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user }
  } = await supabase.auth.getUser()

  if (!user) return redirect("/")

  const roles = await getUserRoles(user.id)
  if (roles.length === 0) return redirect("/unauthorized")

  return <div className="w-full max-w-[1400px] mx-auto">{children}</div>
}
