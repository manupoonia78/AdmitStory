// The console's one way to call /api/admin: JSON in, the app's error shape out. Plain TS, so the
// client components that use it stay small (no Zod, no server code).

export interface AdminResult<T = Record<string, unknown>> {
  ok: boolean;
  status: number;
  data: T | null;
  error: string | null;
  code: string | null;
  issues: { path: string; message: string }[];
}

export async function adminRequest<T = Record<string, unknown>>(
  url: string,
  init: { method?: string; json?: unknown; form?: FormData } = {},
): Promise<AdminResult<T>> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: init.method ?? "POST",
      ...(init.form
        ? { body: init.form }
        : init.json !== undefined
          ? { body: JSON.stringify(init.json), headers: { "content-type": "application/json" } }
          : {}),
    });
  } catch {
    return {
      ok: false,
      status: 0,
      data: null,
      error: "The console couldn't reach the server. Check the connection and try again.",
      code: null,
      issues: [],
    };
  }
  const body = (await response.json().catch(() => null)) as
    (T & { error?: string; code?: string; issues?: { path: string; message: string }[] }) | null;
  return {
    ok: response.ok,
    status: response.status,
    data: response.ok ? body : null,
    error: response.ok ? null : (body?.error ?? `The server answered ${response.status}.`),
    code: response.ok ? null : (body?.code ?? null),
    issues: response.ok ? [] : (body?.issues ?? []),
  };
}
