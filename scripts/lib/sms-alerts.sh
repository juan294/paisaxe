#!/usr/bin/env bash
# SMS Alerts — Send critical failure notifications via Twilio
#
# Required environment variables:
#   TWILIO_ACCOUNT_SID    - Twilio account SID
#   TWILIO_AUTH_TOKEN     - Twilio auth token
#   TWILIO_PHONE_NUMBER   - Twilio phone number (sender)
#   QA_ALERT_PHONE        - Phone number to receive alerts (E.164 format, e.g., +34612345678)

# Send an SMS via Twilio
# Usage: send_sms "message body"
# Returns: 0 on success, 1 on failure
send_sms() {
  local message="$1"

  # Check required env vars
  if [[ -z "$TWILIO_ACCOUNT_SID" || -z "$TWILIO_AUTH_TOKEN" || -z "$TWILIO_PHONE_NUMBER" ]]; then
    log_warn "[sms-alerts] Twilio credentials not configured — skipping SMS" 2>/dev/null || echo "[sms-alerts] Twilio credentials not configured"
    return 1
  fi

  if [[ -z "$QA_ALERT_PHONE" ]]; then
    log_warn "[sms-alerts] QA_ALERT_PHONE not configured — skipping SMS" 2>/dev/null || echo "[sms-alerts] QA_ALERT_PHONE not configured"
    return 1
  fi

  # Send SMS via Twilio API
  local response
  response=$(curl -s -X POST \
    "https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json" \
    -u "${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}" \
    --data-urlencode "To=${QA_ALERT_PHONE}" \
    --data-urlencode "From=${TWILIO_PHONE_NUMBER}" \
    --data-urlencode "Body=${message}" 2>&1)

  # Check for success (response contains "sid" and "status")
  if echo "$response" | grep -q '"sid"'; then
    local sid
    sid=$(echo "$response" | grep -oE '"sid":\s*"[^"]+"' | cut -d'"' -f4)
    log_success "[sms-alerts] SMS sent: $sid" 2>/dev/null || echo "[sms-alerts] SMS sent: $sid"
    return 0
  else
    local error
    error=$(echo "$response" | grep -oE '"message":\s*"[^"]+"' | cut -d'"' -f4 || echo "Unknown error")
    log_error "[sms-alerts] Failed to send SMS: $error" 2>/dev/null || echo "[sms-alerts] Failed to send SMS: $error"
    return 1
  fi
}

# Send critical alert for health check failures
# Usage: send_critical_alert "App Health" "Database connection failed"
send_critical_alert() {
  local check_name="$1"
  local details="$2"

  local message="🚨 PAISAXE ALERT

${check_name} FAILED

${details}

Check: https://paisaxe.es/api/health
Time: $(date '+%Y-%m-%d %H:%M')"

  send_sms "$message"
}

# Send summary alert when multiple checks fail
# Usage: send_health_summary_alert 2 "Database, Stripe"
send_health_summary_alert() {
  local failed_count="$1"
  local failed_checks="$2"

  local message="🚨 PAISAXE: ${failed_count} health checks FAILED

Failed: ${failed_checks}

Immediate attention required.
https://paisaxe.es/api/health

$(date '+%Y-%m-%d %H:%M')"

  send_sms "$message"
}
