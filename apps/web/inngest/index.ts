import { accountDeleteFn } from "./functions/account-delete";
import { spendWatchFn } from "./functions/admin-spend-watch";
import { dossierConsolidateFn } from "./functions/dossier-consolidate";
import { evalsRunFn } from "./functions/evals-run";
import { importParseUploadFn } from "./functions/import-parse-upload";
import { kbIngestSourceFn } from "./functions/kb-ingest-source";
import { kbRefreshCheckFn } from "./functions/kb-refresh-check";
import { checksRerunFn } from "./functions/checks-rerun";
import { kitDraftOptionFn } from "./functions/kit-draft-option";
import { kitGenerateFn } from "./functions/kit-generate";
import { kitPreviewFn } from "./functions/kit-preview";
import { lorBriefFn } from "./functions/lor-brief";
import { profileReadFn } from "./functions/profile-read";
import { recommenderRemindersFn } from "./functions/recommender-reminders";
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
  lorBriefFn,
  recommenderRemindersFn,
  spendWatchFn,
  evalsRunFn,
  accountDeleteFn,
];

export { dossierConsolidate, importParseUpload, inngest, userCreated } from "./client";
export {
  accountDeleteRequested,
  adminSpendWatch,
  emitUserCreated,
  evalsRun,
  kbPackPublished,
  kbRefreshRequested,
  kbSourceAdded,
  kitPreviewRequested,
  lorBriefRequested,
  profileReadRequested,
  recommenderRemindersRun,
  strategyFitRequested,
} from "./events";
