import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parse} from 'yaml';
const workflow=slug=>parse(readFileSync(new URL('../.github/workflows/'+slug+'.yml',import.meta.url),'utf8'));
test('actual original bundle app remains read-only and publication has an independent numeric-owner gate',()=>{
 const w=workflow('bundle-size');assert.deepEqual(w.jobs.analyze.permissions,{contents:'read'});
 const publisher=Object.values(w.jobs).find(j=>j.steps?.some(s=>s.name==='Comment on PR'));
 assert.notEqual(publisher,w.jobs.analyze);assert.match(publisher.if,/3944118/);assert.match(publisher.if,/1141286326/);assert.match(publisher.if,/User/);
});
for(const slug of ['e2e','security'])test('actual original '+slug+' never supplies private provider/Auth secrets to a same-repository nonowner',()=>{
 const w=workflow(slug),text=JSON.stringify(w.jobs);const secretExpressions=[...text.matchAll(/\$\{\{[^}]*secrets\.[^}]*\}\}/g)].map(x=>x[0]);
 assert.ok(secretExpressions.length>0);for(const expression of secretExpressions){assert.match(expression,/3944118/);assert.match(expression,/User/);}
 for(const job of Object.values(w.jobs).filter(j=>j.steps))assert.equal(job.permissions?.contents,'read');
});
