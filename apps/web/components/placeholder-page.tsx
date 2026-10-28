import { EmptyState } from "@admitstory/ui";
import { Page } from "./page-header";

export interface PlaceholderPageProps {
  title: string;
  emptyTitle: string;
  emptyDescription: string;
}

/** An area that isn't built yet: the title, and a calm, honest empty state (spec §6.7). */
export function PlaceholderPage({ title, emptyTitle, emptyDescription }: PlaceholderPageProps) {
  return (
    <Page title={title}>
      <section className="rounded-panel border border-line bg-paper">
        {/* Left-aligned (EmptyState's default): the line can wrap on narrow screens (spec §6.4). */}
        <EmptyState title={emptyTitle} description={emptyDescription} align="start" />
      </section>
    </Page>
  );
}
