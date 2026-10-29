// @vitest-environment node
import { expect, it } from "vitest";
import { spawnSync } from "node:child_process";

it("serves prebound matching handlers through actual Next request stores without public arm flags", () => {
  const code = `
import 'next/dist/server/node-environment-baseline.js';
import assert from 'node:assert/strict';
const originalFetch=globalThis.fetch;
let quota=0,jev=0;
globalThis.fetch=async(input,init)=>{
 const url=String(input);
 assert.ok(url.startsWith('https://match-db.invalid/'),'unexpected external origin');
 if(url.includes('/feature_flags'))return Response.json([{enabled:true}]);
 if(url.includes('/auth/v1/user'))return Response.json({id:'u',aud:'authenticated',role:'authenticated',email:'synthetic@example.invalid',app_metadata:{},user_metadata:{},created_at:'2026-01-01T00:00:00Z'});
 if(url.includes('/voucher_redemptions'))return Response.json([{id:'r',voucher_id:'v',chat_turns_used:0,booking_attempts_used:0,vouchers:{chat_turns_limit:20,booking_attempts_limit:2}}]);
 if(url.includes('/rpc/consume_voucher_counter')){quota++;return Response.json({allowed:true,remaining:4});}
 if(url.includes('/experiences'))return Response.json([{id:'00000000-0000-4000-8000-000000000001',merchant_id:'m',slug:'calm',title:'Exact catalog title',description:'Paseo tranquilo',currency:'EUR',price_cents:1000,deposit_cents:200,max_party:6,capacity_per_slot:6,slot_rule:{weekdays:[1],start_times:['10:00']},experience_facts:[],merchant:{confirmation_mode:'catalog'}}]);
 if(url.includes('/rpc/experience_availability'))return Response.json([{start_time:'10:00:00',available:6}]);
 throw new Error('unexpected local fixture path');
};
const {startBookingEvalServer}=await import('./scripts/lib/booking-eval-server.ts');
const server=await startBookingEvalServer({mode:'baseline',createModel:async()=>{throw new Error('unexpected Claude call')},match:{now:()=>new Date('2026-10-28T10:00:00Z'),fetch:async(url,init)=>{
 assert.equal(String(url),'https://api.typesafe.ai/v1/systemone');jev++;
 const request=JSON.parse(String(init.body));
 return Response.json({model:'jev-1.14.0',answers:Object.fromEntries(Object.keys(request.questions).map(key=>[key,{type:'noul',noul:0.99}])),usage:{input_tokens:100,output_tokens:0}});
}}});
try{
 const headers={authorization:'Bearer synthetic-token','content-type':'application/json'};
 const capability=await originalFetch(server.origin+'/api/booking/match?locale=es',{headers});
 assert.equal(capability.status,200);assert.deepEqual(await capability.json(),{available:true});assert.equal(quota,0);assert.equal(jev,0);
 const response=await originalFetch(server.origin+'/api/booking/match',{method:'POST',headers,body:JSON.stringify({locale:'es',preference:'tranquilo',date:'2026-10-30',partySize:2})});
 assert.equal(response.status,200);const result=await response.json();assert.equal(result.status,'matched');assert.equal(result.suggestions[0].experience.title,'Exact catalog title');assert.equal(result.remaining,4);assert.equal(quota,1);assert.equal(jev,1);
 const unknown=await originalFetch(server.origin+'/unregistered',{headers});assert.equal(unknown.status,404);
 console.log('matching_host_verified');
}finally{await server.close();}
`;
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
      timeout: 25_000,
      env: {
        PATH: process.env.PATH,
        HOME: process.env.HOME,
        TMPDIR: process.env.TMPDIR,
        NODE_ENV: "test",
        NEXT_PUBLIC_SUPABASE_URL: "https://match-db.invalid",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "eyJ.synthetic-anon",
        SUPABASE_SERVICE_KEY: "synthetic-service",
        TYPESAFE_API_KEY: "synthetic-only",
        JEV_ENABLED_TASKS: "experience_match",
      },
    },
  );
  expect(result.status, result.stderr).toBe(0);
  expect(result.stdout).toContain("matching_host_verified");
}, 30_000);
