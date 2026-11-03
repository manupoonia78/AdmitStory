"use client";

import type { RecommendersPageView } from "@admitstory/shared/kit";
import {
  Button,
  EmptyState,
  RECOMMENDERS_COPY,
  RecommenderForm,
  RecommenderList,
  Sheet,
  SheetContent,
  type RecommenderFormValues,
} from "@admitstory/ui";
import { useRouter } from "next/navigation";
import { useState } from "react";

// Screen H's list (spec §6.10 H): who writes for the applicant, and who still has to be asked.
// Adding someone opens a sheet; the row then links to their own page, so a recommender can be
// opened in a new tab.

export function RecommendersScreen({
  view,
  timeZone: _timeZone,
}: {
  view: RecommendersPageView;
  timeZone: string;
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add(values: RecommenderFormValues) {
    setWorking(true);
    setError(null);
    try {
      const response = await fetch("/api/recommenders", {
        method: "POST",
        headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() },
        body: JSON.stringify({
          ...values,
          title: values.title || undefined,
          organisation: values.organisation || undefined,
          durationText: values.durationText || undefined,
          frequencyText: values.frequencyText || undefined,
        }),
      });
      const body = (await response.json().catch(() => null)) as {
        error?: string;
        recommender?: { id: string };
      } | null;
      if (!response.ok) {
        setError(body?.error ?? "That didn't save. Try again.");
        return;
      }
      setAdding(false);
      if (body?.recommender?.id) router.push(`/recommenders/${body.recommender.id}`);
      else router.refresh();
    } catch {
      setError("That didn't save. Try again.");
    } finally {
      setWorking(false);
    }
  }

  const addButton = (
    <Button onClick={() => setAdding(true)}>{RECOMMENDERS_COPY.emptyAction}</Button>
  );

  return (
    <div className="flex flex-col gap-6">
      {view.recommenders.length === 0 ? (
        <EmptyState
          title={RECOMMENDERS_COPY.emptyTitle}
          description={RECOMMENDERS_COPY.emptyBody}
          action={addButton}
        />
      ) : (
        <div className="flex flex-col gap-4">
          <RecommenderList
            items={view.recommenders}
            selectedId={null}
            hrefFor={(id) => `/recommenders/${id}`}
            onSelect={(id) => router.push(`/recommenders/${id}`)}
            action={addButton}
          />
          <p className="text-sm text-text-soft">{RECOMMENDERS_COPY.pickOne}</p>
        </div>
      )}

      <p className="max-w-prose text-sm text-text-soft">{RECOMMENDERS_COPY.neverShared}</p>

      <Sheet open={adding} onOpenChange={setAdding}>
        <SheetContent title={RECOMMENDERS_COPY.emptyAction}>
          <RecommenderForm
            schools={view.schools}
            suggestions={view.suggestions}
            submitLabel={RECOMMENDERS_COPY.emptyAction}
            onSubmit={(values) => void add(values)}
            working={working}
            error={error}
          />
        </SheetContent>
      </Sheet>
    </div>
  );
}
