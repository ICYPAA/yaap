"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/utils/supabase/client";
import { CheckCircle2, KeyRound } from "lucide-react";
import Link from "next/link";
import { FormEvent, useState } from "react";

export function UpdatePasswordForm() {
  const supabase = createClient();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function updatePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Use at least 8 characters for your new password.");
      return;
    }

    if (password !== confirmation) {
      setError("The passwords do not match.");
      return;
    }

    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

    setComplete(true);
    setLoading(false);
  }

  if (complete) {
    return (
      <div className="space-y-5">
        <Alert>
          <CheckCircle2 />
          <AlertTitle>Password updated</AlertTitle>
          <AlertDescription>
            Your new password is active. You can continue to the control board.
          </AlertDescription>
        </Alert>
        <Button className="w-full" asChild>
          <Link href="/host">Continue to dashboard</Link>
        </Button>
      </div>
    );
  }

  return (
    <form className="space-y-5" onSubmit={updatePassword}>
      <div className="space-y-2">
        <Label htmlFor="new-password">New password</Label>
        <Input
          id="new-password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="new-password"
          minLength={8}
          required
        />
        <p className="text-xs text-muted-foreground">
          Use at least 8 characters. A unique passphrase works best.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirm-password">Confirm new password</Label>
        <Input
          id="confirm-password"
          type="password"
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          autoComplete="new-password"
          minLength={8}
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
        <KeyRound />
        {loading ? "Updating..." : "Update password"}
      </Button>
    </form>
  );
}
