import { Button } from "@/components/ui/button";
import { Bell, CalendarCheck2, ExternalLink, MapPinned } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "66th ICYPAA Conference App",
  description:
    "The conference companion for the 66th ICYPAA in Grand Rapids, Michigan, September 3–6, 2026.",
};

const appHighlights = [
  {
    title: "Keep the weekend organized",
    description:
      "Browse the program, find the sessions that matter to you, and keep your conference plans close at hand.",
    icon: CalendarCheck2,
  },
  {
    title: "Know where to go",
    description:
      "Find meeting rooms, hospitality, registration, merchandise, and other conference services.",
    icon: MapPinned,
  },
  {
    title: "Stay current",
    description:
      "See the latest conference information and receive updates when attendee notifications are enabled.",
    icon: Bell,
  },
];

export default function MarketingPage() {
  return (
    <div className="w-full">
      <section className="mx-auto grid w-full max-w-6xl gap-10 px-5 py-14 sm:py-20 lg:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)] lg:items-center">
        <div className="max-w-3xl space-y-7">
          <p className="text-sm font-medium uppercase tracking-[0.16em] text-muted-foreground">
            The 66th ICYPAA · Grand Rapids, Michigan
          </p>
          <div className="space-y-5">
            <h1 className="max-w-4xl text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
              The whole conference, easier to navigate.
            </h1>
            <p className="max-w-2xl text-lg leading-8 text-muted-foreground">
              The official conference companion brings the program, venue
              details, attendee services, and timely updates together for the
              66th ICYPAA.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/contact">Get conference support</Link>
            </Button>
            <Button variant="outline" asChild>
              <a href="https://www.icypaa.org" target="_blank" rel="noreferrer">
                About ICYPAA
                <ExternalLink aria-hidden="true" />
              </a>
            </Button>
          </div>
        </div>

        <aside className="rounded-2xl bg-muted/60 p-6 sm:p-8">
          <div className="flex items-center gap-4">
            <Image
              src="/logo-512.png"
              alt="66th ICYPAA — On Awakening"
              width={88}
              height={88}
              className="rounded-2xl"
              priority
            />
            <div>
              <p className="font-semibold">On Awakening</p>
              <p className="text-sm text-muted-foreground">The 66th ICYPAA</p>
            </div>
          </div>
          <dl className="mt-8 divide-y divide-foreground/10 text-sm">
            <div className="grid grid-cols-[6rem_1fr] gap-4 py-4">
              <dt className="text-muted-foreground">When</dt>
              <dd className="font-medium">September 3–6, 2026</dd>
            </div>
            <div className="grid grid-cols-[6rem_1fr] gap-4 py-4">
              <dt className="text-muted-foreground">Where</dt>
              <dd className="font-medium">Grand Rapids, Michigan</dd>
            </div>
            <div className="grid grid-cols-[6rem_1fr] gap-4 pt-4">
              <dt className="text-muted-foreground">Venue</dt>
              <dd className="font-medium">Amway Grand Plaza Hotel</dd>
            </div>
          </dl>
        </aside>
      </section>

      <section className="border-y border-foreground/10 bg-muted/20">
        <div className="mx-auto w-full max-w-6xl px-5 py-14 sm:py-16">
          <div className="mb-10 max-w-2xl space-y-3">
            <p className="text-sm font-medium text-muted-foreground">
              Made for the conference weekend
            </p>
            <h2 className="text-3xl font-semibold tracking-tight">
              Useful information without the clutter.
            </h2>
          </div>

          <div className="grid gap-x-10 gap-y-8 md:grid-cols-3">
            {appHighlights.map((highlight) => {
              const Icon = highlight.icon;
              return (
                <article key={highlight.title} className="space-y-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-background shadow-sm">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-semibold">{highlight.title}</h3>
                    <p className="text-sm leading-6 text-muted-foreground">
                      {highlight.description}
                    </p>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-5 py-12 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Need help before the event?</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Visit the support page for conference and app contact options.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/contact">Contact and support</Link>
        </Button>
      </section>
    </div>
  );
}
