import { createHmac } from 'node:crypto';
import { finalizeCompletedRun } from './ci-cadence-run.mjs';
/** One immutable measuring run/attempt signs one default-main observation.
 * Native authentication occurs before signing. No retry, nightly develop
 * publication or privileged capability is returned to an application job. */
export async function publishCompletedCoverage(input,{secret,request=fetch,...readerOptions}={}) {
  if(typeof secret!=='string'||!secret||secret.length>4096||/[\r\n]/.test(secret))throw Error('Coverage signing authority unavailable');
  const result=await finalizeCompletedRun(input,readerOptions);
  if(!result.available||result.publishCoverage!==true)throw Error('Authenticated default-main measurement unavailable');
  return publishVerifiedCoverage(result.coverage,{secret,request});
}

/** Only independently authenticated coverage-only or full completion reaches here. */
export async function publishVerifiedCoverage(measured,{secret,request=fetch}={}) {
  if(typeof secret!=='string'||!secret||secret.length>4096||/[\r\n]/.test(secret)||!Number.isSafeInteger(measured?.coverageRunId)||measured.coverageRunId<1||!Number.isSafeInteger(measured?.coverageRunAttempt)||measured.coverageRunAttempt<1)throw Error('Coverage signing identity unavailable');
  const body=JSON.stringify({repo:'juan294/paisaxe',coveragePercent:measured.coverage,testCount:measured.testCount,testFiles:measured.testFiles,passing:measured.passed,failing:measured.failed,
    source:{provider:'github-actions',repository:'juan294/paisaxe',runId:String(measured.coverageRunId),attempt:measured.coverageRunAttempt,workflowRef:measured.coverageWorkflowRef,targetBranch:'main',commitSha:measured.sourceCommitSha,reportedAt:measured.sourceReportedAt}});
  const signature=createHmac('sha256',secret).update(body).digest('hex');
  const controller=new AbortController();let timer;
  try{
    const response=await Promise.race([request('https://portfolio.thecreativetoken.com/api/coverage',{method:'POST',redirect:'error',signal:controller.signal,headers:{'Content-Type':'application/json','X-Coverage-Signature-256':`sha256=${signature}`},body}),new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Error('Coverage publication deadline'));},30000);})]);
    void response.body?.cancel().catch(()=>{});
    if(response.status<200||response.status>=300)throw Error('Coverage publication rejected; no automatic retry');
    return{published:true,runId:measured.coverageRunId,attempt:measured.coverageRunAttempt,sourceSha:measured.sourceCommitSha,completedAt:measured.sourceReportedAt};
  }finally{clearTimeout(timer);}
}
