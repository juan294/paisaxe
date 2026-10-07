# Phase 6: Keyboard, hydration and interaction consistency

Parent: [backlog plan](../2026-10-07-github-issues-remediation.md). Owned issues: #939, #917, #772, #721, #929, #928, #909. Baseline: develop `fe1843713a49277bc66460e4ae7470025d01e1c6`; revalidate at entry. Status: planned, not implemented. Apply the parent's local-only authority, TDD/review/simplify loop, sequential verification, coverage ratchets and acceptance boundary in full.

## Scope and source evidence

Sources: `src/components/admin/story-card.tsx:123`, `src/components/immersive/story-toolbar.tsx:25`, `src/hooks/use-story-keyboard-nav.ts:26`, `src/hooks/use-story-keyboard-nav.ts:57`, `src/components/immersive/story-progress-bar.tsx:45`, `src/app/pricing/page.tsx:65`, `src/components/immersive/bookmark-button.tsx:30`, `src/hooks/use-share-story.ts:29`, `src/app/favorites/page.tsx:34`, `src/components/site-footer.tsx:10`, `src/app/operator/[capability]/operator-dashboard.tsx:7`.

## Design and work units

One visitor-interaction owner executes shared viewer/pricing/favorites changes serially. The admin-card focus fix may be [batch-eligible] with disjoint card/test ownership; do not mix it with later module/color refactors.

#721: disable native navigation buttons and mobile tap controls until hydration, with announced readiness/loading; enable automatically afterward. Provide visible no-JS/failed-hydration recovery. Prefer this bounded readiness contract over a bespoke prehydration event queue. The test must observe initial disabled state, release delayed JS and assert exactly one action after one click; repeated clicking until success is not proof.

#917/#772 are one fix: single capture listener, latest callbacks/disabled state in refs, no document+window duplication or WeakSet. Preserve forms/contentEditable exclusions, chat/dialog focus ownership, preventDefault and local widget propagation. Change synthetic window-only tests to realistic focused-element/document events after confirming no actual caller requires window-only dispatch.

#928 shares only roving index/focus mechanics. Preserve story's paged absolute index and stopPropagation versus pricing's tier selection/propagation. #929 adds a small timed-value primitive, preserving bookmark/share 1500ms and favorites undo 6000ms. New notice replaces timer; clear/undo/unmount cancels it; late async completion cannot revive dismissed state. Preserve API mutation semantics and status announcements; unrelated chat copy 2000ms, suggest-place and navigation-hint lifecycles are excluded.

#939 makes all hidden admin card selections/actions visible on focus-within/focus-visible and usable on coarse pointers. Public related-story controls already have focus rings; retain them and treat image opacity matching as an enhancement. #909 adds a normal-flow SiteFooter variant to pricing/checkout/favorites with legal links and focus-visible styling; the current fixed footer must not obscure phone checkout controls. Keep Card, which has a real operator-dashboard consumer.

```text
@ handleStoryNavigation(event) -> action
ctx: focused element, current refs, hydration readiness
pre: one capture listener owns global navigation
do:
  1. validate readiness and local focus ownership
  2. compute one action from current event and state
  3. emit latest callback exactly once
br: form, dialog or local widget owns key -> no global action
fail: hydration unavailable -> visible reload or enable-JS instruction
```

## Automated criteria

Delayed-JS Playwright readiness and no-JS disclosure; one event/one action through repeated renders/navigation; latest callback and unmount listener cleanup; forms/chat/dialog suppression; local progress keys do not advance globally. Roving tests cover empty/one/partial-window, wrap/Home/End and rapid sequence. Fake-clock timed-value tests cover replacement/manual clear/unmount/undo and stale async completion. Keyboard/coarse-pointer card journey proves actions visible and parent action not fired. Legal navigation, zoom/reflow and mobile checkout retain usable controls.

## Manual criteria

Focused desktop/mobile visual review of card overlays, footer and control readiness; automated keyboard assertions remain required. No external action.

## Stuck states and recovery

Unhydrated controls visibly explain readiness; blocked JS offers reload/enable-JS. Failed bookmark/share/favorite action announces retry and coherent rollback; undo cancels expiry correctly. Empty roving sets remain inert without broken focus. Footer links stay reachable and focused. Tests prove automatic enable/retry or the visible instruction, not merely disabled safety.

## Phase acceptance and handoff

Run the parent's applicable sequential integration gates plus the automated criteria above on the integrated candidate. Record exact identity, commands, pass/fail/skip counts, review/simplify findings and fixes, and each issue's local/runtime disposition. Manual or provider evidence is separate; missing evidence leaves the issue open. Stop after acceptance, preserving the plan and implementation receipts; proceed only with authorized continuation. Consumer ownership and command inventory are in [consumer sweep](consumer-sweep.md).
