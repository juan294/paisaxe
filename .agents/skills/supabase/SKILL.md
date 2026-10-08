---
name: "Supabase"
description: "Supabase migration safety, local testing workflow, grant requirements, fallback observability, and health endpoint patterns."
---

# Supabase

## Local migration testing

Use a disposable, task-owned local stack. Inspect its project ID, loopback endpoints and synthetic credentials before starting or resetting it. Preserve shared local data; never reset an existing user's stack. From the repository root, prepare a new isolated stack:

```bash
npm run prepare:contracts
```

Preparation runs `supabase start`, verifies the fresh task's Docker identity, and runs `supabase db reset --local` only in its newly created task directory. The required runner verifies `supabase status` before its database cases. It blocks outbound network access during reset, because historical migrations seed production webhook configuration. The preparation command prints the required `test:contracts` invocation with `CONTRACT_STACK_DIR`. Run that printed command from the repository root, where package.json and the real adapters exist. The required tier accepts no required skips. Preparation and real database qualification remain blocked when Docker or local sockets are unavailable.

A postgres-only smoke query does not prove client permissions or RLS. Exercise anon, authenticated owner, authenticated nonowner and service_role through real adapters, including known allowed operations and exact forbidden-operation errors. A connection failure, unknown relation or wrong JWT is not an expected permission denial. Missing Docker, credentials or required cases leaves local acceptance blocked; it cannot become a passing skip. Record the tested migration/schema identity and cleanup result.

## Remote migration authority

Local success does not prove remote parity. Remote `supabase db push` is a separately authorized action after target inspection and completed local gates. Do not add it to the local testing recipe or invoke it as an automatic follow-up. Production migration activation remains separately authorized.

## Access contracts

Declare intended access for each table, view, column and RPC before writing grants or policies. SQL grants permit operations; RLS policies constrain rows. Both must allow an intended query. Missing grants cause a permission failure even if an RLS policy would allow the row; a grant does not bypass RLS for ordinary client roles. Views, security-definer functions and service-role access need their own explicit review.

Grant only the operations and columns required by that object’s contract. For example, an intentionally public article may expose its ID and title while retaining private editorial fields:

```sql
GRANT SELECT (id, title) ON public.public_articles TO anon, authenticated;
```

This grant is only an example for a deliberately public table; its row policy must still enforce the approved visibility. Do not copy it to private tables. A service-role write contract can require separate DML grants on its exact table, without broadening client access:

```sql
GRANT SELECT, INSERT, UPDATE, DELETE ON public.feature_flags TO service_role;
```

Test positive operations and expected denial cases separately from catalog grant assertions. Include forbidden columns, private tables, owner/nonowner row behavior and RPC execution. Preserve existing deliberately restricted column grants; do not replace them with table-wide SELECT.

## Default privileges

Default privileges affect only future objects created by the named owner. They do not repair existing tables, and changing one creator's defaults does not change another creator's defaults. Inventory actual object owners, global and per-schema defaults, effective client grants and RLS separately before choosing a migration. Global grants are additive with per-schema defaults; a per-schema revoke cannot cancel a global grant. Do not assume the current session role created every application object.

Inspect both default scopes and their owner explicitly:

```sql
SELECT pg_catalog.pg_get_userbyid(defaclrole) AS object_owner,
       CASE WHEN defaclnamespace = 0 THEN '(global)'
            ELSE defaclnamespace::regnamespace::text END AS scope,
       defaclobjtype,
       defaclacl
FROM pg_catalog.pg_default_acl
ORDER BY object_owner, scope, defaclobjtype;
```

Do not grant blanket future-table SELECT to anon, authenticated or PUBLIC. Use explicit intended table/column grants in each forward-only migration. If a reviewed service-role default contract is required, scope it with `FOR ROLE` to the actual creating owner and inspect both default scopes; this is not permission to grant public client access. A fresh-reset future private-table fixture must prove it inherits no public client SELECT, before any fixture-specific revokes could hide an unsafe inherited grant. Run the fixture under each relevant creating owner and clean it up. Keep grant checks and real RLS checks distinct.

Check both native skill copies with `node scripts/check-supabase-guidance.mjs`. This offline guidance guard catches prohibited examples and drift; it does not prove database grants, RLS or remote parity.

## Fallback Observability

Wrong -- silent fallback hides production bug:

```typescript
if (error) return DEFAULT_POSTS;  // nobody knows
```

Right -- log at ERROR level when fallback activates:

```typescript
if (error) {
  console.error('[TABLE_FALLBACK] posts query failed:', error.message);
  return DEFAULT_POSTS;
}
```

## Health Endpoints

Wrong -- health check only tests connectivity:

```typescript
app.get('/health', async () => {
  await supabase.from('posts').select('count');
  return { status: 'healthy' };  // doesn't detect degraded state
});
```

Right -- check actual data access:

```typescript
app.get('/health', async () => {
  const { data, error } = await supabase.from('posts').select('id').limit(1);
  if (error) return { status: 'degraded', reason: error.message };
  return { status: 'healthy' };
});
```
