import HeaderAuth from "@/components/header-auth"
import { ThemeSwitcher } from "@/components/theme-switcher"
import { Button } from "@/components/ui/button"
import { hasEnvVars } from "@/utils/supabase/check-env-vars"
import { createClient } from "@/utils/supabase/server"
import { GeistSans } from "geist/font/sans"
import { CircleHelp } from "lucide-react"
import { NextIntlClientProvider } from "next-intl"
import { getLocale, getMessages } from "next-intl/server"
import { ThemeProvider } from "next-themes"
import Link from "next/link"
import { Providers } from "./providers"

import "./globals.css"

const defaultUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000"

export const metadata = {
  metadataBase: new URL(defaultUrl),
  title: "YAAP Admin",
  description: "Conference and mobile app administration"
}

export default async function RootLayout({
  children
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  await getLocale()
  const messages = await getMessages()

  const {
    data: { user }
  } = await supabase.auth.getUser()

  return (
    <html lang="en" className={GeistSans.className} suppressHydrationWarning>
      <NextIntlClientProvider messages={messages}>
        <body className="bg-background text-foreground">
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <Providers>
              <main className="min-h-screen flex flex-col items-center">
                <div className="flex-1 w-full flex flex-col items-center">
                  <nav className="w-full flex justify-center border-b border-b-foreground/10 h-16 bg-background">
                    <div className="w-full max-w-6xl flex items-center p-3 px-5 text-sm gap-2">
                      <div className="flex gap-5 items-center font-semibold flex-grow">
                        <Link href="/" className="flex items-center gap-2">
                          <span>YAAP Admin</span>
                        </Link>
                        {user && (
                          <Button variant="outline" size="sm" asChild>
                            <Link href="/host">Dashboard</Link>
                          </Button>
                        )}
                      </div>
                      <Button variant="ghost" size="icon" asChild>
                        <Link href="/help" aria-label="Open dashboard help">
                          <CircleHelp className="h-5 w-5" aria-hidden="true" />
                        </Link>
                      </Button>
                      <ThemeSwitcher />
                      {hasEnvVars ? <HeaderAuth /> : null}
                    </div>
                  </nav>
                  {children}
                </div>
              </main>
            </Providers>
          </ThemeProvider>
        </body>
      </NextIntlClientProvider>
    </html>
  )
}
