// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
import configureNext, { resolveLocalOperationModules } from "../../next.config";
import { createRequire } from "node:module";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { JsConfigPathsPlugin } from "next/dist/build/webpack/plugins/jsconfig-paths-plugin";

const require = createRequire(import.meta.url);
const { webpack } = require("next/dist/compiled/webpack/webpack");

afterEach(() => vi.unstubAllEnvs());
it.each(["production", "development", "test"])("resolves production process routes to inert handlers even with NODE_ENV=%s", async (nodeEnv) => {
  vi.stubEnv("NODE_ENV", nodeEnv);
  const config = await configureNext("phase-production-build");
  expect(config.turbopack?.resolveAlias).toMatchObject({
    "@/lib/local-operations/agents": "./src/lib/local-operations/unavailable.ts",
    "@/lib/local-operations/tunnel": "./src/lib/local-operations/unavailable.ts",
  });
  expect(Object.fromEntries(Object.entries(config.outputFileTracingExcludes ?? {}).filter(([route]) => route !== "*"))).toEqual({
    "/api/admin/agents/run": ["./src/lib/local-operations/agents.ts"],
    "/api/admin/tunnel": ["./src/lib/local-operations/tunnel.ts"],
  });
  expect(config.outputFileTracingExcludes?.["*"]).not.toContain("./src/**");
});
it("keeps local process operations available to the development build", async () => {
  const config = await configureNext("phase-development-server");
  expect(config.turbopack?.resolveAlias).toEqual({});
  expect(Object.keys(config.outputFileTracingExcludes ?? {})).toEqual(["*"]);
});


it.each([false, true])("actual webpack resolution with Next TypeScript paths: development=%s", async (dev) => {
  const fixture = await mkdtemp(path.join(tmpdir(), "paisaxe-webpack-local-"));
  try {
    await mkdir(path.join(fixture, "local"));
    for (const name of ["agents", "tunnel"]) {
      await writeFile(path.join(fixture, "local", `${name}.js`), `import { spawn } from "node:child_process"; export function GET() { return [spawn, "LOCAL_PROCESS_FIXTURE_${name}"]; }`);
    }
    await writeFile(path.join(fixture, "entry.js"), 'export { GET as agentGET } from "@/lib/local-operations/agents"; export { GET as tunnelGET } from "@/lib/local-operations/tunnel";');
    const config = resolveLocalOperationModules({
      mode: "none", target: "node", context: fixture, entry: path.join(fixture, "entry.js"),
      output: { path: path.join(fixture, "out"), filename: "bundle.js" },
      externals: { "next/server": "commonjs next/server" },
      resolve: { extensions: [".js", ".ts"], plugins: [new JsConfigPathsPlugin({ "@/lib/local-operations/*": ["./local/*"] }, { baseUrl: fixture, isImplicit: true })] },
      plugins: [],
    }, { dev, webpack } as never);
    await new Promise<void>((resolve, reject) => {
      const compiler = webpack(config);
      compiler.run((error: Error | null, stats: { hasErrors: () => boolean; toString: () => string }) => {
        compiler.close((closeError: Error | null) => {
          if (error || closeError) reject(error || closeError);
          else if (stats.hasErrors()) reject(new Error(stats.toString()));
          else resolve();
        });
      });
    });
    const bundle = await readFile(path.join(fixture, "out/bundle.js"), "utf8");
    if (dev) {
      expect(bundle).toContain("LOCAL_PROCESS_FIXTURE_agents");
      expect(bundle).toContain("LOCAL_PROCESS_FIXTURE_tunnel");
    } else {
      expect(bundle).not.toContain("LOCAL_PROCESS_FIXTURE_");
      expect(bundle).not.toContain("node:child_process");
      expect(bundle).toContain("Solo disponible en desarrollo local");
    }
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
}, 10_000);
