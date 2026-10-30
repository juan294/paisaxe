// @vitest-environment node
import {expect,it}from'vitest';
import{registeredJevSuites}from'./jev';
it('registers independently frozen English intake and matching evidence without enabling other locales',()=>{
 const suites=registeredJevSuites(),intake=suites.find(s=>s.id==='booking-intake-en'),matching=suites.find(s=>s.id==='experience-match-quality-en');
 expect(intake?.cases).toHaveLength(160);expect(matching?.cases).toHaveLength(40);
 expect(intake?.canQualify).toBe(false);expect(matching?.canQualify).toBe(false);
 expect(matching?.cases.every(c=>(c.input as {request:{locale:string}}).request.locale==='en')).toBe(true);
});
