import { describe, expect, it } from "vitest";
import type { User } from "@supabase/supabase-js";
import { mapSupabaseUser } from "./auth";
describe("narrow auth presentation identity", () => {
  it("serializes only string profile values and rejects nested metadata", () => {
    const user = {id:"verified-id", email:"test@example.invalid", user_metadata:{full_name:{secret:"never serialize"}, name:"Safe name", avatar_url:["secret"], picture:"https://example.invalid/avatar"}, app_metadata:{admin:true}} as unknown as User;
    expect(mapSupabaseUser(user)).toEqual({id:"verified-id",email:"test@example.invalid",name:"Safe name",avatarUrl:"https://example.invalid/avatar"});
    expect(JSON.stringify(mapSupabaseUser(user))).not.toContain("secret");
  });
  it("rejects invalid identity and narrows absent metadata", () => {
    expect(mapSupabaseUser({id:{secret:true}} as unknown as User)).toBeNull();
    expect(mapSupabaseUser({id:"id",email:[],user_metadata:{name:3,picture:{}}} as unknown as User)).toEqual({id:"id",email:null,name:null,avatarUrl:null});
    expect(mapSupabaseUser(null)).toBeNull();
  });
});
