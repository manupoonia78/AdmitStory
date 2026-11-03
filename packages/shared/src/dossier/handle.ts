// The applicant's handle in the compact dossier: "A-7f3" (spec §8.2). It labels the file for the
// model and nothing more — it is never shown to the applicant, never used as a key, and two
// applicants may share one without consequence, because a prompt only ever contains one person.
// It exists so no prompt has to carry a name or a user id.
//
// FNV-1a rather than a cryptographic hash: this runs in shared code that both the server and the
// browser import, and node:crypto is not available in both. It is a label, not a secret.

const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

export function applicantHandle(userId: string): string {
  let hash = FNV_OFFSET;
  for (let i = 0; i < userId.length; i += 1) {
    hash ^= userId.charCodeAt(i);
    hash = Math.imul(hash, FNV_PRIME);
  }
  // >>> 0 to read the 32 bits as unsigned; three hex digits is all §8.2's example carries.
  return `A-${((hash >>> 0) % 0x1000).toString(16).padStart(3, "0")}`;
}
