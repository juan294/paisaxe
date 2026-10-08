import "server-only";
import { lookup } from "node:dns/promises";
import { request, type RequestOptions } from "node:https";
import { isIP, type LookupFunction, type TcpNetConnectOpts } from "node:net";

const MAX_BYTES = 10 * 1024 * 1024;
const TIMEOUT_MS = 8_000;
const PRIVATE_ADDRESS_ERROR = "Private or reserved IP addresses are not allowed";

export class RemoteImageError extends Error {}

function isPublicAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) {
    const [a, b, c] = address.split(".").map(Number);
    return !(
      a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && (b === 0 || b === 168 || (b === 88 && c === 99))) ||
      (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
      (a === 203 && b === 0 && c === 113)
    );
  }
  if (family !== 6) return false;

  // URL canonicalisation collapses zero runs and normalises embedded IPv4.
  // Only global unicast is accepted, excluding transition/special-use ranges.
  const canonical = new URL(`https://[${address}]/`).hostname.slice(1, -1);
  const [first, second = "0"] = canonical.split(":").map((part) => part || "0");
  const prefix = parseInt(first, 16);
  const subnet = parseInt(second, 16);
  return prefix >= 0x2000 && prefix <= 0x3fff &&
    !(prefix === 0x2001 && (subnet <= 0x1ff || subnet === 0xdb8)) &&
    prefix !== 0x2002 && !(prefix === 0x3fff && subnet <= 0xfff);
}

/** Each fresh socket gets only a validated address from this lookup. No second DNS path. */
const publicLookup: LookupFunction = (hostname, options, callback) => {
  void lookup(hostname, { all: true, verbatim: true }).then((addresses) => {
    if (!addresses.length || addresses.some(({ address, family }) =>
      !isPublicAddress(address) || isIP(address) !== family)) {
      callback(new RemoteImageError(PRIVATE_ADDRESS_ERROR), "", 4);
      return;
    }
    const matching = addresses.filter(({ family }) => !options.family || options.family === family);
    if (!matching.length) {
      callback(new RemoteImageError("Remote image host could not be validated"), "", 4);
      return;
    }
    // autoSelectFamily is disabled below; honour all for callers on supported Node versions.
    if (options.all) callback(null, matching);
    else callback(null, matching[0].address, matching[0].family);
  }, () => callback(new RemoteImageError("Remote image host could not be validated"), "", 4));
};

/** HTTPS image download with a total DNS/connect/body deadline and no pooled sockets or redirects. */
export async function fetchRemoteImage(url: URL): Promise<Buffer> {
  if (url.protocol !== "https:") throw new RemoteImageError("Only https:// URLs are allowed");
  if (url.username || url.password) throw new RemoteImageError("URLs with credentials are not allowed");
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  if (hostname.toLowerCase() === "localhost" || (isIP(hostname) && !isPublicAddress(hostname))) {
    throw new RemoteImageError(PRIVATE_ADDRESS_ERROR);
  }

  return new Promise((resolve, reject) => {
    const options: RequestOptions & Pick<TcpNetConnectOpts, "autoSelectFamily"> = {
      method: "GET",
      headers: { Accept: "image/*" },
      lookup: publicLookup,
      autoSelectFamily: false,
      // A new socket guarantees every caller retry repeats the validating lookup.
      agent: false,
    };
    const req = request(url, options, (response) => {
      const fail = (message: string) => req.destroy(new RemoteImageError(message));
      const status = response.statusCode ?? 0;
      if (status >= 300 && status < 400) return fail("Remote image redirects are not allowed");
      if (status < 200 || status >= 300) return fail("Remote image could not be downloaded. Retry or upload a file.");
      if (!response.headers["content-type"]?.toLowerCase().startsWith("image/")) {
        return fail("Remote URL did not return an image. Retry or upload a file.");
      }
      if (Number(response.headers["content-length"]) > MAX_BYTES) return fail("Image too large (max 10MB)");
      const chunks: Buffer[] = [];
      let bytes = 0;
      response.on("data", (chunk: Buffer) => {
        bytes += chunk.length;
        if (bytes > MAX_BYTES) fail("Image too large (max 10MB)");
        else chunks.push(chunk);
      });
      response.on("error", (error) => req.destroy(error));
      response.on("end", () => resolve(Buffer.concat(chunks, bytes)));
    });
    const timeout = setTimeout(() => {
      req.destroy(new RemoteImageError("Remote image request timed out. Retry or upload a file."));
    }, TIMEOUT_MS);
    req.on("error", (error: NodeJS.ErrnoException) => {
      if (error instanceof RemoteImageError) reject(error);
      else if (/CERT|TLS|SSL|SELF_SIGNED|UNABLE_TO_VERIFY/.test(error.code ?? "")) {
        reject(new RemoteImageError("Remote image TLS certificate could not be verified. Retry or upload a file."));
      } else reject(new RemoteImageError("Remote image could not be downloaded. Retry or upload a file."));
    });
    req.on("close", () => clearTimeout(timeout));
    req.end();
  });
}
