// URL ingestion (spec §9.3 "URL fetch", §9.3 refresh checker, §14.6 "URL ingestion (admin only)
// with an allowlist and SSRF protections"). An admin pastes a school URL, or the refresh cron
// re-reads a pack's `official_urls`; either way the server fetches a URL it was told to, which is
// the textbook server-side request forgery. The guard:
//
//   1. https only, default port only, no credentials in the URL, no IP-literal hosts.
//   2. The host must be on the allowlist the caller passes (exact, or `*.example.edu` for
//      subdomains) — in practice the school's own domains.
//   3. DNS is resolved here, and *every* address must be public: loopback, private, link-local
//      (169.254.0.0/16 is where cloud metadata lives), CGNAT, multicast, documentation and the
//      IPv6 equivalents are refused, including IPv4 hidden inside IPv6 (mapped, NAT64, 6to4).
//   4. The connection goes to the address that was checked (the lookup is pinned), so a DNS answer
//      that changes between check and connect (rebinding) can't redirect it. TLS still verifies
//      the certificate against the hostname.
//   5. Redirects are followed by hand, at most `maxRedirects`, and each hop repeats 1–4: a
//      redirect off the allowlist, to http, or to a private address fails the whole fetch.
//   6. One deadline covers the whole fetch, and the body is cut off at `maxBytes`.

import { lookup as dnsLookup } from "node:dns/promises";
import { request as httpsRequest } from "node:https";
import { isIP } from "node:net";

export type UrlFetchErrorCode =
  | "bad_url"
  | "not_https"
  | "host_not_allowed"
  | "blocked_address"
  | "dns_failed"
  | "too_many_redirects"
  | "too_large"
  | "timeout"
  | "http_error"
  | "network";

export class UrlFetchError extends Error {
  constructor(
    readonly code: UrlFetchErrorCode,
    detail: string,
  ) {
    super(detail);
    this.name = "UrlFetchError";
  }
}

/* Addresses ------------------------------------------------------------------------------------- */

function ipv4ToNumber(ip: string): number | undefined {
  const parts = ip.split(".");
  if (parts.length !== 4) return undefined;
  let n = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part) || Number(part) > 255) return undefined;
    n = n * 256 + Number(part);
  }
  return n;
}

const IPV4_BLOCKED_RANGES: readonly [string, number][] = [
  ["0.0.0.0", 8], // "this network"
  ["10.0.0.0", 8], // private
  ["100.64.0.0", 10], // carrier-grade NAT
  ["127.0.0.0", 8], // loopback
  ["169.254.0.0", 16], // link-local, incl. cloud metadata 169.254.169.254
  ["172.16.0.0", 12], // private
  ["192.0.0.0", 24], // IETF protocol assignments
  ["192.0.2.0", 24], // documentation
  ["192.88.99.0", 24], // 6to4 relay anycast
  ["192.168.0.0", 16], // private
  ["198.18.0.0", 15], // benchmarking
  ["198.51.100.0", 24], // documentation
  ["203.0.113.0", 24], // documentation
  ["224.0.0.0", 4], // multicast
  ["240.0.0.0", 4], // reserved, incl. broadcast
];

const IPV4_BLOCKED = IPV4_BLOCKED_RANGES.map(([base, bits]) => {
  const mask = (0xffffffff << (32 - bits)) >>> 0;
  return { mask, network: ((ipv4ToNumber(base) ?? 0) & mask) >>> 0 };
});

function ipv4IsPublic(n: number): boolean {
  return IPV4_BLOCKED.every(({ mask, network }) => (n & mask) >>> 0 !== network);
}

/** Eight 16-bit groups, or undefined if `ip` isn't IPv6. Handles `::`, zones and a dotted tail. */
function ipv6Groups(ip: string): number[] | undefined {
  let text = ip.split("%")[0] ?? "";
  const dotted = /(\d+\.\d+\.\d+\.\d+)$/.exec(text);
  if (dotted?.[1]) {
    const v4 = ipv4ToNumber(dotted[1]);
    if (v4 === undefined) return undefined;
    text = `${text.slice(0, -dotted[1].length)}${(v4 >>> 16).toString(16)}:${(v4 & 0xffff).toString(16)}`;
  }
  const halves = text.split("::");
  if (halves.length > 2) return undefined;
  const head = halves[0] ? halves[0].split(":") : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const missing = 8 - head.length - tail.length;
  if (halves.length === 1 ? missing !== 0 : missing < 1) return undefined;
  const groups = [...head, ...Array<string>(halves.length === 2 ? missing : 0).fill("0"), ...tail];
  if (groups.some((g) => !/^[0-9a-f]{1,4}$/i.test(g))) return undefined;
  return groups.map((g) => parseInt(g, 16));
}

function embeddedV4(high: number, low: number): number {
  return ((high << 16) >>> 0) + low;
}

/** Whether an IP address is safe to connect to: public unicast, nothing internal or reserved. */
export function isPublicAddress(ip: string): boolean {
  const family = isIP(ip.split("%")[0] ?? "");
  if (family === 4) {
    const n = ipv4ToNumber(ip);
    return n !== undefined && ipv4IsPublic(n);
  }
  if (family !== 6) return false;
  const g = ipv6Groups(ip);
  if (!g) return false;
  const [g0 = 0, g1 = 0, g2 = 0, g3 = 0, g4 = 0, g5 = 0, g6 = 0, g7 = 0] = g;
  // IPv4-mapped ::ffff:a.b.c.d — judge the IPv4 address.
  if (g0 === 0 && g1 === 0 && g2 === 0 && g3 === 0 && g4 === 0 && g5 === 0xffff)
    return ipv4IsPublic(embeddedV4(g6, g7));
  // NAT64 64:ff9b::/96 — judge the IPv4 address. 64:ff9b:1::/48 is local-use: refused below.
  if (g0 === 0x64 && g1 === 0xff9b && g2 === 0 && g3 === 0 && g4 === 0 && g5 === 0)
    return ipv4IsPublic(embeddedV4(g6, g7));
  // 6to4 2002::/16 carries an IPv4 address in the next 32 bits.
  if (g0 === 0x2002) return ipv4IsPublic(embeddedV4(g1, g2));
  // Only global unicast (2000::/3) from here on; that excludes ::, ::1, ULA, link-local, multicast.
  if (g0 < 0x2000 || g0 > 0x3fff) return false;
  if (g0 === 0x2001 && g1 < 0x200) return false; // 2001::/23 IETF protocol assignments, incl. Teredo
  if (g0 === 0x2001 && g1 === 0xdb8) return false; // documentation
  if (g0 === 0x3fff && g1 < 0x1000) return false; // 3fff::/20 documentation
  return true;
}

/* Hosts ----------------------------------------------------------------------------------------- */

/** `example.edu` matches only itself; `*.example.edu` matches its subdomains, not the apex. */
export function hostAllowed(host: string, allowHosts: readonly string[]): boolean {
  const name = host.toLowerCase().replace(/\.$/, "");
  return allowHosts.some((entry) => {
    const rule = entry.toLowerCase().replace(/\.$/, "");
    if (rule.startsWith("*.")) {
      const suffix = rule.slice(1);
      return name.endsWith(suffix) && name.length > suffix.length;
    }
    return name === rule;
  });
}

function checkUrl(raw: string | URL, allowHosts: readonly string[]): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UrlFetchError("bad_url", `Not a URL: ${String(raw)}`);
  }
  if (url.protocol !== "https:")
    throw new UrlFetchError("not_https", `Only https URLs: ${url.href}`);
  if (url.username || url.password)
    throw new UrlFetchError("bad_url", "URLs with credentials aren't fetched");
  if (url.port !== "")
    throw new UrlFetchError("bad_url", `Only the default https port: ${url.href}`);
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(host) !== 0)
    throw new UrlFetchError("host_not_allowed", `IP addresses aren't fetched: ${host}`);
  if (!hostAllowed(host, allowHosts))
    throw new UrlFetchError("host_not_allowed", `${host} isn't on the allowlist`);
  return url;
}

/* Transport ------------------------------------------------------------------------------------- */

export interface ResolvedAddress {
  address: string;
  family: 4 | 6;
}

export type Resolver = (hostname: string) => Promise<ResolvedAddress[]>;

export interface PinnedRequest {
  url: URL;
  /** Connect here, not wherever DNS points by the time the socket opens. */
  address: ResolvedAddress;
  signal: AbortSignal;
  maxBytes: number;
}

export interface TransportResponse {
  status: number;
  headers: { location?: string; contentType?: string };
  body: Uint8Array;
}

export type Transport = (request: PinnedRequest) => Promise<TransportResponse>;

const defaultResolver: Resolver = async (hostname) => {
  const found = await dnsLookup(hostname, { all: true, verbatim: true });
  return found.map((a) => ({ address: a.address, family: a.family === 6 ? 6 : 4 }));
};

/** node:https with the lookup pinned to the checked address and the body capped. */
const httpsTransport: Transport = ({ url, address, signal, maxBytes }) =>
  new Promise((resolve, reject) => {
    const req = httpsRequest(
      {
        protocol: "https:",
        hostname: url.hostname,
        servername: url.hostname,
        port: 443,
        path: `${url.pathname}${url.search}`,
        method: "GET",
        agent: false,
        signal,
        headers: {
          accept: "text/html,application/pdf,text/plain;q=0.9,*/*;q=0.5",
          "accept-encoding": "identity",
          "user-agent": "AdmitstoryKnowledgeBot/1.0 (admin source ingestion)",
        },
        lookup: (_hostname, options, callback) => {
          if ((options as { all?: boolean }).all)
            (callback as (e: null, a: ResolvedAddress[]) => void)(null, [address]);
          else callback(null, address.address, address.family);
        },
      },
      (res) => {
        const status = res.statusCode ?? 0;
        const location =
          typeof res.headers.location === "string" ? res.headers.location : undefined;
        const contentType = res.headers["content-type"];
        if (status >= 300 && status < 400) {
          res.resume();
          resolve({ status, headers: { location, contentType }, body: new Uint8Array() });
          return;
        }
        const declared = Number(res.headers["content-length"] ?? "0");
        if (declared > maxBytes) {
          res.destroy();
          reject(
            new UrlFetchError(
              "too_large",
              `Response is ${declared} bytes; the limit is ${maxBytes}`,
            ),
          );
          return;
        }
        const chunks: Buffer[] = [];
        let received = 0;
        res.on("data", (chunk: Buffer) => {
          received += chunk.length;
          if (received > maxBytes) {
            res.destroy();
            reject(new UrlFetchError("too_large", `Response exceeds ${maxBytes} bytes`));
            return;
          }
          chunks.push(chunk);
        });
        res.on("end", () =>
          resolve({
            status,
            headers: { location, contentType },
            body: new Uint8Array(Buffer.concat(chunks)),
          }),
        );
        res.on("error", reject);
      },
    );
    req.on("error", reject);
    req.end();
  });

/* fetchUrl -------------------------------------------------------------------------------------- */

export interface FetchUrlOptions {
  /** Hosts this fetch may touch, including on redirects. Required: there is no default. */
  allowHosts: readonly string[];
  maxBytes?: number;
  timeoutMs?: number;
  maxRedirects?: number;
  /** Tests inject these; production uses DNS and node:https. */
  resolve?: Resolver;
  transport?: Transport;
}

export interface FetchedUrl {
  /** Where the content finally came from. */
  url: string;
  status: number;
  contentType: string | null;
  bytes: Uint8Array;
  /** Each URL redirected through, in order. */
  redirects: string[];
}

export const FETCH_DEFAULTS = { maxBytes: 10 * 1024 * 1024, timeoutMs: 15_000, maxRedirects: 3 };

/** Rejects with a timeout as soon as `signal` aborts: a hung DNS lookup must not outlive the deadline. */
function untilAborted<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(new UrlFetchError("timeout", "The fetch timed out"));
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(new UrlFetchError("timeout", "The fetch timed out"));
    signal.addEventListener("abort", onAbort, { once: true });
    work.then(
      (value) => {
        signal.removeEventListener("abort", onAbort);
        resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener("abort", onAbort);
        reject(error instanceof Error ? error : new Error(String(error)));
      },
    );
  });
}

async function resolvePublic(
  host: string,
  resolve: Resolver,
  signal: AbortSignal,
): Promise<ResolvedAddress> {
  let addresses: ResolvedAddress[];
  try {
    addresses = await untilAborted(resolve(host), signal);
  } catch (error) {
    if (error instanceof UrlFetchError) throw error;
    throw new UrlFetchError("dns_failed", `Couldn't resolve ${host}: ${(error as Error).message}`);
  }
  // Every answer must be public: an attacker's DNS can mix a public and a private one.
  const blocked = addresses.find((a) => !isPublicAddress(a.address));
  if (blocked)
    throw new UrlFetchError(
      "blocked_address",
      `${host} resolves to a non-public address (${blocked.address})`,
    );
  const [first] = addresses;
  if (!first) throw new UrlFetchError("dns_failed", `${host} has no addresses`);
  return first;
}

export async function fetchUrl(raw: string, options: FetchUrlOptions): Promise<FetchedUrl> {
  const maxBytes = options.maxBytes ?? FETCH_DEFAULTS.maxBytes;
  const maxRedirects = options.maxRedirects ?? FETCH_DEFAULTS.maxRedirects;
  const resolve = options.resolve ?? defaultResolver;
  const transport = options.transport ?? httpsTransport;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? FETCH_DEFAULTS.timeoutMs);
  const redirects: string[] = [];
  try {
    let url = checkUrl(raw, options.allowHosts);
    for (;;) {
      const address = await resolvePublic(url.hostname, resolve, controller.signal);
      if (controller.signal.aborted) throw new UrlFetchError("timeout", "The fetch timed out");
      const response = await transport({ url, address, signal: controller.signal, maxBytes });
      if (response.status >= 300 && response.status < 400) {
        if (!response.headers.location)
          throw new UrlFetchError("http_error", `HTTP ${response.status} without a Location`);
        if (redirects.length >= maxRedirects)
          throw new UrlFetchError("too_many_redirects", `More than ${maxRedirects} redirects`);
        redirects.push(url.href);
        let next: URL;
        try {
          next = new URL(response.headers.location, url);
        } catch {
          throw new UrlFetchError("bad_url", `Bad redirect target: ${response.headers.location}`);
        }
        url = checkUrl(next, options.allowHosts);
        continue;
      }
      if (response.status < 200 || response.status >= 300)
        throw new UrlFetchError("http_error", `HTTP ${response.status} from ${url.href}`);
      if (response.body.byteLength > maxBytes)
        throw new UrlFetchError("too_large", `Response exceeds ${maxBytes} bytes`);
      return {
        url: url.href,
        status: response.status,
        contentType: response.headers.contentType ?? null,
        bytes: response.body,
        redirects,
      };
    }
  } catch (error) {
    if (error instanceof UrlFetchError) throw error;
    if (controller.signal.aborted) throw new UrlFetchError("timeout", "The fetch timed out");
    throw new UrlFetchError("network", (error as Error).message);
  } finally {
    clearTimeout(timer);
  }
}
