import test from 'node:test';
import assert from 'node:assert/strict';
const module=()=>import('./ci-cadence-qualification.mjs');
const row=(project='desktop',status='expected',result='passed')=>({title:'actual reporter boundary',id:'case-id',file:'smoke.spec.ts',line:2,column:1,tests:[{projectName:project,expectedStatus:'passed',status,results:[{status:result,retry:0,errors:[]}]}]});
const report=()=>({config:{rootDir:'/fixture/e2e'},errors:[],stats:{expected:1,skipped:0,unexpected:0,flaky:0},suites:[{title:'smoke',specs:[row()]}]});
test('actual third-party reporter shape retains collection identity and zero retries',async()=>{const{validateBrowserReports}=await module();const list=report(),executed=report();assert.equal(validateBrowserReports({root:'/fixture',collected:list,executed,expectedCounts:{desktop:1},inactive:[],sourceDigests:{}}).passed,1);});
for(const fault of ['zero','flaky','retry','failed','unexpected-skip','identity-change','report-error'])test('browser report fails closed '+fault,async()=>{const{validateBrowserReports}=await module();const collected=report(),executed=report();if(fault==='zero')executed.suites=[];if(fault==='flaky')executed.suites[0].specs[0].tests[0].status='flaky';if(fault==='retry')executed.suites[0].specs[0].tests[0].results[0].retry=1;if(fault==='failed')executed.suites[0].specs[0].tests[0].results[0].status='failed';if(fault==='unexpected-skip')executed.suites[0].specs[0].tests[0].status='skipped';if(fault==='identity-change')executed.suites[0].specs[0].title='other';if(fault==='report-error')executed.errors=[{message:'hook failed'}];assert.throws(()=>validateBrowserReports({root:'/fixture',collected,executed,expectedCounts:{desktop:1},inactive:[],sourceDigests:{}}));});

test('source-pinned original mobile skip is the only admitted skipped identity', async () => {
  const { validateBrowserReports } = await module(); const collected = report(), executed = report();
  const inactive = { ...row('mobile', 'skipped', 'skipped'), id: 'inactive', file: 'author-pill.spec.ts', line: 21 };
  inactive.tests[0].expectedStatus = 'skipped';
  collected.suites[0].specs.push(structuredClone(inactive)); executed.suites[0].specs.push(inactive);
  executed.stats.skipped = 1;
  const input = { root: '/fixture', collected, executed, expectedCounts: { desktop: 1, mobile: 1 }, inactive: [{ project: 'mobile', file: 'e2e/author-pill.spec.ts', line: 21, title: inactive.title, sourceSha256: 'a'.repeat(64) }], sourceDigests: { 'e2e/author-pill.spec.ts': 'a'.repeat(64) } };
  // One actual applicable mobile row is still mandatory alongside its exemption.
  collected.suites[0].specs.push(row('mobile')); executed.suites[0].specs.push(row('mobile')); executed.stats.expected = 2;
  assert.equal(validateBrowserReports(input).skipped, 1);
  input.sourceDigests['e2e/author-pill.spec.ts'] = 'b'.repeat(64); assert.throws(() => validateBrowserReports(input));
});
for (const fault of ['duplicate', 'outside-file', 'unknown-project', 'wrong-stats']) test('browser reporter rejects '+fault, async () => {
 const { validateBrowserReports } = await module(); const collected = report(), executed = report();
 if (fault === 'duplicate') { collected.suites[0].specs.push(row()); executed.suites[0].specs.push(row()); }
 if (fault === 'outside-file') { collected.suites[0].specs[0].file = '../../foreign.spec.ts'; executed.suites[0].specs[0].file = '../../foreign.spec.ts'; }
 if (fault === 'unknown-project') executed.suites[0].specs[0].tests[0].projectName = 'stranger';
 if (fault === 'wrong-stats') executed.stats.expected = 0;
 assert.throws(() => validateBrowserReports({ root: '/fixture', collected, executed, expectedCounts: { desktop: 1 }, inactive: [], sourceDigests: {} }));
});

test('concrete qualification CLI cannot accept missing or unbounded private controller handoff', async () => {
 const { qualificationCli } = await import('./ci-cadence-qualification-cli.mjs');
 for (const args of [[], ['/tmp/controller.mjs', 'a'.repeat(64), '/tmp/evidence', 'Infinity'], ['relative.mjs', 'a'.repeat(64), '/tmp/evidence', '1000'], ['/tmp/controller.mjs', 'a'.repeat(64), '/tmp/evidence', '10800001']]) await assert.rejects(qualificationCli(args));
});
