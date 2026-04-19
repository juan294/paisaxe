# Branch Protection Policy

## `main` Branch Requirements

- **1 pull request approval** (solo dev self-approves — forces a deliberate click before any production merge)
- **All status checks must pass**: Lint & Typecheck, Test, Build, Playwright E2E
- **Strict mode**: branch must be up to date with `main` before merge
- **dismiss_stale_reviews**: true — stale approvals are dismissed when new commits are pushed
- **enforce_admins**: true — rules apply to repository admins as well
- **Force pushes**: blocked
- **Branch deletion**: blocked

## Change History

| Date | Change | Reason |
|------|--------|--------|
| 2026-04-19 | Raised `required_approving_review_count` from 0 to 1 | Dependabot incident 2026-03-24 shipped broken Next.js 16.2.1 with 0-approval policy — a single self-approval click adds a deliberate pause before any production merge |

## Rationale

With 0 required approvals, any CI-green PR could be merged to `main` (production) without any human pause point. The Dependabot incident on 2026-03-24 demonstrated the risk: an automated dependency PR merged cleanly through CI but caused a production breakage.

Requiring 1 approval — even for a solo developer who self-approves — introduces a deliberate gate: the developer must consciously visit the PR, review the diff, and click "Approve" before the merge button is enabled. This is the minimum friction needed to prevent accidental or automated production deployments.

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
