const REQUEST_ID_HEADER = "x-request-id";
const REQUEST_ID_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;

export function getRequestIdHeaderName() {
  return REQUEST_ID_HEADER;
}

export function getOrCreateRequestId(
  request: Pick<Request, "headers">
): string {
  const upstream = request.headers.get(REQUEST_ID_HEADER)?.trim();

  if (upstream && REQUEST_ID_PATTERN.test(upstream)) {
    return upstream;
  }

  return globalThis.crypto.randomUUID();
}
