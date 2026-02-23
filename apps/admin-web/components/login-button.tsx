"use client"

import { createClient } from "@/utils/supabase/client"
import { Button } from "./ui/button"

export const SignInButton = () => {
  const supabase = createClient()

  async function signInWithDiscord() {
    await supabase.auth.signInWithOAuth({
      provider: "discord",
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_URL!}/auth/callback`,
        scopes: "identify email guilds guilds.members.read" //guilds.members.read guilds.channels.read messages.read"
      }
    })
  }

  return (
    <Button size="sm" variant={"outline"} onClick={signInWithDiscord}>
      Host Login
    </Button>
  )
}
