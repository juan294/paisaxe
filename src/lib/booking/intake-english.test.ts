// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { enumerateIntakeCandidates, deterministicIntake, partySizeClarificationReason } from './intake-candidates';
import { eligibleIntakeTurn } from './intake';
import { intakeFixtureTurn } from '../../../scripts/eval/jev-booking-intake';
import { parseMatchRequest } from './match-experiences';
const now=new Date('2026-10-28T10:00:00Z');
describe('English booking demo',()=>{
 it.each([
  ['What experiences are available for four people tomorrow up to 120 euros?',4,'2026-10-29',12000],
  ["We are two; what activities are available today at most €60?",2,'2026-10-28',6000],
  ['What options are available for 3 adults on 2026-11-02 up to EUR 120.50?',3,'2026-11-02',12050],
 ])('extracts exact English spans: %s',(message,party,date,budget)=>{
  const p=enumerateIntakeCandidates(message as string,now);expect(p.status).toBe('candidates');if(p.status!=='candidates')throw Error('No English candidates');
  expect(p.party[0]?.value).toBe(party);expect(p.date[0]?.value).toBe(date);expect(p.budget[0]?.value).toBe(budget);
  for(const s of [...p.party,...p.date,...p.budget])expect((message as string).slice(s.start,s.end)).toBe(s.text);
  expect(deterministicIntake(message as string,now)).toMatchObject({status:'accepted',criteria:{partySize:party,date,budgetCents:budget}});
 });
 it.each(['About three people tomorrow','We are roughly four; what is available tomorrow?','What is available for at least two people tomorrow?','Three or four people tomorrow','What is available for three people or so tomorrow?'])('clarifies nonexact English party: %s',m=>expect(partySizeClarificationReason(m)).not.toBeNull());
 it.each(['What is available for 2.5 people tomorrow?','What is available for -2 people tomorrow?','What is available for two people Friday?','What is available for two people tomorrow under 40 euros?','What is available for two people tomorrow at 10:00?'])('retains ordinary chat for unsupported English formats: %s',m=>expect(enumerateIntakeCandidates(m,now).status).toBe('fallback'));
 it('enumerates exact English provider constraints',()=>expect(enumerateIntakeCandidates('What is available for two people tomorrow with step-free access, public transport and our dog?',now)).toMatchObject({status:'candidates',constraints:{step_free:[expect.any(Object)],public_transport:[expect.any(Object)],pets:[expect.any(Object)]}}));
 it('allows pristine English intake while retaining other-locale fallback',()=>{
  expect(eligibleIntakeTurn(intakeFixtureTurn({message:'',now:now.toISOString(),locale:'en'}),false)).toBe(true);
  expect(eligibleIntakeTurn(intakeFixtureTurn({message:'',now:now.toISOString(),locale:'fr'}),false)).toBe(false);
 });
 it('accepts English matching with the same strict numeric and fact constraints',()=>{
  expect(parseMatchRequest({locale:'en',preference:'A quiet coastal walk',partySize:4,budgetCents:12000,constraints:{step_free:true}},now).status).toBe('valid');
  expect(parseMatchRequest({locale:'fr',preference:'A quiet walk'},now).status).toBe('invalid_input');
 });
});
it.each(['up to EUR 120.500','up to €120,000','up to EUR 120.5.0'])('rejects a malformed prefixed currency amount without truncation: %s',budget=>{
 expect(enumerateIntakeCandidates(`What experiences are available for two people tomorrow ${budget}?`,now)).toMatchObject({status:'fallback'});
});
it.each(["We'll be roughly three; what experiences are available tomorrow?","We’ll be about three; what is available tomorrow?"])('clarifies a tentative contracted English count: %s',m=>expect(partySizeClarificationReason(m)).toBe('uncertain_party'));
it.each(['There is one of us. What options are available tomorrow?','There are four of us. What is available tomorrow?'])('understands an exact count of us: %s',m=>expect(enumerateIntakeCandidates(m,now).status).toBe('candidates'));
it('never mistakes the article in a group for an exact party of one',()=>expect(enumerateIntakeCandidates('We are a group of four. What is available tomorrow?',now).status).toBe('fallback'));
it('extracts without-stairs wording and falls back on age requirements',()=>{
 expect(enumerateIntakeCandidates('What is available for four people tomorrow without stairs?',now)).toMatchObject({status:'candidates',constraints:{step_free:[expect.any(Object)]}});
 expect(enumerateIntakeCandidates('What is available for two people tomorrow suitable from age 5?',now).status).toBe('fallback');
});
