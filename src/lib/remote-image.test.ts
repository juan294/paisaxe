// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createServer, type RequestOptions, type Server } from "node:https";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import type { IncomingMessage } from "node:http";
import type { LookupFunction } from "node:net";
import { fetchRemoteImage } from "./remote-image";

const dns = vi.hoisted(() => ({ lookup: vi.fn() }));
vi.mock("node:dns/promises", () => ({ lookup: dns.lookup }));
const transport = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock("node:https", async (importOriginal) => ({
  ...await importOriginal<typeof import("node:https")>(),
  request: transport.request,
  default: { request: transport.request },
}));

// Remap only the third-party socket boundary to loopback. The production lookup
// must first supply a public validated address; hostname/SNI/certificate checks
// and the response stream are real Node HTTPS, without disabling TLS validation.
describe("remote image HTTPS transport", () => {
  let server: Server;
  let realRequest: typeof import("node:https").request;
  let cert: Buffer;
  let fixtureDir: string;
  let port: number;
  let untrusted = false;
  let delayedLookup = false;
  let releaseLookup: (() => void) | undefined;
  const connections: string[] = [];
  const hostHeaders: string[] = [];
  const pinnedAddresses: string[] = [];

  beforeAll(async () => {
    realRequest = (await vi.importActual<typeof import("node:https")>("node:https")).request;
    fixtureDir = mkdtempSync(join(tmpdir(), "paisaxe-image-tls-"));
    const keyPath = join(fixtureDir, "key.pem");
    const certPath = join(fixtureDir, "cert.pem");
    execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", keyPath,
      "-out", certPath, "-days", "2", "-subj", "/CN=images.example.com", "-addext", "subjectAltName=DNS:images.example.com"], { stdio: "ignore" });
    cert = readFileSync(certPath);
    server = createServer({ key: readFileSync(keyPath), cert }, (req, res) => {
      hostHeaders.push(req.headers.host ?? "");
      res.setHeader("Content-Type", "image/jpeg");
      if (req.url === "/redirect") { res.writeHead(302, { Location: "https://127.0.0.1/private" }); res.end(); }
      else if (req.url === "/declared-large") { res.setHeader("Content-Length", 11 * 1024 * 1024); res.end(); }
      else if (req.url === "/stream-large") { res.end(Buffer.alloc(11 * 1024 * 1024)); }
      else if (req.url === "/not-image") { res.setHeader("Content-Type", "text/html"); res.end("<html>"); }
      else if (req.url === "/missing") { res.writeHead(404); res.end(); }
      else if (req.url === "/slow") { res.write("partial"); }
      else if (req.url === "/truncated") { res.setHeader("Content-Length", "1000"); res.write("partial"); res.destroy(); }
      else res.end("image fixture");
    });
    server.on("secureConnection", (socket) => connections.push((socket as import("node:tls").TLSSocket).servername || ""));
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    port = (server.address() as import("node:net").AddressInfo).port;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    rmSync(fixtureDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    vi.useRealTimers();
    dns.lookup.mockReset().mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
    connections.length = 0; hostHeaders.length = 0; pinnedAddresses.length = 0;
    untrusted = false; delayedLookup = false; releaseLookup = undefined;
    transport.request.mockReset().mockImplementation((url: URL, options: RequestOptions, callback: (res: IncomingMessage) => void) => {
      const remapLookup: LookupFunction = (hostname, lookupOptions, done) => {
        options.lookup!(hostname, lookupOptions, (error, address) => {
          if (error) { done(error, "", 4); return; }
          pinnedAddresses.push(address as string);
          if (delayedLookup) releaseLookup = () => done(null, "127.0.0.1", 4);
          else done(null, "127.0.0.1", 4);
        });
      };
      return realRequest(url, { ...options, port, headers: { ...options.headers, Host: url.host }, lookup: remapLookup, ca: untrusted ? undefined : cert }, callback);
    });
  });

  const image = (path = "/image", hostname = "images.example.com") => fetchRemoteImage(new URL(`https://${hostname}${path}`));
  const recovered = async () => expect((await image()).toString()).toBe("image fixture");

  it("binds the connection to the validated answer while preserving Host, SNI and certificate identity", async () => {
    dns.lookup.mockResolvedValueOnce([{ address: "93.184.216.34", family: 4 }])
      .mockResolvedValueOnce([{ address: "127.0.0.1", family: 4 }]);
    await recovered();
    expect(dns.lookup).toHaveBeenCalledOnce();
    expect(pinnedAddresses).toEqual(["93.184.216.34"]);
    expect(hostHeaders).toEqual(["images.example.com"]);
    expect(connections).toEqual(["images.example.com"]);
    await expect(image()).rejects.toThrow("Private or reserved");
    expect(connections).toHaveLength(1);
    await recovered();
  });

  it.each([
    "0.0.0.0", "10.1.2.3", "100.64.0.1", "127.1.2.3", "169.254.169.254", "172.16.0.1",
    "192.0.2.1", "192.168.1.1", "192.88.99.1", "198.18.0.1", "198.51.100.1", "203.0.113.1", "224.0.0.1", "255.255.255.255",
    "::", "::1", "0:0:0:0:0:0:0:1", "::ffff:127.0.0.1", "::ffff:7f00:1", "::ffff:93.184.216.34",
    "fc00::1", "fe80::1", "ff00::1", "2001:db8::1", "2002:7f00:1::", "2001::1", "3fff::1", "garbage",
  ])("rejects unsafe or malformed answer %s before a TLS connection, and recovers", async (address) => {
    dns.lookup.mockResolvedValueOnce([{ address, family: address.includes(":") ? 6 : 4 }]);
    await expect(image()).rejects.toThrow("Private or reserved");
    expect(pinnedAddresses).toHaveLength(0);
    expect(connections).toHaveLength(0);
    await recovered();
  });

  it("rejects mixed A/AAAA results rather than selecting the public answer", async () => {
    dns.lookup.mockResolvedValueOnce([{ address: "93.184.216.34", family: 4 }, { address: "fe80::1", family: 6 }]);
    await expect(image()).rejects.toThrow("Private or reserved");
    expect(pinnedAddresses).toHaveLength(0);
    await recovered();
  });

  it("accepts public AAAA answers", async () => {
    dns.lookup.mockResolvedValueOnce([{ address: "2606:4700:4700::1111", family: 6 }]);
    await recovered();
    expect(pinnedAddresses).toEqual(["2606:4700:4700::1111"]);
  });

  it.each([{ answers: [] }, { answers: [{ address: "93.184.216.34", family: 6 }] }])("rejects empty or inconsistent resolver results $answers", async ({ answers }) => {
    dns.lookup.mockResolvedValueOnce(answers);
    await expect(image()).rejects.toThrow("Private or reserved");
    await recovered();
  });

  it("rejects failed DNS and recovers on the next request", async () => {
    dns.lookup.mockRejectedValueOnce(new Error("ENOTFOUND"));
    await expect(image()).rejects.toThrow("host could not be validated");
    expect(pinnedAddresses).toHaveLength(0);
    await recovered();
  });

  it.each(["http://images.example.com/a", "https://user:password@images.example.com/a", "https://127.0.0.1/a", "https://[::ffff:7f00:1]/a", "https://localhost/a"])("rejects forbidden URL %s before connecting", async (url) => {
    await expect(fetchRemoteImage(new URL(url))).rejects.toThrow();
    expect(transport.request).not.toHaveBeenCalled();
    await recovered();
  });

  it("rejects an untrusted certificate without disabling ordinary TLS validation", async () => {
    untrusted = true;
    await expect(image()).rejects.toThrow("TLS certificate could not be verified");
    expect(hostHeaders).toHaveLength(0);
    untrusted = false;
    await recovered();
  });

  it("rejects a trusted certificate for a different hostname", async () => {
    await expect(image("/image", "wrong.example.com")).rejects.toThrow("TLS certificate could not be verified");
    expect(hostHeaders).toHaveLength(0);
    await recovered();
  });

  it.each([
    ["/redirect", "redirects are not allowed"], ["/declared-large", "Image too large"],
    ["/stream-large", "Image too large"], ["/not-image", "did not return an image"],
    ["/missing", "could not be downloaded"], ["/truncated", "could not be downloaded"],
  ])("bounds %s and accepts a later valid image", async (path, message) => {
    await expect(image(path)).rejects.toThrow(message);
    expect(hostHeaders).toHaveLength(1);
    await recovered();
    expect(hostHeaders).toHaveLength(2);
  });

  it.each([false, true])("bounds the entire DNS/connect/body operation (stalled DNS: %s)", async (stallDns) => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    delayedLookup = stallDns;
    const serverReached = stallDns ? Promise.resolve() : new Promise<void>((resolve) => server.once("request", () => resolve()));
    const pending = image("/slow");
    const denied = expect(pending).rejects.toThrow("timed out");
    // Establish the real response body before advancing only the total deadline.
    await serverReached;
    await new Promise<void>((resolve) => setImmediate(resolve));
    await vi.advanceTimersByTimeAsync(8_001);
    await denied;
    vi.useRealTimers(); delayedLookup = false;
    releaseLookup?.();
    await new Promise<void>((resolve) => setImmediate(resolve));
    if (stallDns) expect(hostHeaders).toHaveLength(0);
    await recovered();
  });
});
