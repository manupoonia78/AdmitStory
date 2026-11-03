// Button and toast copy for passkey management. Buttons name the exact action and the toast
// repeats the same verb (spec §6.7): "Save name" → "Name saved". passkey-copy.test.ts checks it.

export const PASSKEY_COPY = {
  add: { button: "Add a passkey", pending: "Adding a passkey", toast: "Passkey added" },
  rename: { button: "Save name", pending: "Saving the name", toast: "Name saved" },
  remove: { button: "Remove passkey", pending: "Removing passkey", toast: "Passkey removed" },
} as const;
