# Phase 6: Add Gitleaks CI Workflow `[batch-eligible]`

> **Files**: `.github/workflows/gitleaks.yml` (new)
> **Estimated effort**: Small

## Problem

`.gitleaks.toml` exists with a proper allowlist, but no CI workflow integrates it. Flagged in 6 consecutive security reports. `docs/operations/quality-agents.md` already documents the expected workflow behavior.

## Changes

### Create `.github/workflows/gitleaks.yml`

```yaml
name: Gitleaks

on:
  push:
    branches: [develop, main]
  pull_request:
    branches: [develop, main]
  schedule:
    - cron: "0 4 * * *"  # Daily 04:00 UTC — full history scan

jobs:
  gitleaks:
    name: Secret Scanning
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0  # Full history for scheduled scans

      - uses: gitleaks/gitleaks-action@v2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### Design Decisions

- **Not a required status check** — runs informational alongside `security.yml`. Can be promoted to required later if desired.
- **`fetch-depth: 0`** — enables full-history scanning on scheduled runs. On push/PR events, Gitleaks action automatically scans only the diff.
- **Uses official `gitleaks/gitleaks-action@v2`** — maintained by the Gitleaks team, reads `.gitleaks.toml` automatically.
- **Matches trigger pattern of `security.yml`** — push/PR to develop|main + scheduled.
- **Daily schedule at 04:00 UTC** — as documented in `docs/operations/quality-agents.md`.

## Verification

```bash
# Verify the workflow file is valid YAML
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/gitleaks.yml'))"

# After pushing: check workflow appears in GitHub Actions
gh workflow list

# Run locally to verify no false positives
npx gitleaks detect --config .gitleaks.toml --verbose
```

## Notes

- The security agent script (`scripts/security-agent.sh:63`) already checks for Gitleaks in CI via `grep -rql "gitleaks" .github/workflows/` — this will automatically pass once the workflow is created
- Existing `.gitleaks.toml` allowlist covers `supabase/functions/README.md` (placeholder credentials)
- If the first run surfaces false positives, add paths to `.gitleaks.toml` allowlist
