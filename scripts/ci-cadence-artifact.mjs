import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { lstat, readdir, readFile, realpath, writeFile } from 'node:fs/promises';
import { join, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { protectedGitEnvironment } from './ci-cadence-native.mjs';

const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const sha=value=>typeof value==='string'&&/^[a-f0-9]{40}$/.test(value);
const check=(ok,message)=>{if(!ok)throw Error('Candidate artifact: '+message);};
async function inventory(root){
 const files=[];let size=0;
 async function walk(directory){
  for(const name of (await readdir(directory)).sort()){
   const path=join(directory,name),local=relative(root,path).split('\\').join('/');
   if(local==='.next/cache')continue;
   check(!/[\x00-\x1f\x7f]/.test(local),'unrepresentable artifact path');
   const stat=await lstat(path);check(!stat.isSymbolicLink(),'artifact symlink');
   if(stat.isDirectory())await walk(path);
   else{check(stat.isFile()&&stat.nlink===1&&stat.size<=256*1024*1024,'artifact file');size+=stat.size;check(files.length<100000&&size<=2*1024*1024*1024,'artifact inventory bound');
    const bytes=await readFile(path),after=await lstat(path);check(after.dev===stat.dev&&after.ino===stat.ino&&after.size===stat.size&&after.mtimeMs===stat.mtimeMs&&bytes.length===stat.size,'artifact changed during read');
    files.push({path:local,bytes:bytes.length,mode:stat.mode&0o777,sha256:digest(bytes)});
   }
  }
 }
 await walk(join(root,'.next'));check(files.some(f=>f.path.startsWith('.next/static/')&&f.path.endsWith('.js')),'served client asset missing');return files;
}

/** A real completed build in a clean committed candidate checkout is required.
 * This measures files; it does not claim app, provider or native CI success. */
export async function createCandidateManifest(root,{candidateSha}={}){
 root=resolve(root);check(await realpath(root)===root&&sha(candidateSha),'candidate root/commit');
 const git=(...args)=>execFileSync('git',['--no-replace-objects','-c','core.useReplaceRefs=false','-c','core.fsmonitor=false',...args],{cwd:root,env:protectedGitEnvironment(),encoding:'utf8',timeout:5000,maxBuffer:2000000,stdio:['ignore','pipe','pipe']}).trim();
 const checkHead=()=>{check(git('rev-parse','HEAD')===candidateSha,'physical HEAD mismatch');check(git('status','--porcelain','--untracked-files=all')==='','candidate source dirty');};
 checkHead();const treeSha=git('rev-parse','HEAD^{tree}');check(sha(treeSha),'candidate tree');
 const buildId=(await readFile(join(root,'.next/BUILD_ID'),'utf8')).trim();check(/^[A-Za-z0-9_-]{1,200}$/.test(buildId),'build identity missing');
 const lockfileSha256=digest(await readFile(join(root,'package-lock.json')));
 const files=await inventory(root);check(JSON.stringify(files)===JSON.stringify(await inventory(root)),'build changed during measurement');checkHead();
 const value={schemaVersion:1,repositoryId:1141286326,candidateSha,treeSha,buildId,lockfileSha256,nodeVersion:process.version,platform:process.platform,architecture:process.arch,files};
 return {...value,manifestSha256:digest(JSON.stringify(value))};
}
// Usage: node scripts/ci-cadence-artifact.mjs <candidate-sha> <manifest-path>
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{const[candidateSha,output]=process.argv.slice(2);check(output,'manifest output path');const manifest=await createCandidateManifest(process.cwd(),{candidateSha});await writeFile(output,JSON.stringify(manifest)+'\n',{flag:'wx'});console.log(JSON.stringify({candidateSha,treeSha:manifest.treeSha,buildId:manifest.buildId,files:manifest.files.length,manifestSha256:manifest.manifestSha256}));}
 catch(error){console.error(error.message);process.exitCode=1;}
}
