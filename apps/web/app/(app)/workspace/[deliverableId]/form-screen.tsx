"use client";

import {
  ChatPanel,
  ConsistencyList,
  FilesPane,
  FormAdvisor,
  WorkspaceLayout,
  copiedEntryMessage,
} from "@admitstory/ui";
import type { ConsistencyFinding, ConsistencyValue } from "@admitstory/linters";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { AlertMessage, StatusMessage } from "@/components/live-message";
import { SchoolHeader } from "@/components/school-header";
import { useChat } from "@/lib/chat/use-chat";
import type { FormView } from "@/lib/forms/view";
import { filesForTab, schoolHref, schoolTabs } from "@/lib/school/tabs";

// Screen G for a form section (spec §5.8, §5.10), inside the school's Application tab: the form
// sections on the left, the Form Advisor in the middle with every mismatch across the file under
// it, and the chat on the right that rewrites entries on request. Entries save as the
// applicant's own text a moment after they stop typing.

const FORM_ASKS = [
  "Lead with impact in every entry",
  "Make these shorter",
  "Add numbers where I have them",
  "Less jargon",
];

const SAVE_DEBOUNCE_MS = 1_000;

async function send(url: string, method: string, body?: unknown): Promise<Response | null> {
  return fetch(url, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  }).catch(() => null);
}

async function errorOf(response: Response | null, fallback: string): Promise<string> {
  if (!response) return fallback;
  const body = (await response.json().catch(() => null)) as { error?: string } | null;
  return body?.error ?? fallback;
}

export function FormScreen({ initial }: { initial: FormView }) {
  const router = useRouter();
  const [view, setView] = useState(initial);
  const [refreshing, setRefreshing] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const pending = useRef(new Map<string, string>());
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const { kitId, section } = view;
  // Bumped after a chat change, so the advisor's entry fields take the new text.
  const [revision, setRevision] = useState(0);

  const reload = useCallback(async () => {
    const response = await send(
      `/api/kits/${kitId}/forms?deliverable=${section.deliverableId}`,
      "GET",
    );
    if (response?.ok) setView((await response.json()) as FormView);
  }, [kitId, section.deliverableId]);

  const flush = useCallback(async () => {
    const edits = [...pending.current];
    pending.current.clear();
    const results = await Promise.all(
      edits.map(([itemId, text]) =>
        send(`/api/kits/${kitId}/forms/items/${itemId}`, "PATCH", { section: section.key, text }),
      ),
    );
    const failed = results.find((r) => !r?.ok);
    if (failed !== undefined)
      setError(
        await errorOf(failed, "Your entry didn't save. Check your connection; it's still here."),
      );
  }, [kitId, section.key]);

  const chat = useChat(`deliverable:${section.deliverableId ?? ""}`, {
    onChanged: async () => {
      await flush();
      await reload();
      setRevision((n) => n + 1);
    },
  });
  const fileHref = (key: string) =>
    key === "resume"
      ? schoolHref(view.userSchoolId, "resume")
      : key === "recommenders"
        ? schoolHref(view.userSchoolId, "recommenders")
        : `/workspace/${key}`;
  const tabs = schoolTabs(
    { userSchoolId: view.userSchoolId, school: view.school, cycle: view.cycle },
    view.files,
  );

  // Leaving the page with an edit waiting: save it now.
  useEffect(() => () => void flush(), [flush]);

  function onEditEntry(itemId: string, text: string) {
    pending.current.set(itemId, text);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), SAVE_DEBOUNCE_MS);
  }

  async function refresh() {
    setRefreshing(true);
    setError("");
    const response = await send(`/api/kits/${kitId}/forms/refresh`, "POST");
    setRefreshing(false);
    if (!response?.ok) {
      setError(await errorOf(response, "The advice didn't refresh. Try again in a moment."));
      return;
    }
    const body = (await response.json()) as { refreshed: boolean };
    setStatus(
      body.refreshed
        ? "The advice now uses your latest Dossier. Your own edits are kept."
        : "The advice already uses your latest Dossier.",
    );
    await reload();
  }

  async function consistency(body: Record<string, string>, done: string) {
    await flush();
    const response = await send("/api/consistency", "POST", body);
    if (!response?.ok) {
      setError(await errorOf(response, "That didn't save. Try again in a moment."));
      return;
    }
    setStatus(done);
    await reload();
  }

  const onUseExpected = (finding: ConsistencyFinding, value: ConsistencyValue) =>
    void consistency(
      { action: "use_expected", findingId: finding.id, docId: value.docId, ref: value.ref },
      `Changed to “${finding.expected ?? ""}” in ${value.docLabel}.`,
    );
  const onDismiss = (finding: ConsistencyFinding) =>
    void consistency(
      { action: "dismiss", findingId: finding.id },
      "Marked as different things. We won't flag it again.",
    );
  const hrefFor = (value: ConsistencyValue): string | null => {
    if (value.docKind === "fact_sheet") return "/dossier";
    if (value.docKind === "resume") return schoolHref(view.userSchoolId, "resume");
    if (value.docKind === "form") {
      const key = value.docId.split(":").slice(2).join(":");
      const id = view.deliverables[`form-${key}`.slice(0, 70)]?.id;
      return id ? `/workspace/${id}` : null;
    }
    return `/workspace/${value.docId}`;
  };
  const shared = { onUseExpected, onDismiss, hrefFor };

  return (
    <WorkspaceLayout
      header={<SchoolHeader view={tabs} active="application" />}
      files={
        <FilesPane
          heading="Application form"
          files={filesForTab(view.files, "application")}
          selectedKey={section.deliverableId ?? ""}
          onSelect={(key) => router.push(fileHref(key))}
          hrefFor={fileHref}
        />
      }
      document={
        <div className="flex flex-col gap-4">
          <FormAdvisor
            key={revision}
            section={section}
            mode={view.mode}
            policyNote={view.policyNote}
            items={section.items}
            couldStillDo={view.couldStillDo}
            consistency={view.consistency}
            stale={view.stale}
            refreshing={refreshing}
            onEditEntry={onEditEntry}
            onCopy={(itemId) => {
              const item = section.items.find((i) => i.id === itemId);
              setStatus(copiedEntryMessage(item?.candidate ?? "the"));
            }}
            onRefresh={() => void refresh()}
            deliverableLabel={(key) => view.deliverables[key]?.title ?? key}
            {...shared}
          />
          <StatusMessage message={status} />
          <AlertMessage message={error} />
          {view.kitConsistency.length > 0 ? (
            <section
              aria-labelledby="form-checks"
              className="mx-4 mb-8 flex flex-col gap-3 border-t border-edge pt-6 sm:mx-8"
            >
              <h2 id="form-checks" className="text-lg font-medium text-text">
                Across your application
              </h2>
              <p className="text-sm text-text-soft">
                Titles, dates, employer names, team sizes and numbers, checked across your résumé,
                {` ${view.school}'s`} form and your essays.
              </p>
              <ConsistencyList findings={view.kitConsistency} {...shared} />
            </section>
          ) : null}
        </div>
      }
      coach={
        <ChatPanel
          turns={chat.turns}
          busy={chat.busy}
          onSend={chat.send}
          onUndo={(id) => void chat.undo(id)}
          subject={`the ${section.label} entries`}
          suggestions={view.mode === "coach" ? [] : FORM_ASKS}
          notice={
            chat.error ? (
              <span className="text-risk">{chat.error}</span>
            ) : view.mode === "coach" ? (
              `${view.school} doesn't allow AI-written form text, so the chat gives pointers instead of rewriting.`
            ) : null
          }
        />
      }
    />
  );
}
