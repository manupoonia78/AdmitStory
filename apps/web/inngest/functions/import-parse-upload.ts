import { getDb, getSource, listFacts } from "@admitstory/db";
import { ai } from "../../lib/ai";
import { persistExtraction } from "../../lib/studio/extract";
import { captureServerEvent } from "../../lib/analytics/server";
import { dossierConsolidate, importParseUpload, inngest } from "../client";

// Spec §7.4 `import/parse-upload`. The upload route has already extracted the document's text and
// stored it encrypted in `sources`; this reads it back, runs import.parse, and writes the facts and
// story candidates into the Fact Sheet and Story Bank, so an applicant who uploads a resume is
// never asked for what it already says (§2 "tell it once", §5.1 AC).

export const importParseUploadFn = inngest.createFunction(
  {
    id: "import-parse-upload",
    name: "import/parse-upload",
    triggers: [importParseUpload],
    concurrency: { key: "event.data.userId", limit: 1 },
    retries: 2,
  },
  async ({ event, step }) => {
    const { userId, sourceId, documentKind, fileName } = event.data;
    const db = getDb();

    const document = await step.run("read the stored text", async () => {
      const source = await getSource(db, userId, sourceId);
      if (!source?.text) return null;
      const facts = await listFacts(db, userId);
      return {
        text: source.text,
        knownFacts: facts.map((fact) => ({
          code: fact.code,
          key: fact.key,
          value: fact.value,
        })),
      };
    });

    // The source is gone or holds no text: nothing to do, and nothing to retry.
    if (!document) return { skipped: true };

    const result = await step.run("extract and store", async () => {
      const output = await ai().run(
        "import.parse",
        {
          text: document.text,
          documentKind,
          fileName,
          knownFacts: document.knownFacts,
        },
        { userId },
      );
      await ai().flush();
      return persistExtraction(userId, output, {
        chapter: documentKind === "resume" || documentKind === "linkedin" ? "work" : "roots",
        sourceId,
      });
    });

    await step.run("record the import", () =>
      captureServerEvent({
        distinctId: userId,
        event: "document_imported",
        properties: {
          kind: documentKind,
          facts: result.factsCreated,
          stories: result.storiesCreated.length,
        },
      }),
    );

    // A resume usually arrives before any conversation; consolidating now means the first question
    // already knows what it said.
    await step.sendEvent(
      "consolidate",
      dossierConsolidate.create({ userId, reason: "import_done" }),
    );

    return { userId, ...result };
  },
);
