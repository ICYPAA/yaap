"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/utils/supabase/client";
import { CheckCircle2, Mail } from "lucide-react";
import Link from "next/link";
import { FormEvent, useState } from "react";

export function PasswordRecoveryForm() {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function requestReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const callbackUrl = new URL("/auth/callback", window.location.origin);
    callbackUrl.searchParams.set("next", "/auth/update-password");

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email,
      { redirectTo: callbackUrl.toString() },
    );

    if (resetError) {
      setError(resetError.message);
      setLoading(false);
      return;
    }

    setSubmittedEmail(email);
    setLoading(false);
  }

  if (submittedEmail) {
    return (
      <div className="space-y-5">
        <Alert>
          <CheckCircle2 />
          <AlertTitle>Check your inbox</AlertTitle>
          <AlertDescription>
            If an account exists for {submittedEmail}, its reset link is on the
            way. The link will return you here to choose a new password.
          </AlertDescription>
        </Alert>
        <Button variant="outline" className="w-full" asChild>
          <Link href="/">Return to sign in</Link>
        </Button>
      </div>
    );
  }

  return (
    <form className="space-y-5" onSubmit={requestReset}>
      <div className="space-y-2">
        <Label htmlFor="recovery-email">Email address</Label>
        <Input
          id="recovery-email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
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
        disabled={loading}
      >
        <Mail />
        {loading ? "Sending..." : "Send reset link"}
      </Button>
      <Button variant="ghost" className="w-full" asChild>
        <Link href="/">Back to sign in</Link>
      </Button>
    </form>
  );
}
