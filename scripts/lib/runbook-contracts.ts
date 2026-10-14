/** Text-only documentation checks. Never evaluate shell or read environment secrets. */
export function findMigrationProblems(content: string, file: string, migrations: ReadonlySet<string>): string[] {
  return content.split(/\r?\n/).flatMap((text, index) => {
    const historical = new Set(Array.from(text.matchAll(/<!-- migration-history: (\d{3,}_[a-zA-Z0-9_]+\.sql):\s*([^<>]*\S)\s*-->/g), match => match[1]));
    const names = new Set(Array.from(text.matchAll(/\b\d{3,}_[a-zA-Z0-9_]+\.sql\b/g), match => match[0]));
    return [...names].filter(name => !migrations.has(name) && !historical.has(name))
      .map(name => `${file}:${index + 1}: migration ${name} does not exist`);
  });
}

export interface CronCurlExample {
  file: string;
  line: number;
  method: "GET" | "POST";
  path: string;
  headers: Record<string, string>;
  expectedAuth: boolean;
}

const SUPPORTED = 'Supported form: curl [-sS] [-o /dev/null] [-w "%{http_code}"] [-X GET|POST] https://paisaxe.es/api/cron/real-route -H "Authorization: Bearer $CRON_SECRET" (GET) or -H "x-webhook-secret: $WEBHOOK_SECRET" (POST).';

/** Deliberately small quoted-word grammar, not a shell interpreter. */
function words(command: string): string[] {
  if (/[`;|<>]|\$\(|&&|[\r\n]/.test(command)) throw new Error("shell operators are unsupported");
  const tokens: string[] = [];
  let word = "";
  let quote = "";
  let started = false;
  for (const character of command) {
    if (quote) {
      if (character === quote) quote = "";
      else word += character;
    } else if (character === '"' || character === "'") {
      quote = character;
      started = true;
    } else if (/\s/.test(character)) {
      if (started) tokens.push(word);
      word = "";
      started = false;
    } else {
      if (character === "\\") throw new Error("only backslash-newline continuation is supported");
      word += character;
      started = true;
    }
  }
  if (quote) throw new Error("unclosed quote");
  if (started) tokens.push(word);
  return tokens;
}

function parseCommand(command: string, file: string, line: number): CronCurlExample {
  const tokens = words(command);
  if (tokens.shift() !== "curl") throw new Error("command must start with curl");
  let method: "GET" | "POST" = "GET";
  let explicitMethod = false;
  let url: string | undefined;
  const headers: Record<string, string> = {};
  while (tokens.length) {
    const token = tokens.shift();
    if (token === undefined) break;
    if (token === "-s" || token === "-sS") continue;
    if (token === "-o" || token === "-w") {
      const value = tokens.shift();
      if (value !== (token === "-o" ? "/dev/null" : "%{http_code}")) throw new Error("only /dev/null output and %{http_code} formatting are supported");
      continue;
    }
    if (token === "-X" || token === "--request") {
      const value = tokens.shift();
      if (explicitMethod || (value !== "GET" && value !== "POST")) throw new Error("use one GET or POST method");
      method = value;
      explicitMethod = true;
    } else if (token === "-H" || token === "--header") {
      const value = tokens.shift();
      const match = value?.match(/^([a-zA-Z0-9-]+):\s*(.+)$/);
      const headerName = match?.[1];
      const headerValue = match?.[2];
      if (headerName === undefined || headerValue === undefined) throw new Error("header must be a quoted name: value pair");
      const name = headerName.toLowerCase();
      if (Object.hasOwn(headers, name)) throw new Error("duplicate headers are unsupported");
      headers[name] = headerValue;
    } else if (!token.startsWith("-") && !url) url = token;
    else throw new Error("unsupported option or extra argument");
  }
  const parsed = new URL((url ?? "").replace(/^\$BASE_URL(?=\/)/, "https://paisaxe.es"));
  if (!/^https?:$/.test(parsed.protocol) || parsed.username || parsed.password || parsed.search || parsed.hash || !/^\/api\/cron\/[a-z0-9-]+$/.test(parsed.pathname)) {
    throw new Error("use a concrete cron URL without credentials, query or fragment");
  }
  return { file, line, method, path: parsed.pathname, headers, expectedAuth: true };
}

/** Only fenced cron curl examples are in scope; unrelated curl commands are untouched. */
export function parseCronCurlExamples(content: string, file: string): CronCurlExample[] {
  const lines = content.split(/\r?\n/);
  const examples: CronCurlExample[] = [];
  let fence: string | undefined;
  for (let index = 0; index < lines.length; index++) {
    const text = lines[index];
    if (text === undefined) break;
    const marker = text.match(/^\s*(`{3,}|~{3,})/)?.[1];
    if (marker !== undefined) {
      if (!fence) fence = marker;
      else if (marker.charAt(0) === fence.charAt(0) && marker.length >= fence.length) fence = undefined;
      continue;
    }
    if (!fence || !text.includes("curl")) continue;
    const line = index + 1;
    let command = text.trim();
    while (command.endsWith("\\") && index + 1 < lines.length) {
      const continuation = lines[index + 1];
      if (continuation === undefined) break;
      index++;
      command = command.slice(0, -1) + " " + continuation.trim();
    }
    if (!command.includes("/api/cron/")) continue;
    try {
      const example = parseCommand(command, file, line);
      // Rejection probes must say so explicitly; a missing header alone never makes success pass.
      if (/^\s*# Expected: 401\s*$/.test(lines[index + 1] ?? "")) example.expectedAuth = false;
      examples.push(example);
    } catch (error) {
      const reason = error instanceof Error ? error.message : "invalid command";
      throw new Error(`${file}:${line}: ${reason}. ${SUPPORTED}`);
    }
  }
  return examples;
}

/** Substitute only named synthetic values, never process.env or a shell expansion. */
export function cronFixtureRequest(example: CronCurlExample): Request {
  const headers = Object.fromEntries(Object.entries(example.headers).map(([name, value]) => [
    name,
    value.replace(/\$\{(CRON_SECRET|WEBHOOK_SECRET)\}|\$(CRON_SECRET|WEBHOOK_SECRET)\b/g, (_match, braced: string | undefined, plain: string | undefined) =>
      (braced ?? plain) === "CRON_SECRET" ? "docs-cron-fixture" : "docs-webhook-fixture"),
  ]));
  return new Request(`http://localhost${example.path}`, { method: example.method, headers });
}
