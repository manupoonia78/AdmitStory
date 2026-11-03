import { describe, expect, it } from "vitest";
import {
  fetchUrl,
  hostAllowed,
  isPublicAddress,
  type PinnedRequest,
  type ResolvedAddress,
  type TransportResponse,
} from "../src/ingest/fetch-url";

const PUBLIC: ResolvedAddress = { address: "93.184.215.14", family: 4 };

function fakeNet(
  dns: Record<string, ResolvedAddress[]>,
  routes: Record<string, Partial<TransportResponse>>,
) {
  const requests: PinnedRequest[] = [];
  return {
    requests,
    resolve: async (host: string) => {
      const found = dns[host];
      if (!found) throw new Error(`ENOTFOUND ${host}`);
      return found;
    },
    transport: async (request: PinnedRequest): Promise<TransportResponse> => {
      requests.push(request);
      const route = routes[request.url.href];
      if (!route) return { status: 404, headers: {}, body: new Uint8Array() };
      return { status: 200, headers: {}, body: new Uint8Array(), ...route };
    },
  };
}

const page = (text: string) => ({
  body: new TextEncoder().encode(text),
  headers: { contentType: "text/html" },
});

describe("isPublicAddress", () => {
  it.each([
    "127.0.0.1",
    "10.1.2.3",
    "172.16.0.1",
    "172.31.255.255",
    "192.168.1.1",
    "169.254.169.254",
    "100.64.0.1",
    "0.0.0.0",
    "224.0.0.1",
    "255.255.255.255",
    "198.51.100.7",
    "::",
    "::1",
    "fe80::1",
    "fc00::1",
    "fd12:3456::1",
    "ff02::1",
    "::ffff:127.0.0.1",
    "::ffff:10.0.0.1",
    "::ffff:a9fe:a9fe",
    "64:ff9b::a00:1",
    "2002:0a00:0001::1",
    "2001:db8::1",
    "not-an-ip",
  ])("refuses %s", (ip) => {
    expect(isPublicAddress(ip)).toBe(false);
  });

  it.each([
    "93.184.215.14",
    "8.8.8.8",
    "172.32.0.1",
    "2606:4700::1111",
    "::ffff:8.8.8.8",
    "64:ff9b::808:808",
  ])("accepts %s", (ip) => {
    expect(isPublicAddress(ip)).toBe(true);
  });
});

describe("hostAllowed", () => {
  it("matches exact hosts and wildcard subdomains, never lookalikes", () => {
    const allow = ["school.example", "*.school.example"];
    expect(hostAllowed("school.example", allow)).toBe(true);
    expect(hostAllowed("WWW.School.Example.", allow)).toBe(true);
    expect(hostAllowed("evilschool.example", allow)).toBe(false);
    expect(hostAllowed("school.example.attacker.test", allow)).toBe(false);
    expect(hostAllowed("www.school.example", ["school.example"])).toBe(false);
    expect(hostAllowed("school.example", ["*.school.example"])).toBe(false);
  });
});

describe("fetchUrl (§14.6 SSRF protections)", () => {
  const allowHosts = ["www.school.example"];

  it("fetches an allowlisted https page, connecting to the address it checked", async () => {
    const net = fakeNet(
      { "www.school.example": [PUBLIC] },
      { "https://www.school.example/essays": page("<p>Hi</p>") },
    );
    const result = await fetchUrl("https://www.school.example/essays", { allowHosts, ...net });
    expect(result).toMatchObject({
      url: "https://www.school.example/essays",
      status: 200,
      contentType: "text/html",
      redirects: [],
    });
    expect(new TextDecoder().decode(result.bytes)).toBe("<p>Hi</p>");
    expect(net.requests[0]?.address).toEqual(PUBLIC);
  });

  it.each([
    ["http://www.school.example/", "not_https"],
    ["ftp://www.school.example/", "not_https"],
    ["file:///etc/passwd", "not_https"],
    ["https://other.example/", "host_not_allowed"],
    ["https://127.0.0.1/", "host_not_allowed"],
    ["https://[::1]/", "host_not_allowed"],
    ["https://user:pw@www.school.example/", "bad_url"],
    ["https://www.school.example:8443/", "bad_url"],
    ["not a url", "bad_url"],
  ])("refuses %s (%s) without touching the network", async (url, code) => {
    const net = fakeNet({ "www.school.example": [PUBLIC] }, {});
    await expect(fetchUrl(url, { allowHosts, ...net })).rejects.toMatchObject({ code });
    expect(net.requests).toHaveLength(0);
  });

  it.each([["127.0.0.1"], ["10.0.0.5"], ["169.254.169.254"], ["::1"], ["::ffff:192.168.0.1"]])(
    "refuses an allowlisted host that resolves to %s",
    async (address) => {
      const net = fakeNet(
        { "www.school.example": [{ address, family: address.includes(":") ? 6 : 4 }] },
        {},
      );
      await expect(
        fetchUrl("https://www.school.example/", { allowHosts, ...net }),
      ).rejects.toMatchObject({
        code: "blocked_address",
      });
      expect(net.requests).toHaveLength(0);
    },
  );

  it("refuses when any DNS answer is private, even if another is public", async () => {
    const net = fakeNet({ "www.school.example": [PUBLIC, { address: "10.0.0.1", family: 4 }] }, {});
    await expect(
      fetchUrl("https://www.school.example/", { allowHosts, ...net }),
    ).rejects.toMatchObject({
      code: "blocked_address",
    });
  });

  it("reports a DNS failure", async () => {
    const net = fakeNet({}, {});
    await expect(
      fetchUrl("https://www.school.example/", { allowHosts, ...net }),
    ).rejects.toMatchObject({
      code: "dns_failed",
    });
  });

  it("follows a redirect that stays on the allowlist", async () => {
    const net = fakeNet(
      { "www.school.example": [PUBLIC], "apply.school.example": [PUBLIC] },
      {
        "https://www.school.example/old": {
          status: 301,
          headers: { location: "https://apply.school.example/new" },
        },
        "https://apply.school.example/new": page("moved"),
      },
    );
    const result = await fetchUrl("https://www.school.example/old", {
      allowHosts: ["*.school.example"],
      ...net,
    });
    expect(result.url).toBe("https://apply.school.example/new");
    expect(result.redirects).toEqual(["https://www.school.example/old"]);
  });

  it.each([
    ["https://attacker.test/", "host_not_allowed"],
    ["http://www.school.example/plain", "not_https"],
    ["https://169.254.169.254/latest/meta-data", "host_not_allowed"],
  ])("refuses a redirect to %s", async (location, code) => {
    const net = fakeNet(
      { "www.school.example": [PUBLIC] },
      { "https://www.school.example/go": { status: 302, headers: { location } } },
    );
    await expect(
      fetchUrl("https://www.school.example/go", { allowHosts, ...net }),
    ).rejects.toMatchObject({ code });
    expect(net.requests).toHaveLength(1);
  });

  it("refuses a redirect to an allowlisted host that now resolves privately", async () => {
    const net = fakeNet(
      {
        "www.school.example": [PUBLIC],
        "cdn.school.example": [{ address: "192.168.0.10", family: 4 }],
      },
      {
        "https://www.school.example/go": {
          status: 307,
          headers: { location: "https://cdn.school.example/x" },
        },
      },
    );
    await expect(
      fetchUrl("https://www.school.example/go", { allowHosts: ["*.school.example"], ...net }),
    ).rejects.toMatchObject({ code: "blocked_address" });
  });

  it("stops after maxRedirects", async () => {
    const net = fakeNet(
      { "www.school.example": [PUBLIC] },
      {
        "https://www.school.example/a": { status: 302, headers: { location: "/b" } },
        "https://www.school.example/b": { status: 302, headers: { location: "/a" } },
      },
    );
    await expect(
      fetchUrl("https://www.school.example/a", { allowHosts, maxRedirects: 3, ...net }),
    ).rejects.toMatchObject({ code: "too_many_redirects" });
    expect(net.requests).toHaveLength(4);
  });

  it("refuses a body over maxBytes and an HTTP error", async () => {
    const net = fakeNet(
      { "www.school.example": [PUBLIC] },
      { "https://www.school.example/big": { body: new Uint8Array(2048) } },
    );
    await expect(
      fetchUrl("https://www.school.example/big", { allowHosts, maxBytes: 1024, ...net }),
    ).rejects.toMatchObject({ code: "too_large" });
    await expect(
      fetchUrl("https://www.school.example/missing", { allowHosts, ...net }),
    ).rejects.toMatchObject({
      code: "http_error",
    });
  });

  it("times out a slow server", async () => {
    const net = fakeNet({ "www.school.example": [PUBLIC] }, {});
    const transport = ({ signal }: PinnedRequest) =>
      new Promise<TransportResponse>((_, reject) => {
        signal.addEventListener("abort", () => reject(new Error("aborted")));
      });
    await expect(
      fetchUrl("https://www.school.example/", {
        allowHosts,
        timeoutMs: 20,
        resolve: net.resolve,
        transport,
      }),
    ).rejects.toMatchObject({ code: "timeout" });
  });

  it("times out a DNS lookup that never answers, without connecting", async () => {
    let connected = false;
    await expect(
      fetchUrl("https://www.school.example/", {
        allowHosts,
        timeoutMs: 20,
        resolve: () => new Promise<never>(() => undefined),
        transport: () => {
          connected = true;
          return Promise.reject(new Error("unreachable"));
        },
      }),
    ).rejects.toMatchObject({ code: "timeout" });
    expect(connected).toBe(false);
  });
});
