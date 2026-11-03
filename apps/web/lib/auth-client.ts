"use client";

import { passkeyClient } from "@better-auth/passkey/client";
import { magicLinkClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

// Browser-side Better Auth client. Same origin as the app, so no baseURL is needed.
// Import it lazily (`await import("@/lib/auth-client")`) from pages where it is only needed after
// a click, so @simplewebauthn/browser stays out of the route's first load.
export const authClient = createAuthClient({
  plugins: [magicLinkClient(), passkeyClient()],
});
