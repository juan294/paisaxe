# QA Agent Enhancement Guide

> A framework for enhancing automated QA agents with browser-based testing and GitHub issue filing, inspired by Ryan Carson's approach.

## Background

This guide documents the analysis and implementation process used to enhance Paisaxe's QA Agent. It's intended to help other teams evaluate and apply similar enhancements to their own QA automation.

---

## Original Inspiration: Ryan Carson's Approach

Ryan Carson shared an approach to automated QA that combines several key ideas:

### Core Principles

1. **User Journey Testing** — Don't just test units; test complete user flows through the application as a real user would experience them.

2. **Automatic Issue Filing** — When tests fail, automatically create GitHub issues with context so failures don't get lost in logs.

3. **Dedicated Test Users** — Use a specific test account for authenticated flows to avoid polluting real user data.

4. **Regular Cadence** — Run QA automatically on a schedule (e.g., weekly) rather than only on deploys.

5. **AI-Powered Analysis** — Use an LLM to analyze failures and provide actionable recommendations, not just raw test output.

### The Key Insight

The breakthrough isn't any single technique—it's the combination:

```
Automated Tests → Failures Detected → Issues Filed → AI Analysis → Actionable Report
```

This creates a closed loop where QA findings automatically enter your workflow rather than sitting in logs.

---

## Analysis Framework

When evaluating which enhancements apply to your project, consider these questions:

### 1. What User Journeys Matter Most?

| Question | Paisaxe Answer | Your Answer |
|----------|----------------|-------------|
| What's the critical path? | Browse stories → Ask questions → Save favorites | _______________ |
| What breaks user trust if it fails? | Chat not responding, auth failures | _______________ |
| What's tested by units but not E2E? | Navigation flow, keyboard shortcuts | _______________ |

**Recommendation:** List 3-5 user journeys that, if broken, would significantly impact user experience.

### 2. What's Your Test Infrastructure?

| Component | Paisaxe Has | You Have | Needed? |
|-----------|-------------|----------|---------|
| E2E framework (Playwright/Cypress) | ✅ | ? | High |
| CI/CD pipeline | ✅ | ? | Medium |
| GitHub CLI access | ✅ | ? | Medium |
| Test database/environment | ✅ | ? | Depends |
| Scheduled task runner | ✅ (launchd) | ? | Medium |

**Recommendation:** You need at minimum an E2E framework. Everything else can be added incrementally.

### 3. Do You Need Authenticated Tests?

| Factor | Paisaxe | Your Project |
|--------|---------|--------------|
| Has user accounts? | Yes | ? |
| Has user-specific data? | Yes (favorites) | ? |
| Auth method | Google OAuth + email/password | ? |
| Can create test users programmatically? | Yes (Supabase Admin API) | ? |

**If you don't have user accounts:** Skip authenticated tests entirely. Focus on anonymous user journeys.

**If you have accounts but no programmatic user creation:** Consider using a manually-created test account with credentials in environment variables.

### 4. What's Your Issue Tracking?

| Factor | Paisaxe | Your Project |
|--------|---------|--------------|
| Uses GitHub Issues? | Yes | ? |
| Has `gh` CLI available? | Yes | ? |
| Alternative (Jira, Linear, etc.)? | No | ? |

**If not GitHub:** The same pattern applies—just swap the CLI commands for your tool's API.

---

## What We Implemented (And Why)

### Phase 1: Browser Journey Tests

**What:** 12 Playwright tests covering user flows

**Why:** Unit tests passed but real users could still hit broken flows (navigation, chat panel, keyboard shortcuts).

**Implementation:**
- Anonymous tests (8): No auth needed, use mocked APIs for determinism
- Authenticated tests (4): Require test user, test real data flows

**Key Decision:** We mocked the chat API in E2E tests for determinism. Real API calls in E2E tests are flaky due to LLM variability.

```typescript
// Mock for deterministic testing
await page.route("**/api/chat/stream", (route) => {
  return route.fulfill({
    status: 200,
    contentType: "text/event-stream",
    body: mockResponse,
  });
});
```

### Phase 2: GitHub Issue Filing

**What:** Bash utility that creates issues with deduplication

**Why:** Test failures in logs get ignored. Issues in GitHub get triaged.

**Key Features:**
- Deduplication: Comments on existing issues instead of creating duplicates
- Labels: `qa-failure` label for filtering
- Templates: Different templates for LLM failures vs. browser failures

**Implementation:** `scripts/lib/github-issues.sh`

```bash
# Core function pattern
create_qa_issue() {
  local title="$1"
  local body="$2"

  # Check for existing issue with same title
  existing=$(find_existing_issue "$title")

  if [[ -n "$existing" ]]; then
    # Add comment instead of duplicate
    add_issue_comment "$existing" "$body"
  else
    # Create new issue
    gh issue create --title "$title" --body "$body" --label "qa-failure"
  fi
}
```

### Phase 3: Test User Infrastructure (DB-Dependent)

**What:** Dedicated test user + cleanup function

**Why:** Authenticated tests create data that needs cleanup between runs.

**⚠️ This requires a database.** If you don't have one, skip this phase.

**Implementation:**
- Setup script creates user via admin API
- SQL function cleans up test data (with email pattern validation for safety)
- Cleanup runs before/after each test

### Phase 4: Feature Flag Gating

**What:** Each enhancement can be toggled independently

**Why:** Allows gradual rollout and quick disable if something breaks.

```json
{
  "enableJourneyTests": true,
  "enableGithubIssues": true
}
```

### Phase 5: AI Analysis

**What:** Claude analyzes failures and writes actionable report

**Why:** Raw test output is noisy. AI can identify patterns and prioritize.

**Already existed in Paisaxe.** If you don't have this, consider adding it—it's the highest-value enhancement.

---

## Minimal Implementation (No Database)

If your project doesn't have a database, here's what still applies:

### ✅ Implement These

1. **Browser Journey Tests**
   - Use Playwright or Cypress
   - Focus on anonymous user flows
   - Mock external APIs for determinism

2. **GitHub Issue Filing**
   - Create the bash utility
   - Run on test failures
   - Include screenshots/traces in issues

3. **Scheduled Runs**
   - Use cron, launchd, or CI scheduled jobs
   - Weekly is a good starting cadence

4. **AI Analysis** (if you have LLM access)
   - Feed test results to Claude/GPT
   - Generate actionable reports

### ❌ Skip These

- Test user infrastructure (needs DB)
- Database cleanup functions (needs DB)
- Cloud sync for favorites (needs DB)

---

## Implementation Checklist

### Week 1: Foundation
- [ ] Add Playwright/Cypress to project
- [ ] Write 3-5 anonymous journey tests for critical paths
- [ ] Verify tests pass locally

### Week 2: Integration
- [ ] Create GitHub issue filing utility
- [ ] Add `qa-failure` label to repo
- [ ] Wire tests to file issues on failure

### Week 3: Automation
- [ ] Set up scheduled runs (cron/launchd/CI)
- [ ] Add AI analysis step (if available)
- [ ] Create report output location

### Week 4: Polish
- [ ] Add more journey tests based on real failures
- [ ] Tune issue templates
- [ ] Document the system for team

---

## Flakiness Mitigation

Browser tests are notoriously flaky. Here's what worked for us:

| Technique | Implementation |
|-----------|----------------|
| **Mock external APIs** | Don't call real LLMs in E2E tests |
| **Explicit waits** | Wait for specific elements, not arbitrary timeouts |
| **Test isolation** | Each test cleans up after itself |
| **Retry on CI** | Playwright's built-in retry mechanism |
| **Graceful skipping** | Skip auth tests if credentials missing |
| **Longer timeouts for auth** | Auth operations need more time than UI clicks |

---

## File Structure Reference

```
scripts/
├── qa-agent.sh              # Main orchestrator
├── lib/
│   ├── agent-utils.sh       # Shared utilities
│   └── github-issues.sh     # Issue filing
├── setup-qa-test-user.sh    # Test user provisioning (DB-dependent)

e2e/
├── qa-journey.spec.ts       # Journey tests
├── fixtures/
│   ├── auth.ts              # Auth helpers (DB-dependent)
│   └── mock-data.ts         # Mock responses

docs/agents/
└── qa-report.md             # AI-generated report output
```

---

## Summary

The core value of this approach isn't any single tool—it's creating a **closed loop**:

```
Tests Run → Failures Detected → Issues Created → AI Analyzes → Team Acts
```

Start with browser journey tests and GitHub issue filing. Those two alone will significantly improve your QA coverage. Add the rest incrementally based on your infrastructure.

---

*Document created: 2026-02-03*
*Based on Paisaxe QA Agent implementation*
