import { getDb } from "@admitstory/db";
import { ai } from "@/lib/ai";
import { isLocalAppUrl, serverEnv } from "@/lib/env";
import { getSession } from "@/lib/session";
// The fixed, synthetic sample passage the util.title replay fixture was recorded with (spec §0).
import { UTIL_TITLE_SAMPLE } from "../../../../../../packages/ai/scripts/util-title-sample";

// Phase 0 acceptance inside the built app (spec §16): a sample util.title call records tokens and
// cost in usage_ledger. Development only, by the same rule as the email outbox (ADR 0002): it is a
// 404 unless APP_URL is localhost and the request has a session, so it doesn't exist on a deployed
// host. It runs in replay mode only, so it never reaches the network or spends money.

function notFound(): Response {
  return new Response("Not found", { status: 404 });
}

export async function POST(): Promise<Response> {
  const env = serverEnv();
  if (!isLocalAppUrl(env.APP_URL)) return notFound();
  const session = await getSession();
  if (!session) return notFound();
  if (env.AI_MODE !== "replay") {
    return Response.json(
      { error: "The AI smoke route runs only with AI_MODE=replay." },
      { status: 409 },
    );
  }

  const userId = session.user.id;
  const db = getDb();
  const ledgerIds = async () =>
    (
      await db.query.usageLedger.findMany({
        columns: { id: true },
        where: (ledger, { and, eq }) =>
          and(eq(ledger.userId, userId), eq(ledger.task, "util.title")),
      })
    ).map((row) => row.id);

  const before = new Set(await ledgerIds());
  const { title } = await ai().run("util.title", { text: UTIL_TITLE_SAMPLE }, { userId });
  await ai().flush();

  const added = (await ledgerIds()).filter((id) => !before.has(id));
  const [newId] = added;
  const row =
    added.length === 1 && newId
      ? await db.query.usageLedger.findFirst({ where: (ledger, { eq }) => eq(ledger.id, newId) })
      : undefined;
  if (!row) {
    return Response.json(
      { error: `Expected one new usage_ledger row, found ${added.length}.` },
      { status: 500 },
    );
  }

  return Response.json({
    title,
    ledger: {
      id: row.id,
      task: row.task,
      aiMode: row.aiMode,
      attemptKind: row.attemptKind,
      inputTokens: row.inputTokens,
      outputTokens: row.outputTokens,
      cacheReadTokens: row.cacheReadTokens,
      cacheWrite5mTokens: row.cacheWrite5mTokens,
      cacheWrite1hTokens: row.cacheWrite1hTokens,
      costUsd: row.costUsd,
    },
  });
}
