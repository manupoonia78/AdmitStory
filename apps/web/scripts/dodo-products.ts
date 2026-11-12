// Creates the three one-time products checkout sells in Dodo Payments (school kit, 5-school pack,
// 10-school pack), priced from SCHOOL_PLANS so Dodo charges what the app shows, and prints the
// DODO_PRODUCT_* lines to paste into the environment. A product already tagged with its kind
// (metadata `admitstories_kind`) is reused, so re-running is safe; one whose price no longer
// matches SCHOOL_PLANS is reported, not changed.
//
// Run once per mode, with that mode's key (test keys only see test products):
//
//   DODO_PAYMENTS_API_KEY=… DODO_PAYMENTS_ENVIRONMENT=live_mode \
//     pnpm --filter @admitstory/web payments:products
//
// Without the variables set, it reads the repository's .env.local.

import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { DODO_API_URL, DODO_PRODUCT_ENV, type ProductKind } from "@admitstory/payments";
import { PLAN_ORDER, SCHOOL_KIT_CURRENCY, SCHOOL_PLANS } from "../lib/payments/plans";

const ENV_FILE = fileURLToPath(new URL("../../../.env.local", import.meta.url));
if (!process.env.DODO_PAYMENTS_API_KEY && existsSync(ENV_FILE)) process.loadEnvFile(ENV_FILE);

const apiKey = process.env.DODO_PAYMENTS_API_KEY?.trim();
if (!apiKey) throw new Error("Set DODO_PAYMENTS_API_KEY (and DODO_PAYMENTS_ENVIRONMENT).");
const dodoEnv = process.env.DODO_PAYMENTS_ENVIRONMENT?.trim() || "test_mode";
if (dodoEnv !== "test_mode" && dodoEnv !== "live_mode")
  throw new Error(`DODO_PAYMENTS_ENVIRONMENT must be test_mode or live_mode, not "${dodoEnv}".`);
const baseUrl = DODO_API_URL[dodoEnv];

const NAMES: Record<ProductKind, { name: string; description: string }> = {
  school_kit: {
    name: "AdmitStories School Kit",
    description: "Every essay and short answer for one school, for one application cycle.",
  },
  school_pack5: {
    name: "AdmitStories 5-School Pack",
    description: "School kits for five schools, for one application cycle each.",
  },
  school_pack10: {
    name: "AdmitStories 10-School Pack",
    description: "School kits for ten schools, for one application cycle each.",
  },
};

interface ListedProduct {
  product_id: string;
  price?: number | null;
  metadata?: Record<string, unknown>;
}

async function call<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const text = await response.text();
  if (!response.ok)
    throw new Error(`Dodo ${method} ${path} failed with ${response.status}: ${text}`);
  return JSON.parse(text) as T;
}

async function existing(): Promise<ListedProduct[]> {
  const all: ListedProduct[] = [];
  for (let page = 0; ; page++) {
    const { items } = await call<{ items: ListedProduct[] }>(
      "GET",
      `/products?page_size=100&page_number=${page}&archived=false`,
    );
    all.push(...items);
    if (items.length < 100) return all;
  }
}

const products = await existing();
const lines: string[] = [];
for (const kind of PLAN_ORDER) {
  const plan = SCHOOL_PLANS[kind];
  const found = products.find((p) => p.metadata?.admitstories_kind === kind);
  let id = found?.product_id;
  if (found) {
    if (found.price != null && found.price !== plan.priceCents)
      console.warn(
        `! ${kind}: ${id} is priced ${found.price}, SCHOOL_PLANS says ${plan.priceCents}. Fix it in the Dodo dashboard.`,
      );
    console.log(`= ${kind}: reusing ${id}`);
  } else {
    const created = await call<{ product_id: string }>("POST", "/products", {
      ...NAMES[kind],
      tax_category: "saas",
      price: {
        type: "one_time_price",
        price: plan.priceCents,
        currency: SCHOOL_KIT_CURRENCY,
        discount: 0,
        purchasing_power_parity: false,
        tax_inclusive: false,
      },
      metadata: { admitstories_kind: kind },
    });
    id = created.product_id;
    console.log(`+ ${kind}: created ${id}`);
  }
  lines.push(`${DODO_PRODUCT_ENV[kind]}=${id}`);
}

console.log(`\n# ${dodoEnv}\nDODO_PAYMENTS_ENVIRONMENT=${dodoEnv}\n${lines.join("\n")}`);
