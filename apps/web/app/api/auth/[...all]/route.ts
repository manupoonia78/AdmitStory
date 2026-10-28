import { getAuth } from "@/lib/auth";

// Better Auth's handler (sign-in, magic-link verify, passkeys, Google callback, sessions).
// The instance is created on the first request, since lib/auth.ts reads the env lazily.
function handler(request: Request): Promise<Response> {
  return getAuth().handler(request);
}

export const GET = handler;
export const POST = handler;
