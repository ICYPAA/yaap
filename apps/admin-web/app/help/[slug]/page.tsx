import { HelpDocument } from "@/components/help-document";
import { HELP_SECTIONS, getHelpSection } from "@/lib/help-content";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

type HelpPageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return HELP_SECTIONS.map((section) => ({ slug: section.id }));
}

export async function generateMetadata({
  params,
}: HelpPageProps): Promise<Metadata> {
  const { slug } = await params;
  const section = getHelpSection(slug);

  if (!section) return {};

  return {
    title: `${section.title} | YAAP Documentation`,
    description: section.summary,
  };
}

export default async function HelpFeaturePage({ params }: HelpPageProps) {
  const { slug } = await params;
  const section = getHelpSection(slug);

  if (!section) notFound();

  return <HelpDocument section={section} />;
}
