#!/bin/bash
# ================================================================
# Side Scout — Continuous 24-Hour Update Loop
# ================================================================
#
# Runs update_and_deploy.sh, sleeps 24 hours, then repeats.
# Designed to be left running in a terminal or as a background
# process.
#
# Usage:
#   ./backend/run_loop.sh                      # Run now, repeat every 24h
#   ./backend/run_loop.sh --full               # Full re-fetch each cycle
#   ./backend/run_loop.sh --update 6           # Wait 6h, then run every 24h
#   ./backend/run_loop.sh --full 12            # Wait 12h, full re-fetch every 24h
#   nohup ./backend/run_loop.sh --update 3 >> backend/loop.log 2>&1 &  # Background with 3h delay
#
# To check if it's running:
#   pgrep -a -f run_loop.sh
#
# To stop the background process:
#   pkill -f run_loop.sh
#
# ================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DEPLOY_SCRIPT="$SCRIPT_DIR/update_and_deploy.sh"
MODE="${1:---update}"
DELAY_HOURS="${2:-0}"         # Optional 2nd arg: hours to wait before first run
INTERVAL_SECONDS=86400        # 24 hours
DELAY_SECONDS=$(( DELAY_HOURS * 3600 ))

echo ""
echo "========================================================"
echo "🔁 Side Scout Update Loop started at $(date '+%Y-%m-%d %H:%M:%S')"
echo "   Interval : 24 hours"
echo "   Mode     : $MODE"
if [ "$DELAY_SECONDS" -gt 0 ]; then
    FIRST_RUN="$(date -v+${DELAY_HOURS}H '+%Y-%m-%d %H:%M:%S' 2>/dev/null || date -d "+${DELAY_HOURS} hours" '+%Y-%m-%d %H:%M:%S')"
    echo "   Delay    : ${DELAY_HOURS}h — first run at $FIRST_RUN"
    echo "   Stop with: Ctrl+C  (or:  pkill -f run_loop.sh)"
    echo "========================================================"
    echo ""
    echo "⏳ Waiting ${DELAY_HOURS} hour(s) before first run..."
    sleep $DELAY_SECONDS
else
    echo "   Stop with: Ctrl+C  (or:  pkill -f run_loop.sh)"
    echo "========================================================"
fi

while true; do
    echo ""
    echo "▶️  Running update — $(date '+%Y-%m-%d %H:%M:%S')"
    bash "$DEPLOY_SCRIPT" "$MODE" || echo "⚠️  update_and_deploy.sh exited with an error — will retry next cycle"

    NEXT="$(date -v+24H '+%Y-%m-%d %H:%M:%S' 2>/dev/null || date -d '+24 hours' '+%Y-%m-%d %H:%M:%S')"
    echo ""
    echo "😴 Sleeping 24 hours. Next run at: $NEXT"
    sleep $INTERVAL_SECONDS
done
