# Phase 2 — Signed visitor/admin session path `[batch-eligible]`

**Depends on:** Phase 1
**Batch:** application work can run beside other repositories' ownership phases; the auth flip cannot.

## Outcome

Every Paisaxe voice surface can start through a server-minted signed session before any live agent becomes private.

## TDD

1. Add server routes/services that accept an allowlisted Paisaxe agent key, not an arbitrary agent ID.
2. Preserve current visitor entitlement/purchase checks and admin authorization before calling ElevenLabs.
3. Use the server-only `ELEVENLABS_API_KEY` to mint a signed URL/token; never return or log the key.
4. RED cases:
   - unauthenticated visitor/admin;
   - visitor without paid voice access;
   - unknown/wrong agent;
   - missing key;
   - ElevenLabs 401/403/429/5xx;
   - successful visitor Pelayo session;
   - successful admin Penny/Iris/Xander session.
5. Change `voice-chat-elevenlabs.tsx` and `voice-agent-chat.tsx` to start with signed credentials, preserving dynamic variables and locale override.
6. Remove public agent IDs from client session initiation; IDs may remain non-secret display/config data.
7. Deploy application code while agents are still public and exercise both signed paths. This makes the later auth flip reversible without an app deploy race.

## Pseudocode

```ts
authorizeCaller(request, agentKey)
agentId = resolveAllowlistedAgent(agentKey)
signedUrl = elevenLabs.getSignedUrl(agentId)
return { signedUrl }
```

```ts
credentials = await fetchSignedSession(agentKey)
conversation.startSession({
  signedUrl: credentials.signedUrl,
  dynamicVariables: existingVariables,
  overrides: existingLanguageOverride
})
```

## Automated success criteria

- Route tests cover all negative and positive cases.
- No browser bundle/API response contains `ELEVENLABS_API_KEY`.
- Existing voice access and dynamic-variable tests remain green.
- Full test/typecheck/lint/prelaunch passes.

## Manual success criteria

- Preview and production code can initiate signed sessions for Visitor, Booking, and each admin agent while live agents remain public.
- Existing public-ID initiation is no longer used.

## Rollback

Application rollback restores the old initiation path while agents are still public. Do not flip agent auth until this phase is proven in production.
