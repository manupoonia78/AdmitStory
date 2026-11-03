import "server-only";

import type { AI } from "@admitstory/ai";
import {
  createProposals,
  getKbSource,
  insertChunks,
  setKbSourceStatus,
  setKbSourceText,
  type AdminContext,
} from "@admitstory/db";
import {
  UnsupportedSourceError,
  chunkText,
  extractText,
  fetchUrl,
  type FetchUrlOptions,
  type SourceFormat,
} from "@admitstory/kb/ingest";
import { ensureDraft, findCycleByName } from "./drafts";
import { allowedHosts, officialUrlsOf, proposalRows, tryParsePack } from "./pack";

// kb/ingest-source (spec §9.3): extract → chunk (≈600 tokens, 80 overlap) → ai.embed → store the
// chunks with their embeddings → kb.normalize, synchronously for the one source an admin just
// added (decision 2026-10-31), against the cycle's current draft → kb_proposals with conflicts.
//
// Every stage is written to the source's status, and a failure keeps the source and records which
// step failed and why, so the console can say so and offer "Normalise again".

export interface IngestDeps {
  admin: AdminContext;
  ai: Pick<AI, "run" | "embed">;
  /** Tests inject the SSRF-guarded fetch's resolver and transport. */
  fetchOptions?: Pick<FetchUrlOptions, "resolve" | "transport">;
}

export type IngestResult =
  | { status: "ready"; chunks: number; proposals: number }
  | { status: "failed"; step: IngestStep; error: string }
  | { status: "skipped"; reason: string };

export type IngestStep = "reading" | "embedding" | "normalising";

const STEP_LABEL: Record<IngestStep, string> = {
  reading: "Reading the source",
  embedding: "Embedding",
  normalising: "Normalising",
};

/** The Normalizer's input limit (packages/ai KbNormalizeInput). */
const MAX_NORMALIZE_CHARS = 200_000;

class StepError extends Error {
  constructor(
    readonly step: IngestStep,
    message: string,
  ) {
    super(message);
  }
}

function formatForContentType(contentType: string | null, url: string): SourceFormat {
  const type = (contentType ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
  if (type === "application/pdf" || url.toLowerCase().endsWith(".pdf")) return "pdf";
  if (type === "text/plain") return "txt";
  return "html";
}

async function at<T>(step: IngestStep, run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof StepError) throw error;
    const message =
      error instanceof UnsupportedSourceError || error instanceof Error
        ? error.message
        : "unknown error";
    throw new StepError(step, message.slice(0, 600));
  }
}

export async function ingestKbSource(deps: IngestDeps, sourceId: string): Promise<IngestResult> {
  const { admin, ai } = deps;
  const source = await getKbSource(admin, sourceId);
  if (!source) return { status: "skipped", reason: "The source was deleted." };

  try {
    // Extract: pasted text and uploads arrive with their text; a URL is fetched here.
    const text = await at("reading", async () => {
      if (source.text !== null && source.text.trim() !== "") return source.text;
      if (!source.url) throw new Error("This source has no text and no URL to read.");
      await setKbSourceStatus(admin, source.id, "extracting");
      const cycleRef =
        source.schoolId && source.cycle
          ? await findCycleByName(admin, source.schoolId, source.cycle)
          : null;
      const draftUrls = cycleRef ? officialUrlsOf((await ensureDraft(admin, cycleRef)).data) : [];
      const hosts = allowedHosts(cycleRef?.school.website ?? null, draftUrls);
      if (hosts.length === 0)
        throw new Error("The school has no website or official URLs, so no host is allowed.");
      const fetched = await fetchUrl(source.url, { allowHosts: hosts, ...deps.fetchOptions });
      const extracted = await extractText({
        bytes: fetched.bytes,
        format: formatForContentType(fetched.contentType, fetched.url),
        ...(fetched.contentType ? { mimeType: fetched.contentType } : {}),
      });
      if (extracted.needsOcr)
        throw new Error("The page is a scanned PDF with no text layer; OCR isn't connected yet.");
      if (extracted.text.trim().length < 40) throw new Error("The page has almost no text.");
      await setKbSourceText(admin, source.id, extracted.text);
      return extracted.text;
    });

    // Chunk and embed (ai.embed is metered as kb.embed).
    const chunkCount = await at("embedding", async () => {
      await setKbSourceStatus(admin, source.id, "embedding");
      const chunks = chunkText(text);
      const embeddings =
        chunks.length === 0
          ? []
          : await ai.embed(
              chunks.map((chunk) => chunk.text),
              { inputType: "document" },
            );
      await insertChunks(
        admin,
        source.id,
        chunks.map((chunk, i) => ({
          ord: chunk.index,
          text: chunk.text,
          embedding: embeddings[i] ?? null,
          meta: { start: chunk.start, end: chunk.end, tokens: chunk.tokenCount },
        })),
      );
      return chunks.length;
    });

    // Normalise against the cycle's draft. Evergreen sources (no school or cycle) stay retrieval
    // material only: there is no pack to propose changes to.
    const proposals = await at("normalising", async () => {
      if (!source.schoolId || !source.cycle) return 0;
      await setKbSourceStatus(admin, source.id, "normalizing");
      const ref = await findCycleByName(admin, source.schoolId, source.cycle);
      if (!ref)
        throw new Error(
          `This school has no ${source.cycle} cycle yet. Create the cycle, then normalise again.`,
        );
      const draft = await ensureDraft(admin, ref);
      const output = await ai.run("kb.normalize", {
        school: ref.school.name,
        cycle: ref.cycle.cycle,
        source: {
          type: source.type,
          title: source.title.slice(0, 200),
          url: source.url ? source.url.slice(0, 500) : null,
          trust: source.trust,
          text: text.slice(0, MAX_NORMALIZE_CHARS),
        },
        current_pack: JSON.stringify(draft.data),
      });
      const rows = proposalRows(output, {
        source,
        text,
        cycleId: ref.cycle.id,
        packId: draft.id,
        pack: tryParsePack(draft.data),
      });
      await createProposals(admin, rows);
      return rows.length;
    });

    await setKbSourceStatus(admin, source.id, "ready");
    return { status: "ready", chunks: chunkCount, proposals };
  } catch (error) {
    const step = error instanceof StepError ? error.step : "reading";
    const message = error instanceof Error ? error.message : "unknown error";
    await setKbSourceStatus(admin, source.id, "failed", `${STEP_LABEL[step]}: ${message}`);
    return { status: "failed", step, error: message };
  }
}
