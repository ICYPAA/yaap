import { Button } from "@/components/ui/button";
import { ExternalLink, Mail, MapPin } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Contact the 66th ICYPAA",
  description:
    "Conference and app support information for the 66th ICYPAA in Grand Rapids, Michigan.",
};

export default function ContactPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-14 sm:py-20">
      <header className="max-w-3xl space-y-5">
        <p className="text-sm font-medium uppercase tracking-[0.16em] text-muted-foreground">
          Contact and support
        </p>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          How can we help?
        </h1>
        <p className="max-w-2xl text-lg leading-8 text-muted-foreground">
          Find support for the 66th ICYPAA conference app or get in touch with
          the ICYPAA Advisory Council.
        </p>
      </header>

      <div className="mt-12 grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)]">
        <section className="rounded-2xl bg-muted/50 p-6 sm:p-8">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-background shadow-sm">
            <Mail className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="mt-6 max-w-xl space-y-3">
            <h2 className="text-2xl font-semibold tracking-tight">
              Conference and app questions
            </h2>
            <p className="leading-7 text-muted-foreground">
              Direct contact information for the 66th host committee is still
              being finalized. In the meantime, the ICYPAA Advisory Council can
              route conference questions to the right person.
            </p>
          </div>
          <div className="mt-7 flex flex-wrap gap-3">
            <Button asChild>
              <a href="mailto:advisory@icypaa.org">Email advisory@icypaa.org</a>
            </Button>
            <Button variant="outline" asChild>
              <a
                href="https://www.icypaa.org/contact"
                target="_blank"
                rel="noreferrer"
              >
                Official contact page
                <ExternalLink aria-hidden="true" />
              </a>
            </Button>
          </div>
        </section>

        <aside className="rounded-2xl bg-muted/20 p-6 sm:p-8">
          <div className="flex items-center gap-3">
            <MapPin className="h-5 w-5" aria-hidden="true" />
            <h2 className="font-semibold">The 66th ICYPAA</h2>
          </div>
          <dl className="mt-6 divide-y divide-foreground/10 text-sm">
            <div className="space-y-1 pb-4">
              <dt className="text-muted-foreground">Dates</dt>
              <dd className="font-medium">September 3–6, 2026</dd>
            </div>
            <div className="space-y-1 py-4">
              <dt className="text-muted-foreground">Venue</dt>
              <dd className="font-medium">Amway Grand Plaza Hotel</dd>
            </div>
            <div className="space-y-1 pt-4">
              <dt className="text-muted-foreground">Address</dt>
              <dd className="font-medium">
                187 Monroe Ave NW
                <br />
                Grand Rapids, MI 49503
              </dd>
            </div>
          </dl>
        </aside>
      </div>

      <div className="mt-12 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-foreground/10 pt-8 text-sm text-muted-foreground">
        <span>Looking for the app overview?</span>
        <Link
          href="/marketing"
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          Visit the marketing page
        </Link>
      </div>
    </div>
  );
}
