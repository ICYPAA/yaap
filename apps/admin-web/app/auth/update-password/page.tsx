import { AuthCard } from "@/components/auth-card";
import { Button } from "@/components/ui/button";
import { UpdatePasswordForm } from "@/components/update-password-form";
import { createClient } from "@/utils/supabase/server";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Change password | YAAP Admin",
};

export default async function UpdatePasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="w-full max-w-5xl px-5 py-8 sm:py-12">
      <AuthCard
        eyebrow="Account security"
        title={user ? "Choose a new password" : "Recovery link required"}
        description={
          user
            ? `Update the password for ${user.email ?? "your account"}.`
            : "Open the secure link from your password-reset email to continue."
        }
      >
        {user ? (
          <UpdatePasswordForm />
        ) : (
          <div className="space-y-3">
            <Button className="w-full" asChild>
              <Link href="/auth/forgot-password">Request a new reset link</Link>
            </Button>
            <Button variant="ghost" className="w-full" asChild>
              <Link href="/">Return to sign in</Link>
            </Button>
          </div>
        )}
      </AuthCard>
    </div>
  );
}
