import { dossierConsolidateFn } from "./functions/dossier-consolidate";
import { importParseUploadFn } from "./functions/import-parse-upload";
import { kbIngestSourceFn } from "./functions/kb-ingest-source";
import { kbRefreshCheckFn } from "./functions/kb-refresh-check";
import { checksRerunFn } from "./functions/checks-rerun";
import { kitDraftOptionFn } from "./functions/kit-draft-option";
import { kitGenerateFn } from "./functions/kit-generate";
import { kitPreviewFn } from "./functions/kit-preview";
import { profileReadFn } from "./functions/profile-read";
import { signupCompleted } from "./functions/signup-completed";
import { strategyFitFn, strategyPackPublishedFn } from "./functions/strategy-fit";

/** Every function served at /api/inngest. */
export const functions = [
  signupCompleted,
  dossierConsolidateFn,
  importParseUploadFn,
  kbIngestSourceFn,
  kbRefreshCheckFn,
  profileReadFn,
  strategyFitFn,
  strategyPackPublishedFn,
  kitPreviewFn,
  kitGenerateFn,
  kitDraftOptionFn,
  checksRerunFn,
];

export { dossierConsolidate, importParseUpload, inngest, userCreated } from "./client";
export {
  emitUserCreated,
  evalsRun,
  kbPackPublished,
  kbRefreshRequested,
  kbSourceAdded,
  kitPreviewRequested,
  profileReadRequested,
  strategyFitRequested,
} from "./events";
