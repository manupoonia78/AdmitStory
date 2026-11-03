// The recommender emails (Phase 6 plan §7): the invitation, the check-ins and the fresh link from
// /r. Each returns subject, HTML and text, and the text part stands on its own — a recommender who
// reads mail as plain text gets the deadlines, the link and the privacy line, not a stub.
//
// `url` may be the preview placeholder RECOMMENDER_LINK_PLACEHOLDER, so the applicant can read the
// text and the app can hash it (sha256(subject + "\n" + text)) before a token exists. The raw link
// itself is only ever put in an email addressed to the recommender (decision 7).

import { render } from "@react-email/render";
import { createElement } from "react";
import {
  RecommenderCheckinEmail,
  recommenderCheckinSubject,
  recommenderCheckinText,
} from "./recommender-checkin-email";
import {
  RecommenderInviteEmail,
  recommenderInviteSubject,
  recommenderInviteText,
} from "./recommender-invite-email";
import {
  RecommenderLinkEmail,
  recommenderLinkSubject,
  recommenderLinkText,
} from "./recommender-link-email";
import type { RenderedEmail } from "./render";

export const RECOMMENDER_LINK_PLACEHOLDER = "[your private link]";

export interface RecommenderEmailPeople {
  applicant: { name: string; firstName: string };
  recommender: { name: string; firstName: string };
}

export interface RecommenderEmailSchool {
  name: string;
  /** ISO date, or null when the school's deadline isn't known. */
  deadline: string | null;
}

export interface RecommenderInviteEmailInput extends RecommenderEmailPeople {
  /** The brief's cover note, in the applicant's voice. */
  coverNote: string;
  schools: readonly RecommenderEmailSchool[];
  /** The portal link, or RECOMMENDER_LINK_PLACEHOLDER for a preview. */
  url: string;
  /** ISO time the link stops working. */
  expiresAt: string;
}

export interface RecommenderCheckinEmailInput extends RecommenderEmailPeople {
  kind: "checkin_3w" | "checkin_1w";
  schools: readonly RecommenderEmailSchool[];
  /** The applicant's own line (≤ 300 characters), or null. */
  note: string | null;
  url: string;
  expiresAt: string;
}

export interface RecommenderLinkEmailInput extends RecommenderEmailPeople {
  url: string;
  expiresAt: string;
}

export async function renderRecommenderInviteEmail(
  input: RecommenderInviteEmailInput,
): Promise<RenderedEmail> {
  return {
    subject: recommenderInviteSubject(input),
    html: await render(createElement(RecommenderInviteEmail, input)),
    text: recommenderInviteText(input),
  };
}

export async function renderRecommenderCheckinEmail(
  input: RecommenderCheckinEmailInput,
): Promise<RenderedEmail> {
  return {
    subject: recommenderCheckinSubject(input),
    html: await render(createElement(RecommenderCheckinEmail, input)),
    text: recommenderCheckinText(input),
  };
}

export async function renderRecommenderLinkEmail(
  input: RecommenderLinkEmailInput,
): Promise<RenderedEmail> {
  return {
    subject: recommenderLinkSubject(input),
    html: await render(createElement(RecommenderLinkEmail, input)),
    text: recommenderLinkText(input),
  };
}
