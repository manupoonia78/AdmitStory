"use client";

import { Button, EmptyState, TextField } from "@admitstory/ui";
import { TRAITS } from "@admitstory/shared";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AlertMessage, StatusMessage } from "@/components/live-message";
import type { DossierBrandView, DossierStoryView } from "./types";

// Brand (spec §5.3c): three or four traits the evidence supports, shown as trait → the stories that
// prove it, proposed by the system and accepted or edited by the applicant. The positioning line is
// internal and labelled as such, because it is never submitted anywhere.

export function BrandTab({
  brand,
  stories,
}: {
  brand: DossierBrandView | null;
  stories: DossierStoryView[];
}) {
  const router = useRouter();
  const [traits, setTraits] = useState(brand?.traits ?? []);
  const [line, setLine] = useState(brand?.positioningLine ?? "");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const byCode = new Map(stories.map((story) => [story.code, story] as const));

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/dossier/brand", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          traits,
          positioningLine: line.trim() === "" ? null : line.trim(),
        }),
      });
      if (!response.ok) {
        const result = (await response.json()) as { error?: string };
        setError(result.error ?? "That didn't save.");
        return;
      }
      setMessage("Brand saved.");
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  if (!brand || traits.length === 0)
    return (
      <EmptyState
        title="No brand yet"
        description="Once there are a few confirmed stories, we'll propose the three or four traits your evidence actually supports — and show you which stories prove each one."
        action={
          <Button asChild>
            <Link href="/studio">Keep talking</Link>
          </Button>
        }
      />
    );

  return (
    <div className="flex flex-col gap-6">
      <p className="max-w-prose text-text-soft">
        These are the traits your stories actually prove. Change them if they are not how you want
        to be read; a trait without evidence behind it is worse than one fewer.
      </p>

      <ul className="flex flex-col gap-4">
        {traits.map((trait, index) => (
          <li
            key={trait.traitId}
            className="flex flex-col gap-2 rounded-plane border border-edge p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-text">Trait</span>
                <select
                  value={trait.traitId}
                  onChange={(event) =>
                    setTraits(
                      traits.map((entry, position) =>
                        position === index ? { ...entry, traitId: event.target.value } : entry,
                      ),
                    )
                  }
                  className="min-h-11 rounded-control border border-control-edge bg-depth px-3 text-text"
                >
                  {TRAITS.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.label}
                    </option>
                  ))}
                </select>
              </label>
              <Button
                variant="quiet"
                onClick={() => setTraits(traits.filter((_, position) => position !== index))}
              >
                Remove
              </Button>
            </div>
            {trait.why ? <p className="text-text-soft">{trait.why}</p> : null}
            <div className="flex flex-col gap-1">
              <h3 className="text-sm font-semibold text-text">Proved by</h3>
              <ul className="flex flex-wrap gap-2">
                {trait.storyCodes.map((code) => {
                  const story = byCode.get(code);
                  return (
                    <li
                      key={code}
                      className="rounded-control border border-edge px-2 py-0.5 text-sm text-text"
                    >
                      {story?.nickname ?? code}
                    </li>
                  );
                })}
                {trait.storyCodes.length === 0 ? (
                  <li className="text-sm text-text-soft">No stories linked yet.</li>
                ) : null}
              </ul>
            </div>
          </li>
        ))}
      </ul>

      <div className="flex flex-col gap-2">
        <TextField
          label="Positioning line"
          hint="Internal only — this is never submitted anywhere. It is how we keep your file consistent."
          value={line}
          onChange={(event) => setLine(event.target.value)}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => void save()} disabled={saving}>
          {saving ? "Saving…" : "Save brand"}
        </Button>
        {brand.accepted ? (
          <span className="text-sm text-text-soft">You&apos;ve accepted this.</span>
        ) : null}
      </div>

      <StatusMessage message={message} />
      <AlertMessage message={error} />
    </div>
  );
}
