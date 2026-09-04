import { AuthCard } from "@/components/auth-card";
import { SignInButton } from "@/components/login-button";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/host");
  }

  return (
    <div className="w-full max-w-5xl px-5 py-8 sm:py-12">
      <AuthCard
        eyebrow="Conference control board"
        title="Welcome back"
        description="Sign in with your hosting-party account to manage the program and conference app."
      >
        <SignInButton />
      </AuthCard>
    </div>
  );
}
