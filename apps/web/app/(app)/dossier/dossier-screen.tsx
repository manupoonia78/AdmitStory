"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@admitstory/ui";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { StoriesTab } from "./stories-tab";
import type {
  DossierBrandView,
  DossierFactView,
  DossierGoalsView,
  DossierPersonView,
  DossierStoryView,
  DossierVoiceView,
} from "./types";

// The Dossier (spec §5.3, screen C): Stories, Facts, Brand, Voice. The open tab lives in the URL,
// so the Studio can link straight to a conflict and a reload keeps your place.
//
// Only the tab you are on is loaded. Stories is the default and ships with the page; the other
// three arrive when you open them, which keeps the route inside its JS budget (spec §6.11).

const loading = () => <div className="h-64" />;

const FactsTab = dynamic(() => import("./facts-tab").then((mod) => mod.FactsTab), { loading });
const BrandTab = dynamic(() => import("./brand-tab").then((mod) => mod.BrandTab), { loading });
const VoiceTab = dynamic(() => import("./voice-tab").then((mod) => mod.VoiceTab), { loading });

const TABS = [
  { id: "stories", label: "Stories" },
  { id: "facts", label: "Facts" },
  { id: "brand", label: "Brand" },
  { id: "voice", label: "Voice" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export interface DossierScreenProps {
  stories: DossierStoryView[];
  facts: DossierFactView[];
  people: DossierPersonView[];
  brand: DossierBrandView | null;
  voice: DossierVoiceView;
  goals: DossierGoalsView | null;
}

export function DossierScreen({ stories, facts, people, brand, voice, goals }: DossierScreenProps) {
  const router = useRouter();
  const params = useSearchParams();
  const requested = params.get("tab");
  const tab: TabId = TABS.some((entry) => entry.id === requested)
    ? (requested as TabId)
    : "stories";

  const setTab = useCallback(
    (next: string) => {
      const search = new URLSearchParams(params);
      search.set("tab", next);
      router.replace(`/dossier?${search.toString()}`, { scroll: false });
    },
    [params, router],
  );

  const conflicts = facts.filter((fact) => fact.status === "conflict").length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-display-sm text-text">Your Dossier</h1>
        <p className="max-w-prose text-text-soft">
          Everything we know about you, and the only thing your drafts are built from. Correct
          anything that isn&apos;t right.
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          {TABS.map((entry) => (
            <TabsTrigger key={entry.id} value={entry.id}>
              {entry.label}
              {entry.id === "facts" && conflicts > 0 ? (
                <span className="ms-2 rounded-full bg-needs/15 px-2 text-xs font-semibold text-needs">
                  {conflicts}
                </span>
              ) : null}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="stories">
          <StoriesTab stories={stories} people={people} />
        </TabsContent>
        <TabsContent value="facts">
          <FactsTab facts={facts} />
        </TabsContent>
        <TabsContent value="brand">
          <BrandTab brand={brand} stories={stories} />
        </TabsContent>
        <TabsContent value="voice">
          <VoiceTab voice={voice} goals={goals} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
