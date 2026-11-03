import { readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it, vi } from "vitest";

// Phase 3 AC (§5.18, §14.4): every /api/admin route refuses a non-admin with a plain 404, before
// it reads the body or touches a repository. Generated from the route files, so a new admin route
// is covered the moment it exists.

const state = vi.hoisted(() => ({
  session: null as null | { user: { id: string } },
  repoCalls: 0,
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/session", () => ({ getSession: vi.fn(async () => state.session) }));
vi.mock("@admitstory/db", async (importOriginal) => {
  const real = await importOriginal<typeof import("@admitstory/db")>();
  return new Proxy(real, {
    get(target, key: string) {
      if (key === "getDb") return () => ({});
      if (key === "requireAdmin")
        return async () => {
          throw new real.AdminRequiredError("Admin role required");
        };
      const value = (target as Record<string, unknown>)[key];
      // Any repository call would mean the guard let the request through.
      if (typeof value === "function" && /^[a-z]/.test(key) && key !== "assertId")
        return (...args: unknown[]) => {
          state.repoCalls += 1;
          return (value as (...a: unknown[]) => unknown)(...args);
        };
      return value;
    },
  });
});

const base = process.cwd().endsWith("apps/web") ? process.cwd() : join(process.cwd(), "apps/web");
const adminDir = join(base, "app/api/admin");

function routes(at: string): string[] {
  return readdirSync(at).flatMap((name) => {
    const path = join(at, name);
    if (statSync(path).isDirectory()) return routes(path);
    return name === "route.ts" ? [path] : [];
  });
}

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;
const files = routes(adminDir);

describe("admin routes refuse non-admins", () => {
  it("finds the admin routes", () => {
    expect(files.length).toBeGreaterThan(10);
  });

  for (const file of files) {
    const name = relative(adminDir, file);
    for (const signedIn of [true, false]) {
      it(`${name} (${signedIn ? "signed in, not admin" : "signed out"})`, async () => {
        state.session = signedIn ? { user: { id: "6b1f0a6e-8a2b-4c3d-9e4f-1a2b3c4d5e6f" } } : null;
        state.repoCalls = 0;
        const mod = (await import(file)) as Record<string, unknown>;
        const handlers = METHODS.filter((m) => typeof mod[m] === "function");
        expect(handlers.length).toBeGreaterThan(0);
        for (const method of handlers) {
          const request = new Request("http://localhost:3000/api/admin/x", {
            method,
            ...(method === "GET"
              ? {}
              : { body: "{}", headers: { "content-type": "application/json" } }),
          });
          const params = new Proxy({}, { get: () => "6b1f0a6e-8a2b-4c3d-9e4f-1a2b3c4d5e6f" });
          const response = await (mod[method] as (r: Request, c: unknown) => Promise<Response>)(
            request,
            {
              params: Promise.resolve(params),
            },
          );
          expect(response.status, `${method} ${name}`).toBe(404);
        }
        expect(state.repoCalls).toBe(0);
      });
    }
  }
});
