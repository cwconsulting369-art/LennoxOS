#!/bin/bash
# Activity-Sync All — Claude JSONL + Vendors + Stripe
# Called hourly by cron. Logs to /tmp/activity-sync.log
set -e
cd /home/carlos/lennox-os/services/activity-sync
export PATH="/home/carlos/.nvm/versions/node/v22.22.2/bin:$PATH"

LOG=/tmp/activity-sync.log
echo "===== $(date -u +%Y-%m-%dT%H:%M:%SZ) =====" >> "$LOG"
node claude-jsonl-parser.js >> "$LOG" 2>&1 || echo "claude-parser failed" >> "$LOG"
node vendor-sync.js      >> "$LOG" 2>&1 || echo "vendor-sync failed" >> "$LOG"
node stripe-sync.js      >> "$LOG" 2>&1 || echo "stripe-sync failed" >> "$LOG"
node infra-sync.js       >> "$LOG" 2>&1 || echo "infra-sync failed" >> "$LOG"
node ai-sync.js          >> "$LOG" 2>&1 || echo "ai-sync failed" >> "$LOG"
node automation-sync.js  >> "$LOG" 2>&1 || echo "automation-sync failed" >> "$LOG"
node marketing-sync.js   >> "$LOG" 2>&1 || echo "marketing-sync failed" >> "$LOG"
echo "" >> "$LOG"
