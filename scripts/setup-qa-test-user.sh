#!/usr/bin/env bash
# Setup QA Test User — Creates a dedicated test user for authenticated E2E tests
# Run once to provision the user, credentials are saved to .env.local
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$PROJECT_DIR/.env.local"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $*"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $*"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
log_error() { echo -e "${RED}[ERROR]${NC} $*" >&2; }

# Load environment variables
if [[ -f "$ENV_FILE" ]]; then
  # Export env vars from .env.local
  while IFS='=' read -r key value; do
    # Skip comments and empty lines
    [[ -z "$key" || "$key" =~ ^# ]] && continue
    # Only load Supabase vars
    if [[ "$key" == "NEXT_PUBLIC_SUPABASE_URL" || "$key" == "SUPABASE_SERVICE_KEY" ]]; then
      export "$key=$value"
    fi
  done < "$ENV_FILE"
fi

# Validate required env vars
if [[ -z "${NEXT_PUBLIC_SUPABASE_URL:-}" ]]; then
  log_error "NEXT_PUBLIC_SUPABASE_URL not set in $ENV_FILE"
  exit 1
fi

if [[ -z "${SUPABASE_SERVICE_KEY:-}" ]]; then
  log_error "SUPABASE_SERVICE_KEY not set in $ENV_FILE"
  exit 1
fi

# Generate unique test email and secure password
RANDOM_SUFFIX=$(openssl rand -hex 4)
TEST_EMAIL="qa-test-${RANDOM_SUFFIX}@paisaxe.dev"
TEST_PASSWORD=$(openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 32)

log_info "Creating QA test user: $TEST_EMAIL"

# Check if credentials already exist in .env.local
if grep -q "^QA_TEST_USER_EMAIL=" "$ENV_FILE" 2>/dev/null; then
  EXISTING_EMAIL=$(grep "^QA_TEST_USER_EMAIL=" "$ENV_FILE" | cut -d'=' -f2)
  log_warn "QA test user already configured: $EXISTING_EMAIL"
  read -p "Do you want to create a new test user? (y/N) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    log_info "Keeping existing test user configuration"
    exit 0
  fi
  log_info "Creating new test user (old one will remain in Supabase but unused)"
fi

# Create user via Supabase Admin API
RESPONSE=$(curl -s -X POST \
  "${NEXT_PUBLIC_SUPABASE_URL}/auth/v1/admin/users" \
  -H "apikey: ${SUPABASE_SERVICE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$TEST_EMAIL\",
    \"password\": \"$TEST_PASSWORD\",
    \"email_confirm\": true,
    \"user_metadata\": {
      \"purpose\": \"qa-testing\",
      \"created_by\": \"setup-qa-test-user.sh\"
    }
  }" 2>&1)

# Check for errors
if echo "$RESPONSE" | grep -q '"error"'; then
  ERROR_MSG=$(echo "$RESPONSE" | grep -o '"message":"[^"]*"' | cut -d'"' -f4)
  log_error "Failed to create user: $ERROR_MSG"
  log_error "Full response: $RESPONSE"
  exit 1
fi

# Extract user ID
USER_ID=$(echo "$RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [[ -z "$USER_ID" ]]; then
  log_error "Failed to extract user ID from response"
  log_error "Response: $RESPONSE"
  exit 1
fi

log_success "User created with ID: $USER_ID"

# Update .env.local with new credentials
# Remove old QA_TEST_USER entries if they exist
if [[ -f "$ENV_FILE" ]]; then
  grep -v "^QA_TEST_USER_" "$ENV_FILE" > "$ENV_FILE.tmp" || true
  mv "$ENV_FILE.tmp" "$ENV_FILE"
fi

# Append new credentials
{
  echo ""
  echo "# QA Test User (for authenticated E2E tests)"
  echo "QA_TEST_USER_EMAIL=$TEST_EMAIL"
  echo "QA_TEST_USER_PASSWORD=$TEST_PASSWORD"
} >> "$ENV_FILE"

log_success "Credentials saved to $ENV_FILE"
log_info ""
log_info "QA Test User Setup Complete"
log_info "=============================="
log_info "Email:    $TEST_EMAIL"
log_info "Password: $TEST_PASSWORD"
log_info ""
log_info "The QA Agent will now use this user for authenticated journey tests."
log_info "To run tests manually: npx playwright test qa-journey.spec.ts --project=qa-journey"
