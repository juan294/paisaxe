# Branch Protection Policy

## `main` Branch Requirements

- **0 pull request approvals** (solo-developer repository; GitHub does not allow a PR author to approve their own PR)
- **Explicit release authorization remains mandatory**: the user must authorize the production merge in the current conversation
- **All status checks must pass**: `Lint & Typecheck`, `Test`, `Build`, `Playwright E2E`, `Smoke test Vercel preview`
- **Strict mode**: branch must be up to date with `main` before merge
- **dismiss_stale_reviews**: true — stale approvals are dismissed when new commits are pushed
- **enforce_admins**: true — rules apply to repository admins as well
- **Force pushes**: blocked
- **Branch deletion**: blocked

## Change History

| Date | Change | Reason |
|------|--------|--------|
| 2026-04-19 | Raised `required_approving_review_count` from 0 to 1 | Dependabot incident 2026-03-24 shipped broken Next.js 16.2.1 with 0-approval policy — a single self-approval click adds a deliberate pause before any production merge |
| 2026-04-23 | Added `Smoke test Vercel preview` to required checks | Runtime-only failures must be blocked by a real-environment preview gate before merge |
| 2026-08-10 | Lowered `required_approving_review_count` from 1 to 0 | GitHub rejects self-approval and the repository has no other collaborators; explicit current-conversation authorization plus strict required checks remain the production gate |

## Rationale

GitHub does not allow a pull request author to approve their own pull request. Because this is a solo-developer repository with no other collaborators, requiring one approval creates an impossible gate rather than a meaningful review control.

The production pause is enforced by the repository workflow instead: every merge to `main` requires explicit user authorization in the current conversation, a pull request, strict green status checks, and branch protection enforced for administrators. Dependabot changes must flow through `develop` and the normal release PR rather than being merged directly to `main`.

## Verification

```bash
gh api repos/juan294/paisaxe/branches/main/protection \
  | python3 -c "import json,sys; d=json.load(sys.stdin); \
    pr=d.get('required_pull_request_reviews',{}); \
    sc=d.get('required_status_checks',{}); \
    print('Approvals required:', pr.get('required_approving_review_count')); \
    print('Dismiss stale:', pr.get('dismiss_stale_reviews')); \
    print('Enforce admins:', d.get('enforce_admins',{}).get('enabled')); \
    print('Status checks:', [c['context'] for c in sc.get('checks',[])])"
```

The output must report `Approvals required: 0`, and the status-check list must include `Smoke test Vercel preview`.
