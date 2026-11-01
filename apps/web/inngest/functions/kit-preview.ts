import { runKitPreview, setPreviewJob } from "../../lib/strategy/jobs";
import { inngest } from "../client";
import { kitPreviewRequested } from "../events";

// Spec §5.5 kit preview (Manu, 2026-10-31): kit.positioning_filemap once per school, free and
// counted against the free AI cap, stored as a `preview` kit with the dossier snapshot version it
// read, and reused while that version is unchanged. The page polls the stored state; a run that
// fails for good records `failed` so the page can offer "Preview {School} again".

export const kitPreviewFn = inngest.createFunction(
  {
    id: "kit-preview",
    name: "kit/preview",
    triggers: [kitPreviewRequested],
    concurrency: { key: "event.data.userSchoolId", limit: 1 },
    retries: 1,
    onFailure: async ({ event }) => {
      const { userId, userSchoolId } = event.data.event.data;
      await setPreviewJob(userId, userSchoolId, { state: "failed", at: new Date().toISOString() });
    },
  },
  async ({ event, step }) => {
    const { userId, userSchoolId } = event.data;
    return step.run("build the preview", () => runKitPreview(userId, userSchoolId));
  },
);
