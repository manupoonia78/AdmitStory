export {
  MagicLinkEmail,
  magicLinkCopy,
  magicLinkSubject,
  type MagicLinkEmailProps,
} from "./magic-link-email";
export {
  DEFAULT_MAGIC_LINK_MINUTES,
  renderMagicLinkEmail,
  type MagicLinkEmailInput,
  type RenderedEmail,
} from "./render";
export {
  RecommenderCheckinEmail,
  recommenderCheckinCopy,
  recommenderCheckinSubject,
  recommenderCheckinText,
  type RecommenderCheckinEmailProps,
} from "./recommender-checkin-email";
export {
  RecommenderInviteEmail,
  recommenderInviteCopy,
  recommenderInviteSubject,
  recommenderInviteText,
  type RecommenderInviteEmailProps,
} from "./recommender-invite-email";
export {
  RecommenderLinkEmail,
  recommenderLinkCopy,
  recommenderLinkSubject,
  recommenderLinkText,
  type RecommenderLinkEmailProps,
} from "./recommender-link-email";
export {
  RECOMMENDER_LINK_PLACEHOLDER,
  renderRecommenderCheckinEmail,
  renderRecommenderInviteEmail,
  renderRecommenderLinkEmail,
  type RecommenderCheckinEmailInput,
  type RecommenderEmailPeople,
  type RecommenderEmailSchool,
  type RecommenderInviteEmailInput,
  type RecommenderLinkEmailInput,
} from "./recommender-render";
export {
  AccountDeletedEmail,
  AdminAlertEmail,
  accountDeletedCopy,
  accountDeletedSubject,
  renderAccountDeletedEmail,
  renderAdminAlertEmail,
  type AdminAlertEmailInput,
} from "./ops-emails";
