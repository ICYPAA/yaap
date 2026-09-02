import { Button } from "@/components/ui/button";
import {
  HELP_SECTIONS,
  getHelpTopicId,
  type HelpSection,
  type HelpTopic,
} from "@/lib/help-content";
import { ArrowLeft, ArrowRight, Check, Info } from "lucide-react";
import Link from "next/link";

function DocumentationTopic({ topic }: { topic: HelpTopic }) {
  const topicId = getHelpTopicId(topic.title);

  return (
    <section
      id={topicId}
      className="scroll-mt-8 border-t py-10 first:border-t-0"
    >
      <h2 className="text-2xl font-semibold tracking-tight">{topic.title}</h2>

      <div className="mt-5 space-y-5">
        {topic.body?.map((paragraph) => (
          <p
            key={paragraph}
            className="max-w-3xl text-base leading-8 text-muted-foreground"
          >
            {paragraph}
          </p>
        ))}

        {topic.steps ? (
          <div className="my-7 border-y">
            {topic.steps.map((step, index) => (
              <div
                key={step}
                className="grid grid-cols-[2.5rem_1fr] gap-3 border-b py-4 last:border-b-0"
              >
                <span className="font-mono text-sm text-muted-foreground">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <p className="text-sm leading-6">{step}</p>
              </div>
            ))}
          </div>
        ) : null}

        {topic.checklist ? (
          <div className="my-7 space-y-3 rounded-lg border bg-muted/40 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.14em]">
              Readiness checklist
            </p>
            {topic.checklist.map((item) => (
              <div key={item} className="flex gap-3 text-sm leading-6">
                <Check className="mt-1 h-4 w-4 shrink-0" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        ) : null}

        {topic.example ? (
          <div className="my-7 rounded-lg border bg-muted/50 px-5 py-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em]">
              Example
            </p>
            <p className="text-sm leading-7 text-muted-foreground">
              {topic.example}
            </p>
          </div>
        ) : null}

        {topic.caution ? (
          <aside
            className="my-7 flex gap-3 rounded-lg border bg-background px-5 py-4"
            aria-label="Important"
          >
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em]">
                Important
              </p>
              <p className="text-sm leading-7 text-muted-foreground">
                {topic.caution}
              </p>
            </div>
          </aside>
        ) : null}
      </div>
    </section>
  );
}

export function HelpDocument({ section }: { section: HelpSection }) {
  const sectionIndex = HELP_SECTIONS.findIndex(
    (item) => item.id === section.id,
  );
  const previous = HELP_SECTIONS[sectionIndex - 1];
  const next = HELP_SECTIONS[sectionIndex + 1];

  return (
    <div className="grid xl:grid-cols-[minmax(0,48rem)_12rem] xl:gap-16">
      <article className="px-5 py-10 md:px-10 md:py-14 xl:px-14">
        <nav
          className="mb-8 text-sm text-muted-foreground"
          aria-label="Breadcrumb"
        >
          <Link href="/help" className="hover:text-foreground">
            Documentation
          </Link>
          <span className="mx-2">/</span>
          <span>{section.label}</span>
        </nav>

        <header className="border-b pb-10">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {section.label}
          </p>
          <h1 className="text-4xl font-semibold tracking-[-0.035em] md:text-5xl">
            {section.title}
          </h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-muted-foreground">
            {section.summary}
          </p>
        </header>

        {section.topics.map((topic) => (
          <DocumentationTopic key={topic.title} topic={topic} />
        ))}

        <nav
          className="mt-8 grid gap-3 border-t pt-8 sm:grid-cols-2"
          aria-label="Adjacent documentation"
        >
          {previous ? (
            <Button
              asChild
              variant="outline"
              className="h-auto justify-start py-4"
            >
              <Link href={`/help/${previous.id}`}>
                <ArrowLeft className="mr-3 h-4 w-4" />
                <span className="text-left">
                  <span className="block text-xs text-muted-foreground">
                    Previous
                  </span>
                  <span className="block">{previous.title}</span>
                </span>
              </Link>
            </Button>
          ) : (
            <div />
          )}
          {next ? (
            <Button
              asChild
              variant="outline"
              className="h-auto justify-end py-4"
            >
              <Link href={`/help/${next.id}`}>
                <span className="text-right">
                  <span className="block text-xs text-muted-foreground">
                    Next
                  </span>
                  <span className="block">{next.title}</span>
                </span>
                <ArrowRight className="ml-3 h-4 w-4" />
              </Link>
            </Button>
          ) : null}
        </nav>
      </article>

      <aside className="hidden py-14 pr-8 xl:block">
        <div className="sticky top-8 border-l pl-5">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            On this page
          </p>
          <nav className="space-y-2" aria-label="On this page">
            {section.topics.map((topic) => (
              <a
                key={topic.title}
                href={`#${getHelpTopicId(topic.title)}`}
                className="block text-sm leading-5 text-muted-foreground hover:text-foreground"
              >
                {topic.title}
              </a>
            ))}
          </nav>
        </div>
      </aside>
    </div>
  );
}
