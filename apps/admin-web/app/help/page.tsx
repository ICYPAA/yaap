import { Button } from "@/components/ui/button";
import { HELP_SECTIONS } from "@/lib/help-content";
import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Documentation | YAAP Admin",
  description:
    "Operating documentation for conference programs, events, maps, services, app features, and dashboard access.",
};

const WORKFLOW = [
  {
    number: "01",
    title: "Plan",
    description:
      "Select the conference, keep it in Planning, and establish dates, rooms, branding, and ownership.",
  },
  {
    number: "02",
    title: "Build",
    description:
      "Create categories and events, publish maps and local information, then configure attendee content.",
  },
  {
    number: "03",
    title: "Operate",
    description:
      "Enable only services that have staffing, notification, response, and escalation workflows.",
  },
  {
    number: "04",
    title: "Verify",
    description:
      "Test the complete attendee experience on real devices before changing the conference to Active.",
  },
];

export default function HelpPage() {
  return (
    <main className="px-5 py-10 md:px-10 md:py-16 xl:px-16">
      <div className="max-w-4xl">
        <p className="mb-4 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          YAAP administration guide
        </p>
        <h1 className="max-w-3xl text-4xl font-semibold tracking-[-0.04em] md:text-6xl">
          Documentation for operating the conference app.
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
          Learn what every dashboard feature does, how to configure it, and what
          your conference team needs in place before attendees can rely on it.
        </p>

        <div className="mt-10 flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/help/getting-started">
              Start with conference setup
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/help/maps-venue">Add venue maps</Link>
          </Button>
        </div>
      </div>

      <section
        className="mt-20 max-w-5xl border-t"
        aria-labelledby="workflow-title"
      >
        <div className="grid gap-8 py-10 md:grid-cols-[15rem_1fr]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Recommended workflow
            </p>
            <h2 id="workflow-title" className="mt-2 text-2xl font-semibold">
              From empty program to launch
            </h2>
          </div>
          <ol className="border-t">
            {WORKFLOW.map((item) => (
              <li
                key={item.number}
                className="grid gap-2 border-b py-5 sm:grid-cols-[3rem_8rem_1fr]"
              >
                <span className="font-mono text-sm text-muted-foreground">
                  {item.number}
                </span>
                <span className="font-semibold">{item.title}</span>
                <span className="text-sm leading-6 text-muted-foreground">
                  {item.description}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mt-8 max-w-5xl" aria-labelledby="all-docs-title">
        <div className="border-b pb-5">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            All documentation
          </p>
          <h2 id="all-docs-title" className="mt-2 text-3xl font-semibold">
            Feature guides
          </h2>
        </div>

        <div>
          {HELP_SECTIONS.map((section, index) => (
            <Link
              key={section.id}
              href={`/help/${section.id}`}
              className="group grid gap-3 border-b py-6 transition-colors hover:bg-muted/50 sm:grid-cols-[3rem_14rem_1fr_2rem] sm:px-2"
            >
              <span className="font-mono text-xs text-muted-foreground">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="font-semibold">{section.title}</span>
              <span className="text-sm leading-6 text-muted-foreground">
                {section.summary}
              </span>
              <ArrowRight className="hidden h-4 w-4 transition-transform group-hover:translate-x-1 sm:block" />
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
