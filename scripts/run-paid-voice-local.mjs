import {createServer} from 'node:https';
import {createHash,randomUUID} from 'node:crypto';
import {execFileSync,spawn} from 'node:child_process';
import {readFileSync,writeFileSync,mkdtempSync,mkdirSync,openSync,closeSync,readdirSync,statSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {validateManifest,validateKeys,inspectStack,localDockerEnvironment,dockerSql,schemaDigest,migrationInventory,isolatedEnvironment,candidateDigest} from './run-contracts.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
function inputDigest(){
 const hash=createHash('sha256').update(candidateDigest(root));
 const files=execFileSync('git',['ls-files','--cached','--others','--exclude-standard','--','e2e','public','playwright.config.ts','postcss.config.mjs','sentry.*.config.ts','instrumentation.ts','next-env.d.ts'],{cwd:root,encoding:'utf8'}).trim().split('\n').filter(Boolean).sort();
 for(const file of files) hash.update(file+'\0').update(readFileSync(join(root,file)));
 return hash.digest('hex');
}
export function artifactDigest(artifactRoot=root){
 const hash=createHash('sha256');
 const visit=(directory)=>{ for(const name of readdirSync(directory).sort()){
   if(['cache','dev','trace','diagnostics'].includes(name))continue;
   const path=join(directory,name);
   // Next writes incremental route responses here while serving the sealed build.
   if(path===join(artifactRoot,'.next/server/route-cache'))continue;
   if(statSync(path).isDirectory())visit(path);
   else hash.update(path.slice(artifactRoot.length+1)+'\0').update(readFileSync(path));
 }};
 // BUILD_ID is mandatory; development artifacts cannot satisfy this seal.
 readFileSync(join(artifactRoot,'.next/BUILD_ID'),'utf8');visit(join(artifactRoot,'.next'));return hash.digest('hex');
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)){
process.umask(0o077);
const buildOnly=process.argv.includes('--build-artifact');
const development=process.env.PAID_VOICE_ARTIFACT_MODE==='development';
if(buildOnly && development) throw Error('Build artifact mode requires production');
const task=process.env.CONTRACT_STACK_DIR;
if(!task) throw Error('Owned CONTRACT_STACK_DIR required');
const manifest=validateManifest(JSON.parse(readFileSync(join(task,'contracts-stack.json'),'utf8')),task);
const dockerEnv=localDockerEnvironment(); await inspectStack(manifest,dockerEnv);
if(migrationInventory(root).digest!==manifest.migrationDigest || schemaDigest(manifest.projectId,dockerEnv)!==manifest.schemaDigest) throw Error('Paid voice schema identity rejected');
if(dockerSql(manifest.projectId,"SELECT shobj_description(oid,'pg_database') FROM pg_database WHERE datname=current_database();",dockerEnv)!==`paisaxe-contracts:${manifest.nonce}:${manifest.migrationDigest}`) throw Error('Paid voice marker rejected');
const status=JSON.parse(execFileSync('supabase',['status','--workdir',task,'--output','json'],{env:dockerEnv,encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:30000}));
const keys=validateKeys(status,manifest);
const directory=process.env.PAID_VOICE_EVIDENCE_DIR || mkdtempSync(join(tmpdir(),'paisaxe-paid-voice-'));
mkdirSync(directory,{recursive:true,mode:0o700});
const key=join(directory,'tls-key.pem'),cert=join(directory,'tls-cert.pem'),mode=join(directory,'provider-mode'),counts=join(directory,'provider-counts.json');
execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',key,'-out',cert,'-subj','/CN=api.elevenlabs.io','-addext','subjectAltName=DNS:api.elevenlabs.io','-days','1'],{stdio:'ignore'});
writeFileSync(mode,'accept'); const state={requests:0,rejected:0,accepted:0,invalid:0};
const synthetic='phase4-local-only-synthetic-credential';
const nonce=randomUUID();
const server=createServer({key:readFileSync(key),cert:readFileSync(cert)},(request,response)=>{
  state.requests++;
  const url=new URL(request.url,'https://'+request.headers.host);
  const valid=request.method==='GET' && request.headers.host==='api.elevenlabs.io' && url.pathname==='/v1/convai/conversation/get-signed-url' && url.searchParams.get('agent_id')==='agent_1201kgqhsdzxfkk9x7m1bjaew9mv' && request.headers['xi-api-key']===synthetic;
  let code=200,body;
  if(!valid){state.invalid++;code=400;body={error:'stand-in-contract-mismatch'};}
  else if(readFileSync(mode,'utf8')==='reject'){state.rejected++;code=401;body={error:'synthetic-provider-rejection'};}
  else{state.accepted++;body={signed_url:'wss://api.elevenlabs.io/v1/convai/conversation?conversation_id='+nonce};}
  writeFileSync(counts,JSON.stringify(state));response.writeHead(code,{'Content-Type':'application/json'});response.end(JSON.stringify(body));
});
writeFileSync(counts,JSON.stringify(state));
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
const env={...isolatedEnvironment({...process.env,HOME:mkdtempSync(join(directory,'home-'))},manifest,keys,dockerEnv.DOCKER_HOST),
  NODE_ENV:development?"development":"production",PAID_VOICE_ARTIFACT_MODE:development?"development":"production",NEXT_PUBLIC_SITE_URL:"http://localhost:"+(process.env.PLAYWRIGHT_PORT || "3417"),
  ANTHROPIC_API_KEY:"local-no-model",VOYAGE_API_KEY:"local-no-model",
  PAID_VOICE_LOCAL_NONCE:nonce, PAID_VOICE_TLS_PORT:String(server.address().port),PAID_VOICE_TLS_CA:cert,PAID_VOICE_PROVIDER_MODE:mode,PAID_VOICE_PROVIDER_COUNTS:counts,PAID_VOICE_NODE_DENIALS:join(directory,'node-denials.jsonl'),
  ELEVENLABS_API_KEY:synthetic,ELEVENLABS_API_KEY_FINGERPRINT:'sha256:'+createHash('sha256').update(synthetic).digest('hex').slice(0,16),
  STRIPE_SECRET_KEY:'sk_test_phase4_local_only',STRIPE_WEBHOOK_SECRET:'whsec_phase4_local_synthetic',
  NODE_OPTIONS:'--import='+pathToFileURL(join(root,'e2e/fixtures/voice-provider-transport.mjs')).href,
  PLAYWRIGHT_BROWSERS_PATH:process.env.PLAYWRIGHT_BROWSERS_PATH || join(process.env.HOME,"Library/Caches/ms-playwright"),
  PLAYWRIGHT_PORT:process.env.PLAYWRIGHT_PORT || '3417',PLAYWRIGHT_REUSE_SERVER:'false',NEXT_TELEMETRY_DISABLED:'1',WATCHPACK_POLLING:'true',
  PAID_VOICE_TEST_OUTPUT_DIR:join(directory,'test-results'),PLAYWRIGHT_JSON_OUTPUT_FILE:join(directory,'playwright-report.json')};
const digest=candidateDigest(root), paidVoiceInputDigest=inputDigest(),startedAt=new Date().toISOString();
const binding=createHash('sha256').update(JSON.stringify({url:env.NEXT_PUBLIC_SUPABASE_URL,anon:env.NEXT_PUBLIC_SUPABASE_ANON_KEY,site:env.NEXT_PUBLIC_SITE_URL})).digest('hex');
const buildReceipt=process.env.PAID_VOICE_BUILD_RECEIPT;
let result={code:1,signal:null},artifact;
let fd;
try{
 if(!development && !buildReceipt) throw Error('PAID_VOICE_BUILD_RECEIPT required; first run --build-artifact with the same owned stack and inputs');
 if(buildOnly && existsSync(buildReceipt))throw Error('Build receipt already exists; preserve attempts with a new path');
 if(!development && !buildOnly){
   const sealed=JSON.parse(readFileSync(buildReceipt,'utf8'));
   artifact=artifactDigest();
   if(sealed.exitCode!==0 || sealed.code!==0 || sealed.unchangedInputs!==true || sealed.paidVoiceInputDigest!==paidVoiceInputDigest || sealed.artifactDigest!==artifact || sealed.publicBinding!==binding || sealed.project!==manifest.projectId)throw Error('Missing or stale production artifact seal');
 }
 fd=openSync(join(directory,buildOnly?'build.log':'playwright.log'),'wx',0o600);
 const args=buildOnly?['run','build']:[join(root,'node_modules/@playwright/test/cli.js'),'test','--project=paid-voice-local','--workers=1','--reporter=json'];
 const child=spawn(buildOnly?"npm":process.execPath,args,{cwd:root,env,stdio:['ignore',fd,fd]});
 result=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',(code,signal)=>resolve({code,signal}));});
 if(buildOnly && result.code===0)artifact=artifactDigest();
}finally{
 if(fd!==undefined)closeSync(fd);
 server.closeAllConnections();await new Promise(resolve=>server.close(resolve));
 const unchangedInputs=inputDigest()===paidVoiceInputDigest,unchangedArtifact=artifact ? artifactDigest()===artifact : undefined;
 const exitCode=unchangedInputs && (!artifact || unchangedArtifact) ? (result.code??1) : 1;
 const receipt={exitCode,startedAt,finishedAt:new Date().toISOString(),...result,candidateDigest:digest,paidVoiceInputDigest,unchangedInputs,artifactMode:development?'development':'production',artifactDigest:artifact,unchangedArtifact,publicBinding:binding,project:manifest.projectId,taskDir:task,provider:state,listenerClosed:!server.listening,scope:'real local auth/access/RPC/server fetch/SDK UI; exact provider TLS and browser WebSocket boundaries stand in; no provider or model traffic'};
 writeFileSync(join(directory,'receipt.json'),JSON.stringify(receipt,null,2));
 if(buildOnly && exitCode===0)writeFileSync(buildReceipt,JSON.stringify(receipt,null,2),{flag:'wx',mode:0o600});
}
const finalReceipt=JSON.parse(readFileSync(join(directory,'receipt.json'),'utf8'));
const exitCode=finalReceipt.exitCode;
console.log(JSON.stringify({directory,exitCode,provider:state}));process.exit(exitCode);

}
