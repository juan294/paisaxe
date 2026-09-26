---
name: "source-command-review-pr"
description: "Migrated source command `review-pr`"
---

# source-command-review-pr

Use this skill when the user asks to run the migrated source command `review-pr`.

## Command Template

# PR Review

Multi-perspective review of a pull request using a team of reviewers.

## Usage
- `/review-pr` — reviews the current branch's PR
- `/review-pr 42` — reviews PR #42

## Instructions

### Step 1: Identify the PR

If an argument is provided, use it as the PR number. Otherwise, detect the current branch's PR:
```bash
gh pr view --json number,title,body,additions,deletions,changedFiles,files
```

If no PR is found, tell the user to create one first.

### Step 2: Analyze PR Size

Get the PR diff and file list:
```bash
gh pr diff [number]
gh pr view [number] --json files,additions,deletions
```

Determine team size:
- **Small PR** (< 20 files AND < 500 lines): 3 reviewers (security, qa, arch)
- **Large PR** (20+ files OR 500+ lines): 4 reviewers (add perf-reviewer)

### Step 3: Create Team and Assign Reviewers

Create a team called "pr-review" and spawn reviewers:

1. **security-reviewer** (subagent_type: general-purpose)
   - Check for auth bypasses in changed code
   - Look for input validation gaps
   - Search for hardcoded secrets or credentials
   - Check for injection vectors (SQL, XSS, command)
   - Verify new API routes have proper auth checks

2. **qa-reviewer** (subagent_type: general-purpose)
   - Check if new code has corresponding tests
   - Identify edge cases not covered by tests
   - Look for regression risk in modified code
   - Verify error handling paths
   - Check that test mocks are updated for new features

3. **arch-reviewer** (subagent_type: general-purpose)
   - Check consistency with existing design patterns
   - Look for code duplication
   - Verify naming conventions
   - Check for proper separation of concerns
   - Review import structure and dependencies
   - Flag any architectural decisions that should be documented

4. **perf-reviewer** *(Large PRs only)* (subagent_type: general-purpose)
   - Check for N+1 queries or inefficient database access
   - Look for missing memoization or unnecessary re-renders
   - Check bundle impact of new dependencies
   - Review API response sizes
   - Look for missing pagination or rate limiting

### Step 4: Synthesize Review

After all reviewers complete, synthesize into a structured review:

```
## PR Review: [PR title] (#[number])

### Overall Verdict: [APPROVE | REQUEST CHANGES | NEEDS DISCUSSION]

### Summary
[1-2 sentence overview]

### Security
[security-reviewer findings or "No issues found"]

### Quality & Testing
[qa-reviewer findings or "No issues found"]

### Architecture & Design
[arch-reviewer findings or "No issues found"]

### Performance (if applicable)
[perf-reviewer findings or "No issues found"]

### Action Items
- [ ] [Specific action items from review]
```

Present this review to the user in stdout (do NOT write to a file).
