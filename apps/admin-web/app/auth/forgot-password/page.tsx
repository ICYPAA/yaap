import { AuthCard } from "@/components/auth-card";
import { PasswordRecoveryForm } from "@/components/password-recovery-form";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Reset password | YAAP Admin",
};

export default function ForgotPasswordPage() {
  return (
    <div className="w-full max-w-5xl px-5 py-8 sm:py-12">
      <AuthCard
        eyebrow="Account recovery"
        title="Reset your password"
        description="Enter the email address for your hosting-party account. We’ll send a secure link to choose a new password."
      >
        <PasswordRecoveryForm />
      </AuthCard>
    </div>
  );
}
