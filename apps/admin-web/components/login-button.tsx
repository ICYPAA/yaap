"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/utils/supabase/client";
import { LogIn } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export const SignInButton = () => {
  const supabase = createClient();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<"email" | "discord" | null>(null);

  async function signInWithDiscord() {
    setLoading("discord");
    setError(null);

    const { error: signInError } = await supabase.auth.signInWithOAuth({
      provider: "discord",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        scopes: "identify email guilds guilds.members.read",
      },
    });

    if (signInError) {
      setError(signInError.message);
      setLoading(null);
    }
  }

  async function signInWithEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading("email");
    setError(null);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError(signInError.message);
      setLoading(null);
      return;
    }

    router.push("/host");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <form className="space-y-4" onSubmit={signInWithEmail}>
        <div className="space-y-2">
          <Label htmlFor="admin-email">Email address</Label>
          <Input
            id="admin-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            data-testid="local-email"
            required
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="admin-password">Password</Label>
            <Link
              href="/auth/forgot-password"
              className="text-sm font-medium text-foreground underline-offset-4 hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <Input
            id="admin-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter your password"
            autoComplete="current-password"
            data-testid="local-password"
            required
          />
        </div>
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        <Button
          type="submit"
          className="w-full"
          data-testid="local-sign-in"
          disabled={loading !== null}
        >
          <LogIn />
          {loading === "email" ? "Signing in..." : "Sign in with email"}
        </Button>
      </form>

      <div className="flex items-center gap-3 text-xs uppercase tracking-[0.18em] text-muted-foreground">
        <div className="h-px flex-1 bg-border" />
        or
        <div className="h-px flex-1 bg-border" />
      </div>

      <div className="space-y-2">
        <Button
          type="button"
          variant="outline"
          onClick={signInWithDiscord}
          className="w-full"
          disabled={loading !== null}
        >
          {loading === "discord" ? "Connecting..." : "Continue with Discord"}
        </Button>
        <p className="text-center text-xs leading-relaxed text-muted-foreground">
          Discord remains available for committees that share a server.
        </p>
      </div>
    </div>
  );
};
