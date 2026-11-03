// Recommender portal tokens (spec §14.6, Phase 6 decision 9, docs/decisions/0006). A link carries
// 32 random bytes as base64url (43 characters). Only its sha256 is stored, so a database read never
// yields a working link; the raw token exists only in the email sent to the recommender.
//
// The invited address is stored as a hash too, wherever it binds a workspace or an invite, so the
// binding can be checked without keeping a second copy of the address next to the content.

import { createHash, randomBytes } from "node:crypto";

const TOKEN_BYTES = 32;
/** 32 bytes in unpadded base64url. */
const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;

const sha256 = (value: string) => createHash("sha256").update(value, "utf8").digest("hex");

/** A fresh portal token: the raw value for the link and the hash to store. */
export function newPortalToken(): { raw: string; hash: string } {
  const raw = randomBytes(TOKEN_BYTES).toString("base64url");
  return { raw, hash: sha256(raw) };
}

/**
 * The stored hash of a token from a link, or "" for anything that isn't a 43-character base64url
 * value. "" never matches a stored hash, so a malformed link resolves like an unknown one.
 */
export function hashPortalToken(raw: string): string {
  return typeof raw === "string" && TOKEN_RE.test(raw) ? sha256(raw) : "";
}

/** sha256 of an address, trimmed and lower-cased, so "Ravi@Example.test " binds like "ravi@example.test". */
export function hashEmail(email: string): string {
  return sha256(email.trim().toLowerCase());
}
