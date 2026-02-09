# GitHub Issues Workflow

> How we track bugs, features, and the roadmap for Paisaxe.

## Overview

GitHub Issues is the single source of truth for all planned work. Every bug, feature, enhancement, and maintenance task gets an issue. This replaces ad-hoc tracking and ensures nothing falls through the cracks now that the site is live.

## Label Taxonomy

Every issue gets **exactly one type label** and **one priority label**. Area labels are optional but recommended.

### Type Labels (`type:`)

| Label | Color | Use when... |
|-------|-------|-------------|
| `type: bug` | red | Something is broken for users |
| `type: feature` | green | Brand new functionality |
| `type: enhancement` | teal | Improvement to an existing feature |
| `type: chore` | gray | Maintenance, deps, CI, docs, cleanup |
| `type: security` | orange | Security vulnerability or hardening |
| `type: docs` | blue | Documentation improvements |

### Priority Labels (`priority:`)

| Label | Color | Meaning | SLA guidance |
|-------|-------|---------|--------------|
| `priority: critical` | dark red | Blocks users, data loss, security vuln | Fix immediately |
| `priority: high` | orange | Major functionality affected | Fix this week |
| `priority: medium` | yellow | Important but not urgent | Fix this sprint/cycle |
| `priority: low` | light green | Backlog, nice to have | When time allows |

### Area Labels (`area:`)

| Label | Color | Scope |
|-------|-------|-------|
| `area: chat` | blue | Text chat, RAG pipeline, Claude API |
| `area: voice` | purple | ElevenLabs, Pelayo, voice agents |
| `area: payments` | green | Stripe, day pass, pricing |
| `area: admin` | dark blue | Admin dashboard, analytics |
| `area: content` | gold | PDFs, embeddings, stories, seed data |
| `area: infra` | indigo | CI/CD, Vercel, Supabase, monitoring |
| `area: marketing` | pink | SEO, social media, marketing agents |
| `area: auth` | dark purple | Authentication, OAuth, user profiles |
| `area: ux` | light blue | UI/UX, design, accessibility |

### Workflow Labels

| Label | Use when... |
|-------|-------------|
| `blocked` | Waiting on an external dependency or decision |
| `duplicate` | Already tracked in another issue |
| `wontfix` | Intentionally not going to address |

## Issue Templates

Three templates are available when creating issues:

1. **Bug Report** — For something that's broken. Requires steps to reproduce.
2. **Feature Request** — For new functionality. Requires a user story.
3. **Enhancement** — For improvements to existing features.

Blank issues are disabled — always use a template to ensure consistent information.

## Creating Issues

### From the CLI (preferred for agents)

```bash
# Bug
gh issue create \
  --title "Chat: responses missing source attribution" \
  --label "type: bug,priority: high,area: chat" \
  --body "## Description\n..."

# Feature
gh issue create \
  --title "Add dark mode support" \
  --label "type: feature,priority: low,area: ux" \
  --body "## User Story\n..."
```

### Conventions

- **Title format**: `[Area]: Brief description` — e.g., "Voice: Pelayo doesn't receive prompt chip question"
- **One issue per concern** — Don't bundle unrelated things
- **Link related issues** — Use "Related: #18" in the body
- **Close with commits** — Use "Fixes #N" in commit messages to auto-close

## Workflow

```
┌─────────┐    ┌─────────────┐    ┌──────────┐    ┌────────┐
│  Open   │───▶│ In Progress │───▶│ On develop│───▶│ Closed │
│ (triage)│    │ (worktree)  │    │ (testing) │    │(released)│
└─────────┘    └─────────────┘    └──────────┘    └────────┘
```

1. **Open** — Issue is created, triaged with type + priority + area labels.
2. **In Progress** — Someone is actively working on it (in a worktree).
3. **On develop** — Fix/feature is merged to `develop`, being tested.
4. **Closed** — Released to production via `main`. Close the issue when the PR to `main` is merged.

### Agent Rules

- **Auto-file issues.** When the user mentions a bug, feature, enhancement, or task in conversation, the agent creates a GitHub issue immediately via CLI. No manual steps for the user.
- **Classify on creation.** Every issue gets type + priority + area labels at creation time. If unsure about priority, default to `priority: medium` and the user can adjust.
- **Ask only when needed.** If the user's description is too vague to write a useful issue, ask for clarification. Otherwise, file it with what you have — issues can be edited later.
- **Multiple items = multiple issues.** If the user lists several things, create one issue per concern.
- **Report back.** After creating an issue, tell the user the issue number, URL, and labels.
- Agents **may work on issues** on `develop` without asking (normal development).
- Agents **must not close issues** that require a production release — the issue stays open until the fix is live on `main`.
- When starting work on an issue, reference it in commit messages: `fix: resolve chat timeout (#42)`.

## Milestones

Use GitHub milestones for grouping issues into planned releases:

```bash
# Create a milestone
gh api repos/{owner}/{repo}/milestones -f title="v1.1" -f description="Post-launch fixes" -f due_on="2026-03-01T00:00:00Z"

# Assign an issue to a milestone
gh issue edit 18 --milestone "v1.1"
```

## Syncing with Development

When agents discover bugs or needed improvements during development:

1. **Create an issue immediately** — Don't just fix it and forget to track it.
2. **If it's quick** — Fix it in the current worktree, reference the issue in the commit.
3. **If it's separate work** — Create the issue and move on. It'll be prioritized later.

This ensures the issue list always reflects the true state of known work.
