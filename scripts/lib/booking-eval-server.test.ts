// @vitest-environment node
import { expect, it } from "vitest";
import { spawnSync } from "node:child_process";

it("initializes native request storage before a fixture helper's transitive Next imports", () => {
  const code = `process.env.NODE_ENV="test";process.env.NEXT_PUBLIC_SUPABASE_URL="http://127.0.0.1:1";process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY="fixture";process.env.SUPABASE_SERVICE_KEY="fixture";process.env.VOYAGE_API_KEY="fixture";
 await import("./scripts/lib/booking-eval-http-fixtures.ts");
 const{startBookingEvalServer}=await import("./scripts/lib/booking-eval-server.ts");
 let diagnostics=0;const server=await startBookingEvalServer({mode:"baseline",createModel:async()=>{throw new Error("unexpected model creation")},onError:error=>{diagnostics++;console.error(error instanceof Error?error.message:String(error));}});
 try{const response=await fetch(server.origin+"/api/booking/chat/stream",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({message:"Hola",locale:"es"})});console.log(JSON.stringify({status:response.status,body:await response.json(),diagnostics}));}finally{await server.close();}`;
  const result = spawnSync(
    process.execPath,
    [
      "--import",
      "tsx",
      "--conditions=react-server",
      "--input-type=module",
      "-e",
      code,
    ],
    {
      encoding: "utf8",
      env: { ...process.env, NODE_ENV: "test", VERCEL: "", VERCEL_ENV: "" },
      timeout: 15000,
    },
  );
  expect(result.status, result.stderr).toBe(0);
  const output = JSON.parse(result.stdout.trim().split("\n").at(-1)!);
  expect(output).toEqual({
    status: 404,
    body: { error: "Not found" },
    diagnostics: 0,
  });
}, 20000);

it("importing pure HTTP fixtures does not initialize Next globals or perform provider/setup work", () => {
  const code = `const before=globalThis.AsyncLocalStorage;globalThis.fetch=()=>{throw new Error("unexpected network")};await import("./scripts/lib/booking-eval-http-fixtures.ts");console.log(JSON.stringify({sameStorage:globalThis.AsyncLocalStorage===before}));`;
  const result = spawnSync(
    process.execPath,
    [
      "--import",
      "tsx",
      "--conditions=react-server",
      "--input-type=module",
      "-e",
      code,
    ],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        NODE_ENV: "test",
        ANTHROPIC_API_KEY: "",
        TYPESAFE_API_KEY: "",
        VOYAGE_API_KEY: "",
      },
      timeout: 15000,
    },
  );
  expect(result.status, result.stderr).toBe(0);
  expect(JSON.parse(result.stdout.trim())).toEqual({ sameStorage: true });
}, 20000);
