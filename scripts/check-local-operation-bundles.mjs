#!/usr/bin/env node
// Run after each actual webpack/Turbopack production build.
import fs from "node:fs/promises";
import path from "node:path";

const buildRoot = path.resolve(process.argv[2] ?? ".next");
const routes = ["agents/run", "tunnel"];
const forbidden = [
  /local-operations[\\/]agents(?:\.ts|\.js)/,
  /local-operations[\\/]tunnel(?:\.ts|\.js)/,
  /coverage-agent\.sh/,
  /cloudflared tunnel\.\*paisaxe/,
  /config-paisaxe\.yml/,
];
for (const route of routes) {
  const entry = path.join(buildRoot, "server/app/api/admin", route, "route.js");
  const tracePath = entry + ".nft.json";
  const trace = JSON.parse(await fs.readFile(tracePath, "utf8"));
  if (!Array.isArray(trace.files) || trace.files.length === 0) throw new Error(`Missing trace files: ${route}`);
  const files = [entry, ...trace.files.map((file) => path.resolve(path.dirname(tracePath), file))];
  let javascriptFiles = 0;
  for (const file of files) {
    // Local implementation filenames must be absent even for non-JS traced files.
    if (forbidden.slice(0, 2).some((pattern) => pattern.test(file))) throw new Error(`Local implementation traced by ${route}: ${file}`);
    if (!/\.[cm]?js$/.test(file)) continue;
    javascriptFiles++;
    const bytes = await fs.readFile(file, "utf8");
    if (forbidden.some((pattern) => pattern.test(bytes))) throw new Error(`Local process implementation reachable by ${route}: ${file}`);
  }
  console.log(JSON.stringify({ route, traceFiles: trace.files.length, javascriptFiles, localImplementationReachable: false }));
}
