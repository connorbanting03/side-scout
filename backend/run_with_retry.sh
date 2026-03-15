#!/bin/bash
# ================================================================
# Side Scout — Retry Wrapper for Nightly Update
# ================================================================
#
# Called by launchd (com.sidescout.nightly) to run the nightly
# cache update with up to 3 retries on failure. This handles
# transient NBA API timeouts or network blips.
#
# ================================================================

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DEPLOY_SCRIPT="$SCRIPT_DIR/update_and_deploy.sh"
MAX_RETRIES=3
RETRY_DELAY=300  # 5 minutes between retries

echo ""
echo "========================================================"
echo "🔁 run_with_retry.sh — $(date '+%Y-%m-%d %H:%M:%S')"
echo "========================================================"

for attempt in $(seq 1 $MAX_RETRIES); do
    echo ""
    echo "▶ Attempt $attempt of $MAX_RETRIES"

    if bash "$DEPLOY_SCRIPT" --update; then
        echo ""
        echo "✅ Nightly update succeeded on attempt $attempt"
        exit 0
    fi

    echo ""
    echo "⚠️  Attempt $attempt failed (exit code $?)"

    if [ "$attempt" -lt "$MAX_RETRIES" ]; then
        echo "   Retrying in $((RETRY_DELAY / 60)) minutes..."
        sleep "$RETRY_DELAY"
    fi
done

echo ""
echo "❌ All $MAX_RETRIES attempts failed."
exit 1
