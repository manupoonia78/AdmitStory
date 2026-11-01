import { processWebhook } from "@/lib/payments/server";

// POST /api/webhooks/paddle (spec §11, §5.6, §13): verified over the exact raw body, idempotent on
// the provider's event and transaction ids. 200 for applied, replayed or set-aside events; 401 for a
// bad signature; 500 on any other failure so the provider retries.

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const raw = await request.text();
  try {
    const result = await processWebhook(raw, request.headers);
    return Response.json(result.body, { status: result.status });
  } catch (error) {
    console.error("[payments] webhook failed; the provider will retry", error);
    return Response.json({ error: "Not processed. Retry." }, { status: 500 });
  }
}
