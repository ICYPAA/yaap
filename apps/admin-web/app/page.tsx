import { SignInButton } from "@/components/login-button"
import { createClient } from "@/utils/supabase/server"
import { redirect } from "next/navigation"

export default async function HomePage() {
  const supabase = await createClient()
  const {
    data: { user }
  } = await supabase.auth.getUser()

  if (user) {
    redirect("/host")
  }

  return (
    <div className="w-full max-w-2xl mx-auto p-6 md:p-12">
      <div className="rounded-lg border p-8 space-y-4">
        <h1 className="text-2xl font-semibold">YAAP Admin</h1>
        <p className="text-muted-foreground">
          Sign in with your approved account to access host tools.
        </p>
        <SignInButton />
      </div>
    </div>
  )
}
