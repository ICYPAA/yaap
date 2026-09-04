import { signOutAction } from "@/app/actions";
import { hasEnvVars } from "@/utils/supabase/check-env-vars";
import { createClient } from "@/utils/supabase/server";
import { LogOut } from "lucide-react";
import Link from "next/link";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";

export default async function AuthButton() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profileData } = user
    ? await supabase
        .from("profile-names")
        .select("profile_name")
        .eq("user_id", user.id)
        .maybeSingle()
    : { data: null };

  const username =
    profileData?.profile_name || user?.user_metadata?.full_name || user?.email;

  if (!hasEnvVars) {
    return (
      <>
        <div className="flex gap-4 items-center">
          <div>
            <Badge
              variant={"default"}
              className="font-normal pointer-events-none"
            >
              Please update .env.local file with anon key and url
            </Badge>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant={"outline"} disabled>
              Host Login
            </Button>
          </div>
        </div>
      </>
    );
  }
  return user ? (
    <div className="flex min-w-0 items-center gap-1.5">
      <span
        className="hidden max-w-44 truncate text-muted-foreground lg:inline"
        title={username || undefined}
      >
        {username}
      </span>
      <Button
        size="sm"
        variant="ghost"
        className="hidden sm:inline-flex"
        asChild
      >
        <Link href="/auth/update-password">Change password</Link>
      </Button>
      <form action={signOutAction}>
        <Button
          type="submit"
          size="sm"
          variant="outline"
          aria-label="Log out"
          data-testid="header-log-out"
        >
          <LogOut aria-hidden="true" />
          <span className="hidden sm:inline">Log out</span>
        </Button>
      </form>
    </div>
  ) : null;
}
