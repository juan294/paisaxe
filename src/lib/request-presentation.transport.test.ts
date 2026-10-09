// @vitest-environment node
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {getInitialPresentation} from './request-presentation';
const request = vi.hoisted(() => ({cookies: [] as {name:string;value:string}[]}));
vi.mock('next/headers', () => ({cookies:async()=>({get:()=>undefined,getAll:()=>request.cookies}),headers:async()=>({get:()=>null})}));
beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL','http://127.0.0.1:54321');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY','eyJ-local-transport-fixture');
  request.cookies=[{name:'sb-127-auth-token', value:'base64-'+Buffer.from(JSON.stringify({access_token:'opaque-test-access-token',refresh_token:'opaque-test-refresh-token',expires_at:Math.floor(Date.now()/1000)+3600,user:{id:'fixture-id'}})).toString('base64url')}];
});
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();vi.unstubAllEnvs();});
describe('actual installed Supabase SSR request transport',()=>{
  it('passes the bounded abort signal into the actual SDK fetch and clears its deadline',async()=>{
    vi.useFakeTimers();
    let signal: AbortSignal | undefined;
    vi.stubGlobal('fetch',vi.fn((_input,init:RequestInit)=>new Promise((_resolve,reject)=>{
      signal=init.signal ?? undefined;
      signal?.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')),{once:true});
    })));
    const result=getInitialPresentation();
    await vi.advanceTimersByTimeAsync(1500);
    expect(await result).toMatchObject({user:null,authError:true});
    expect(fetch).toHaveBeenCalled();
    expect(signal?.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });
  it('narrows a verified SDK response without serializing session or nested metadata',async()=>{
    vi.stubGlobal('fetch',vi.fn(async()=>Response.json({id:'fixture-id',email:'fixture@example.invalid',user_metadata:{full_name:{secret:'hidden'},name:'Safe'},app_metadata:{role:'admin'},access_token:'secret-token'})));
    const seed=await getInitialPresentation();
    expect(seed.user).toEqual({id:'fixture-id',email:'fixture@example.invalid',name:'Safe',avatarUrl:null});
    expect(seed.authError).toBe(false);
    expect(JSON.stringify(seed.user)).not.toContain('secret');
    expect(fetch).toHaveBeenCalledWith('http://127.0.0.1:54321/auth/v1/user',expect.objectContaining({method:'GET',signal:expect.any(AbortSignal)}));
  });
});
