// Application-layer encryption for the content spec §14.4 requires it on: transcripts and the text
// of uploaded documents (Phase 1), and later recommender workspaces and mock transcripts. AES-256-
// GCM, keys from the secret store, key id recorded per value.
//
// The key id lives inside the envelope rather than in its own column, so a value can never be
// paired with the wrong key id by a buggy query, and a rotation sweep can still find old rows with
// a prefix match (`text_encrypted LIKE 'v1.oldkey.%'`). Format:
//
//     v1.<keyId>.<iv base64url>.<authTag base64url>.<ciphertext base64url>
//
// GCM's auth tag means a tampered or truncated value fails to decrypt rather than returning
// garbage. Nothing here is a substitute for Postgres encryption at rest; it is the second layer.

import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from "node:crypto";

const VERSION = "v1";
const ALGORITHM = "aes-256-gcm";
const KEY_BYTES = 32;
const IV_BYTES = 12;
const TAG_BYTES = 16;

export class ContentEncryptionError extends Error {
  override name = "ContentEncryptionError";
}

export interface ContentKeyring {
  /** The key new values are written with. */
  activeKeyId: string;
  /** Every key that may still be needed to read existing values, including the active one. */
  keys: ReadonlyMap<string, Buffer>;
}

const KEY_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * Builds the keyring from the environment: CONTENT_ENCRYPTION_KEYS is a JSON object of key id →
 * base64 32-byte key, CONTENT_ENCRYPTION_KEY_ID names the one to write with (spec §17).
 */
export function keyringFromEnv(env: NodeJS.ProcessEnv = process.env): ContentKeyring {
  const raw = env.CONTENT_ENCRYPTION_KEYS;
  const activeKeyId = env.CONTENT_ENCRYPTION_KEY_ID;
  if (!raw || !activeKeyId)
    throw new ContentEncryptionError(
      "CONTENT_ENCRYPTION_KEYS and CONTENT_ENCRYPTION_KEY_ID must be set to store transcripts (spec §14.4)",
    );

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ContentEncryptionError('CONTENT_ENCRYPTION_KEYS must be JSON: {"keyId":"base64"}');
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed))
    throw new ContentEncryptionError("CONTENT_ENCRYPTION_KEYS must be a JSON object");

  const keys = new Map<string, Buffer>();
  for (const [keyId, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (!KEY_ID_PATTERN.test(keyId))
      throw new ContentEncryptionError(
        `Key id ${JSON.stringify(keyId)} must match ${KEY_ID_PATTERN}`,
      );
    if (typeof value !== "string")
      throw new ContentEncryptionError(`Key ${keyId} must be a base64 string`);
    const key = Buffer.from(value, "base64");
    if (key.byteLength !== KEY_BYTES)
      throw new ContentEncryptionError(
        `Key ${keyId} must be ${KEY_BYTES} bytes, got ${key.byteLength}`,
      );
    keys.set(keyId, key);
  }
  if (!keys.has(activeKeyId))
    throw new ContentEncryptionError(
      `CONTENT_ENCRYPTION_KEY_ID "${activeKeyId}" is not in CONTENT_ENCRYPTION_KEYS`,
    );
  return { activeKeyId, keys };
}

/** Generates a key and its base64 form, for setting up an environment. */
export function generateContentKey(): string {
  return randomBytes(KEY_BYTES).toString("base64");
}

const b64 = (buffer: Buffer) => buffer.toString("base64url");

export function encryptContent(keyring: ContentKeyring, plaintext: string): string {
  const key = keyring.keys.get(keyring.activeKeyId);
  if (!key) throw new ContentEncryptionError(`Active key ${keyring.activeKeyId} is missing`);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  // The key id is authenticated, so a value cannot be replayed under a different key id.
  cipher.setAAD(Buffer.from(`${VERSION}.${keyring.activeKeyId}`, "utf8"));
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return [VERSION, keyring.activeKeyId, b64(iv), b64(cipher.getAuthTag()), b64(ciphertext)].join(
    ".",
  );
}

export function decryptContent(keyring: ContentKeyring, envelope: string): string {
  const parts = envelope.split(".");
  if (parts.length !== 5 || parts[0] !== VERSION)
    throw new ContentEncryptionError("Not a v1 content envelope");
  const [, keyId, ivPart, tagPart, cipherPart] = parts as [string, string, string, string, string];
  const key = keyring.keys.get(keyId);
  if (!key)
    throw new ContentEncryptionError(
      `No key "${keyId}" in the keyring; it is still needed to read existing content`,
    );
  const iv = Buffer.from(ivPart, "base64url");
  const tag = Buffer.from(tagPart, "base64url");
  if (iv.byteLength !== IV_BYTES || tag.byteLength !== TAG_BYTES)
    throw new ContentEncryptionError("Content envelope is malformed");
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAAD(Buffer.from(`${VERSION}.${keyId}`, "utf8"));
  decipher.setAuthTag(tag);
  try {
    return Buffer.concat([
      decipher.update(Buffer.from(cipherPart, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new ContentEncryptionError("Content failed authentication: wrong key or altered value");
  }
}

/** The key a stored value was written with, for rotation reporting. */
export function envelopeKeyId(envelope: string): string | undefined {
  const parts = envelope.split(".");
  return parts.length === 5 && parts[0] === VERSION ? parts[1] : undefined;
}

export function needsRotation(keyring: ContentKeyring, envelope: string): boolean {
  const keyId = envelopeKeyId(envelope);
  return keyId !== undefined && keyId !== keyring.activeKeyId;
}

/** Constant-time comparison for anything token-shaped that passes through this module. */
export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  return left.byteLength === right.byteLength && timingSafeEqual(left, right);
}

/* Lazily built shared keyring ---------------------------------------------------------------- */

let cached: ContentKeyring | undefined;

/** The process-wide keyring, built on first use so a request without content never needs keys. */
export function getContentKeyring(): ContentKeyring {
  cached ??= keyringFromEnv();
  return cached;
}

/** Test and script helper: forget the cached keyring so a new environment takes effect. */
export function resetContentKeyring(): void {
  cached = undefined;
}
