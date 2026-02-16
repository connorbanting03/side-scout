#!/bin/bash
# ================================================================
# Side Scout — Nightly Cache Update & Auto-Deploy
# ================================================================
#
# This script runs the incremental cache prefetch, then commits
# and pushes the updated JSON files to GitHub. Since you have
# automatic deployment from GitHub, this triggers a redeploy
# with fresh cache data — zero manual work.
#
# Setup (one-time):
#   1. Make executable:    chmod +x backend/update_and_deploy.sh
#   2. Add to crontab:     crontab -e
#   3. Paste this line (runs at 3 AM ET every day):
#
#      0 3 * * * /Users/connorbanting/Documents/side-scout/backend/update_and_deploy.sh >> /Users/connorbanting/Documents/side-scout/backend/cron.log 2>&1
#
#   To verify crontab was saved:  crontab -l
#   To check logs:                tail -f backend/cron.log
#
# Modes:
#   ./update_and_deploy.sh           # Incremental update (default, fast)
#   ./update_and_deploy.sh --full    # Full re-fetch (slower, all players)
#
# ================================================================

set -euo pipefail

# ---- Configuration ----
REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BRANCH="main"
REMOTE="origin"
PREFETCH_MODE="${1:---update}"  # Default to --update (incremental)
TIMESTAMP="$(date '+%Y-%m-%d %H:%M:%S')"

echo ""
echo "========================================================"
echo "🌙 Side Scout Nightly Update — $TIMESTAMP"
echo "   Repo: $REPO_DIR"
echo "   Mode: $PREFETCH_MODE"
echo "========================================================"

cd "$REPO_DIR"

# ---- Step 1: Pull latest to avoid conflicts ----
echo ""
echo "📥 Pulling latest from $REMOTE/$BRANCH..."
git pull "$REMOTE" "$BRANCH" --ff-only || {
    echo "⚠️  Pull failed (likely merge conflict). Trying rebase..."
    git pull "$REMOTE" "$BRANCH" --rebase
}

# ---- Step 2: Run the cache prefetch ----
echo ""
echo "🔄 Running prefetch_cache.py $PREFETCH_MODE..."
python3 backend/prefetch_cache.py "$PREFETCH_MODE"

# ---- Step 3: Check if there are any changes to commit ----
echo ""
CHANGES=$(git status --porcelain backend/cache/)

if [ -z "$CHANGES" ]; then
    echo "✅ No new data — cache is already up to date. Nothing to push."
    exit 0
fi

# Count changed files
CHANGED_COUNT=$(echo "$CHANGES" | wc -l | tr -d ' ')
echo "📝 $CHANGED_COUNT cache file(s) changed"

# ---- Step 4: Git add, commit, push ----
echo ""
echo "📤 Committing and pushing to $REMOTE/$BRANCH..."

git add backend/cache/
git commit -m "chore: nightly cache update $(date '+%Y-%m-%d') [skip ci]"
git push "$REMOTE" "$BRANCH"

echo ""
echo "========================================================"
echo "✅ Done! Cache updated and pushed at $(date '+%H:%M:%S')"
echo "   Deployment will trigger automatically from GitHub."
echo "========================================================"
