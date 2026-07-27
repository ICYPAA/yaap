"use client"

import { createClient } from "@/utils/supabase/client"
import { useRouter } from "next/navigation"
import { FormEvent, useState } from "react"
import { Button } from "./ui/button"
import { Input } from "./ui/input"

export const SignInButton = () => {
  const supabase = createClient()
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const localAuthEnabled =
    process.env.NEXT_PUBLIC_ENABLE_LOCAL_AUTH === "true"

  async function signInWithDiscord() {
    await supabase.auth.signInWithOAuth({
      provider: "discord",
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_URL!}/auth/callback`,
        scopes: "identify email"
      }
    })
  }

  async function signInLocally(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError(null)

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    if (signInError) {
      setError(signInError.message)
      setLoading(false)
      return
    }

    router.push("/host")
    router.refresh()
  }

  return (
    <div className="space-y-4">
      <Button
        size="sm"
        variant="outline"
        onClick={signInWithDiscord}
        className="w-full"
      >
        Sign in with Discord
      </Button>

      {localAuthEnabled ? (
        <>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" />
            Local development
            <div className="h-px flex-1 bg-border" />
          </div>
          <form className="space-y-3" onSubmit={signInLocally}>
            <Input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Local account email"
              autoComplete="email"
              data-testid="local-email"
              required
            />
            <Input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Local account password"
              autoComplete="current-password"
              data-testid="local-password"
              required
            />
            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}
            <Button
              type="submit"
              className="w-full"
              data-testid="local-sign-in"
              disabled={loading}
            >
              {loading ? "Signing in..." : "Sign in locally"}
            </Button>
          </form>
        </>
      ) : null}
    </div>
  )
}
