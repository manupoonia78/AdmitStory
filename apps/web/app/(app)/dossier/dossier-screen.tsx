"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@admitstory/ui";
import dynamic from "next/dynamic";
import { CaretLeftIcon } from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, type CSSProperties } from "react";
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
    <div className="mx-auto flex w-full max-w-[70rem] flex-col gap-10 px-5 pt-6 pb-16 sm:px-10 sm:pt-10 lg:px-14 lg:pt-14">
      <header className="flex flex-col">
        <Link
          href="/settings"
          className="label -ml-1 inline-flex min-h-11 items-center gap-1.5 self-start px-1 hover:text-text"
        >
          <CaretLeftIcon size={12} weight="bold" aria-hidden />
          Settings
        </Link>
        <h1 className="enter mt-2 text-display-2 text-text">
          Your <span className="serif-accent">dossier.</span>
        </h1>
        <p
          className="enter mt-4 max-w-[60ch] text-lg text-text-soft"
          style={{ "--i": 0.8 } as CSSProperties}
        >
          Everything we know about you, and the only thing your drafts are built from. Correct
          anything that isn&apos;t right.
        </p>
      </header>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          {TABS.map((entry) => (
            <TabsTrigger key={entry.id} value={entry.id}>
              {entry.label}
              {entry.id === "facts" && conflicts > 0 ? (
                <span className="ms-2 inline-grid size-[18px] place-items-center rounded-full bg-needs font-mono text-[11px] text-on-signal">
                  {conflicts}
                  <span className="sr-only"> need you</span>
                </span>
              ) : null}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="stories" className="pt-8">
          <StoriesTab stories={stories} people={people} />
        </TabsContent>
        <TabsContent value="facts" className="pt-8">
          <FactsTab facts={facts} />
        </TabsContent>
        <TabsContent value="brand" className="pt-8">
          <BrandTab brand={brand} stories={stories} />
        </TabsContent>
        <TabsContent value="voice" className="pt-8">
          <VoiceTab voice={voice} goals={goals} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
