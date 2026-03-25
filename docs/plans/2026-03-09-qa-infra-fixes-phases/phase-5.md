# Phase 5: Fix Health Check Script `[batch-eligible]`

> **Files**: `scripts/qa-agent.sh`
> **Estimated effort**: Trivial

## Problem

The QA agent's health check has two stale checks (5th consecutive report flagging this):
1. **Line 99**: Checks for `"status":"ok"` — endpoint returns `"status":"healthy"`
2. **Lines 124-142**: Checks `https://paisaxe.es/api/stripe-test` — endpoint was deleted Feb 5, 2026

The stale checks cause false-positive health failures, trigger unnecessary SMS alerts via Twilio (wasting the $15.45 balance), and generate spurious GitHub issues.

## Changes

### Fix 1: Update health status string — `scripts/qa-agent.sh:99`

```pseudo
- if echo "$HEALTH_RESPONSE" | grep -q '"status":"ok"'; then
+ if echo "$HEALTH_RESPONSE" | grep -q '"status":"healthy"'; then
```

Also update the SMS alert section (~line 152):
```pseudo
- if ! echo "$HEALTH_RESPONSE" | grep -q '"status":"ok"' 2>/dev/null; then
+ if ! echo "$HEALTH_RESPONSE" | grep -q '"status":"healthy"' 2>/dev/null; then
```

### Fix 2: Remove Stripe check, reduce to 2 health checks — `scripts/qa-agent.sh:124-142`

`/api/checkout/health` exists but **requires admin auth** — unsuitable for an unauthenticated health check script. The Stripe webhook endpoint is already verified by the security agent's webhook audit. Remove the Stripe check entirely and reduce expected checks to 2.

```pseudo
- # Check 3: Stripe Connectivity (production endpoint)
- log_info "Checking Stripe connectivity..." | tee -a "$LOG_FILE"
- STRIPE_RESPONSE=$(curl -s --max-time 15 "https://paisaxe.es/api/stripe-test" 2>&1)
- if echo "$STRIPE_RESPONSE" | grep -q '"success":true'; then
-   STRIPE_PRICE=$(echo "$STRIPE_RESPONSE" | grep -oE '"unitAmount":[0-9]+' | cut -d':' -f2 || echo "unknown")
-   log_success "Stripe connectivity: OK (Day Pass: ${STRIPE_PRICE} cents)" | tee -a "$LOG_FILE"
-   HEALTH_CHECKS_PASSED=$((HEALTH_CHECKS_PASSED + 1))
- else
-   log_error "Stripe connectivity: FAILED" | tee -a "$LOG_FILE"
-   # Check for common issues
-   if echo "$STRIPE_RESPONSE" | grep -q "hasInvisibleChars.*true"; then
-     log_warn "  -> Possible cause: Environment variable has invisible characters (see CLAUDE.md troubleshooting)" | tee -a "$LOG_FILE"
-   fi
-   if echo "$STRIPE_RESPONSE" | grep -q "StripeConnectionError"; then
-     log_warn "  -> Possible cause: Network issue or invalid API key" | tee -a "$LOG_FILE"
-   fi
-   HEALTH_CHECKS_FAILED=$((HEALTH_CHECKS_FAILED + 1))
-   HEALTH_CHECK_DETAILS="${HEALTH_CHECK_DETAILS}\n- Stripe check failed: $STRIPE_RESPONSE"
- fi
```

Also update the SMS alert section to remove the Stripe failure check (~line 159):
```pseudo
- if ! echo "$STRIPE_RESPONSE" | grep -q '"success":true' 2>/dev/null; then
-   [[ -n "$FAILED_CHECK_NAMES" ]] && FAILED_CHECK_NAMES="$FAILED_CHECK_NAMES, "
-   FAILED_CHECK_NAMES="${FAILED_CHECK_NAMES}Stripe"
- fi
```

## Verification

```bash
# Test locally with dev server running
curl -s http://localhost:3000/api/health | grep -o '"status":"[a-z]*"'
# Should output: "status":"healthy"

# Run the QA agent manually (dry run)
bash scripts/qa-agent.sh 2>&1 | grep -E "health|PASS|FAIL"
# Should show: 2 passed, 0 failed
```

## Notes

- After this fix, QA agent health checks should be 2/2 PASS (down from 3 checks)
- The false-positive failures have been triggering unnecessary SMS alerts since Feb 5
- Stripe health is adequately covered by the security agent's webhook verification and the E2E test in `e2e/pre-launch.spec.ts` that hits `/api/checkout/day-pass`
