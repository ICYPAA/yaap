"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  HELP_SECTIONS,
  filterHelpSections,
  getHelpTopicId,
} from "@/lib/help-content";
import { cn } from "@/lib/utils";
import { BookOpen, Menu, Search, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";

const NAV_GROUPS = [
  {
    title: "Fundamentals",
    ids: ["getting-started", "conference-state", "program-details", "design"],
  },
  {
    title: "Program",
    ids: ["events", "promoted-events", "faq-content"],
  },
  {
    title: "Attendee experience",
    ids: [
      "services",
      "feature-switches",
      "maps-venue",
      "hospitality-hours",
      "food-activities",
    ],
  },
  {
    title: "Administration",
    ids: ["access-control", "review-troubleshooting"],
  },
] as const;

function DocsNavigation({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Documentation pages" className="space-y-7">
      {NAV_GROUPS.map((group) => (
        <div key={group.title}>
          <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {group.title}
          </p>
          <div className="space-y-0.5">
            {group.ids.map((id) => {
              const section = HELP_SECTIONS.find((item) => item.id === id);
              if (!section) return null;
              const href = `/help/${section.id}`;
              const active = pathname === href;

              return (
                <Link
                  key={section.id}
                  href={href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "block rounded-md px-3 py-2 text-sm leading-5 transition-colors",
                    active
                      ? "bg-foreground font-medium text-background"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  {section.title}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

function DocsSearch() {
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const deferredQuery = useDeferredValue(query);
  const searchRef = useRef<HTMLInputElement>(null);
  const results = useMemo(
    () => filterHelpSections(HELP_SECTIONS, deferredQuery).slice(0, 6),
    [deferredQuery],
  );

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };

    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  const showResults = focused && query.trim().length > 0;

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        ref={searchRef}
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => window.setTimeout(() => setFocused(false), 120)}
        placeholder="Search documentation"
        aria-label="Search documentation"
        className="h-10 bg-background pl-9 pr-12"
      />
      {query ? (
        <button
          type="button"
          onClick={() => {
            setQuery("");
            searchRef.current?.focus();
          }}
          aria-label="Clear documentation search"
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      ) : (
        <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
          ⌘K
        </kbd>
      )}

      {showResults ? (
        <div className="absolute left-0 right-0 top-12 z-50 max-h-[26rem] overflow-y-auto rounded-lg border bg-popover p-1.5 shadow-xl">
          {results.length > 0 ? (
            results.map((section) => (
              <div key={section.id}>
                {section.topics.map((topic) => (
                  <Link
                    key={topic.title}
                    href={`/help/${section.id}#${getHelpTopicId(topic.title)}`}
                    onClick={() => {
                      setQuery("");
                      setFocused(false);
                    }}
                    className="block rounded-md px-3 py-2.5 hover:bg-muted"
                  >
                    <span className="block text-sm font-medium">
                      {topic.title}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                      {section.title}
                    </span>
                  </Link>
                ))}
              </div>
            ))
          ) : (
            <p className="px-3 py-5 text-center text-sm text-muted-foreground">
              No documentation found.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}

export function HelpDocsShell({ children }: { children: React.ReactNode }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="w-full bg-background">
      <div className="border-b bg-background">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-5 py-4 md:px-8">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="lg:hidden"
            onClick={() => setMobileNavOpen((open) => !open)}
            aria-label="Toggle documentation navigation"
            aria-expanded={mobileNavOpen}
          >
            <Menu className="h-4 w-4" />
          </Button>
          <Link href="/help" className="flex shrink-0 items-center gap-2">
            <BookOpen className="h-4 w-4" />
            <span className="text-sm font-semibold">Documentation</span>
          </Link>
          <div className="ml-auto w-full max-w-md">
            <DocsSearch />
          </div>
        </div>
      </div>

      {mobileNavOpen ? (
        <div className="border-b bg-background px-5 py-5 lg:hidden">
          <DocsNavigation onNavigate={() => setMobileNavOpen(false)} />
        </div>
      ) : null}

      <div className="mx-auto grid min-h-[calc(100vh-8rem)] w-full max-w-7xl lg:grid-cols-[17rem_minmax(0,1fr)]">
        <aside className="hidden border-r px-5 py-8 lg:block">
          <div className="sticky top-8">
            <DocsNavigation />
          </div>
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
