export interface RequestContext {
  requestId: string;
}

interface AsyncLocalStorageLike<T> {
  getStore(): T | undefined;
  run<R>(store: T, callback: () => R): R;
}

function createRequestContextStorage():
  | AsyncLocalStorageLike<RequestContext>
  | undefined {
  if (
    typeof (globalThis as { EdgeRuntime?: string }).EdgeRuntime !== "undefined"
  ) {
    return undefined;
  }

  try {
    const nodeRequire = Function("return require")() as (
      id: string
    ) => {
      AsyncLocalStorage: new <T>() => AsyncLocalStorageLike<T>;
    };
    const { AsyncLocalStorage } = nodeRequire("node:async_hooks");
    return new AsyncLocalStorage<RequestContext>();
  } catch {
    return undefined;
  }
}

const requestContextStorage = createRequestContextStorage();
let fallbackRequestContext: RequestContext | undefined;

export function runWithRequestContext<T>(
  context: RequestContext,
  fn: () => T
): T {
  if (!requestContextStorage) {
    const previousContext = fallbackRequestContext;
    fallbackRequestContext = context;
    try {
      return fn();
    } finally {
      fallbackRequestContext = previousContext;
    }
  }

  return requestContextStorage.run(context, fn);
}

export function getRequestId(): string | undefined {
  return (
    requestContextStorage?.getStore()?.requestId ??
    fallbackRequestContext?.requestId
  );
}

export function withRequestContext<T>(
  request: Pick<Request, "headers">,
  fn: () => T
): T {
  const requestId = request.headers.get("x-request-id")?.trim();

  if (!requestId) {
    return fn();
  }

  return runWithRequestContext({ requestId }, fn);
}
