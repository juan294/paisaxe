# ADR-0019: Defer `role_scopes` Table for Fine-Grained Admin Permissions

**Status:** Accepted (deferred implementation)
**Date:** 2026-06-20
**Deciders:** Juan Gonzalez
**Context:** Issue #543 — SE-S1 from Wave 3 pre-launch audit

## Decision

Adopt a **binary `role === 'admin'` check for now**, and defer the `role_scopes`
capability table until a second collaborator (a non-owner admin) is added to the
project. This ADR documents the target design so it can be implemented quickly
when that trigger fires, without re-deriving it.

## Context

`src/lib/admin-auth.ts:114` gates every admin operation on a single binary
check:

```ts
if (!profile || profile.role !== "admin") { /* 403 */ }
```

`user_profiles.role` is `'user' | 'admin'`. Every admin route — analytics,
cost entry, story moderation, suggestions, agent config — is protected by the
same `validateAdminAuth()` / `withAdmin()` / `withAdminRead()` helpers
(`src/lib/admin-auth.ts:158,176`). There is no way to grant a collaborator
access to, say, story moderation without also granting them cost-analytics
mutation and agent-config control.

Today this is acceptable: there is exactly one admin (the owner). Fine-grained
permissions add schema, a join on every request, and a policy surface to
maintain — cost with no current benefit.

## Proposed Schema (deferred)

A `capabilities` enum + a `role_scopes` join table keyed by user:

```sql
-- Capability vocabulary. Add values as new admin surfaces appear.
create type public.admin_capability as enum (
  'stories:moderate',
  'stories:translate',
  'costs:read',
  'costs:write',
  'analytics:read',
  'agents:configure',
  'suggestions:manage',
  'flags:manage'
);

-- One row per (user, capability) grant.
create table public.role_scopes (
  user_id     uuid not null references auth.users(id) on delete cascade,
  capability  public.admin_capability not null,
  granted_by  uuid references auth.users(id),
  granted_at  timestamptz not null default now(),
  primary key (user_id, capability)
);

-- RLS: only service-role (server) reads/writes; never client-exposed.
alter table public.role_scopes enable row level security;
```

The existing `user_profiles.role = 'admin'` stays as the **coarse gate**:
`role = 'admin'` means "is an admin at all"; `role_scopes` rows refine *which*
admin surfaces. An owner is modelled as an admin holding every capability (or a
short-circuit `is_owner` flag that bypasses the scope check).

## Proposed `requireCapability()` API (deferred)

Layer a capability check on top of the existing auth helpers without changing
their signatures for callers that only need the binary gate:

```ts
// New: extends validateAdminAuth() with a capability requirement.
export async function requireCapability(
  capability: AdminCapability
): Promise<AuthResult> {
  const auth = await validateAdminAuth();      // existing binary gate first
  if (!auth.valid) return auth;

  // Owner short-circuit, then scope lookup (cacheable like the role cache
  // already present in admin-auth.ts:13-15).
  const granted = await hasCapability(auth.userId, capability);
  if (!granted) {
    return {
      valid: false,
      error: NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      ),
    };
  }
  return auth;
}

// Higher-order wrapper, mirroring withAdmin():
export async function withCapability<T>(
  capability: AdminCapability,
  handler: (supabase: SupabaseClient) => Promise<T>
): Promise<T | NextResponse> {
  const auth = await requireCapability(capability);
  if (!auth.valid) return auth.error;
  return handler(createAdminClient());
}
```

Migration of call sites is additive: routes keep `withAdmin(...)` until a route
needs scoping, then opt into `withCapability('costs:write', ...)`. The 30-second
in-process role cache (`admin-auth.ts:13`) extends naturally to a per-user
capability set.

## Trigger to Implement

Implement when **any** of these becomes true:

1. A second human admin is added who should NOT have full owner access.
2. A "read-only analyst" or "content moderator" role is requested.
3. An external contractor needs scoped, time-boxed access.

Until then, the binary check is the correct amount of mechanism.

## Consequences

- No schema change, no per-request join cost today.
- The design is captured, so the future implementation is a mechanical
  application of this ADR rather than a fresh investigation.
- The coarse `role = 'admin'` gate remains the foundation; `role_scopes` is
  purely additive and backward compatible.
- Revisit at the first multi-admin trigger above.
