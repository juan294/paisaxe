export interface OutdatedPackage {
  current?: string;
  wanted?: string;
  latest?: string;
  [key: string]: unknown;
}

export type OutdatedPackageMap = Record<string, OutdatedPackage>;

function parseSemver(version: string | undefined): [number, number, number] | null {
  const match = version?.match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function compareSemver(a: [number, number, number], b: [number, number, number]): number {
  for (let index = 0; index < 3; index += 1) {
    if (a[index] !== b[index]) return a[index] - b[index];
  }
  return 0;
}

export function filterOutdatedPackages(packages: OutdatedPackageMap): OutdatedPackageMap {
  return Object.fromEntries(
    Object.entries(packages).filter(([, details]) => {
      const current = parseSemver(details.current);
      const latest = parseSemver(details.latest);

      if (!current || !latest) return true;
      return compareSemver(current, latest) <= 0;
    })
  );
}

export function formatOutdatedPackages(packages: OutdatedPackageMap): string {
  return Object.entries(packages)
    .map(([name, details]) => `${name}: ${details.current ?? "unknown"} -> ${details.latest ?? "unknown"}`)
    .join("\n");
}

if (process.argv[1]?.endsWith("filter-npm-outdated.ts")) {
  let input = "";

  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk) => {
    input += chunk;
  });
  process.stdin.on("end", () => {
    const parsed = input.trim() ? JSON.parse(input) as OutdatedPackageMap : {};
    const filtered = filterOutdatedPackages(parsed);
    const mode = process.argv[2] ?? "json";

    if (mode === "list") {
      process.stdout.write(formatOutdatedPackages(filtered));
      if (Object.keys(filtered).length > 0) process.stdout.write("\n");
      return;
    }

    process.stdout.write(JSON.stringify(filtered));
  });
}
