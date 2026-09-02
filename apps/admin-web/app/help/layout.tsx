import { HelpDocsShell } from "@/components/help-docs-shell";

export default function HelpLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <HelpDocsShell>{children}</HelpDocsShell>;
}
