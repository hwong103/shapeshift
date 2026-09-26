#!/usr/bin/env bash
# Guard: refuse to run any Cloudflare write unless the target account is the
# intended one. Wrangler will happily write to whichever account its ambient
# credentials resolve to, and `--profile` is NOT a reliable way to pin that.
# This script reads account_id from the project config and asserts it.
#
# Usage:
#   ./scripts/cf-guard.sh                 # verify only
#   ./scripts/cf-guard.sh deploy          # verify, then exec wrangler <args>
#
# The token is read from the login keychain and never echoed.
set -euo pipefail

EXPECTED_ACCOUNT="${CF_EXPECTED_ACCOUNT:-f252e31e7d3420333f4d60bf154bc4eb}"
KEYCHAIN_SERVICE="wrangler-personal-api-token"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONFIG="$ROOT/wrangler.jsonc"

die() { printf '\033[31mBLOCKED\033[0m %s\n' "$1" >&2; exit 1; }

# 1. The config must pin the account.
[ -f "$CONFIG" ] || die "no wrangler.jsonc at $ROOT"
CONFIGURED="$(sed -nE 's/.*"account_id"[[:space:]]*:[[:space:]]*"([0-9a-f]{32})".*/\1/p' "$CONFIG" | head -1)"
[ -n "$CONFIGURED" ] || die "wrangler.jsonc has no account_id - refusing to guess"
[ "$CONFIGURED" = "$EXPECTED_ACCOUNT" ] \
  || die "wrangler.jsonc account_id=$CONFIGURED but expected $EXPECTED_ACCOUNT"

# 2. The credential must exist and must see that account.
TOKEN="$(security find-generic-password -a "$USER" -s "$KEYCHAIN_SERVICE" -w 2>/dev/null | tr -d '\r\n' || true)"
[ -n "$TOKEN" ] || die "no API token in keychain (service=$KEYCHAIN_SERVICE) - run: wrangler auth create"

VISIBLE="$(curl -s -H "Authorization: Bearer $TOKEN" \
  "https://api.cloudflare.com/client/v4/accounts/${EXPECTED_ACCOUNT}" \
  | grep -c '"success":true' || true)"
[ "$VISIBLE" -ge 1 ] || die "credential cannot see account $EXPECTED_ACCOUNT"

printf '\033[32mOK\033[0m account=%s worker=%s\n' "$EXPECTED_ACCOUNT" \
  "$(sed -nE 's/.*"name"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/p' "$CONFIG" | head -1)"

# 3. Optional passthrough to wrangler.
if [ "$#" -gt 0 ]; then
  CLOUDFLARE_API_TOKEN="$TOKEN" exec npx wrangler "$@"
fi
