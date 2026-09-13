#!/bin/zsh
# 每日在本機（台灣 IP）同步疾管署旅遊資料並推上 main。
# 為什麼要有這支：GitHub Actions 的主機抓 od.cdc.gov.tw 常逾時（2026-09-12 兩次失敗），從台灣抓很穩。
# 用獨立 worktree 跑，不碰使用者正在編輯的工作樹；只有同步「成功且有變動」才 commit/push；
# 失敗不推狀態（CI 自己會標示失敗狀態，且本機失敗不該覆蓋線上「上次成功」的資料）。
# 排程：~/Library/LaunchAgents/com.jamesxxx1997.vaccine-guide-sync.plist（每天 07:30）。
set -u
export PATH="$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
REPO="$HOME/vaccine-guide"
WT="$HOME/.cache/vaccine-guide-sync"
LOG="$HOME/Library/Logs/vaccine-guide-sync.log"
mkdir -p "$HOME/Library/Logs" "$HOME/.cache"
log(){ print -r -- "$(date '+%Y-%m-%d %H:%M:%S') $*" >> "$LOG"; }
log "=== start"
if [ ! -e "$WT/.git" ]; then
  /usr/bin/git -C "$REPO" fetch origin main >>"$LOG" 2>&1
  /usr/bin/git -C "$REPO" worktree add --detach "$WT" origin/main >>"$LOG" 2>&1 || { log "worktree add failed"; exit 1; }
fi
cd "$WT" || { log "cd worktree failed"; exit 1; }
/usr/bin/git fetch origin main >>"$LOG" 2>&1 || { log "fetch failed"; exit 1; }
/usr/bin/git checkout -q --detach origin/main >>"$LOG" 2>&1 || { log "checkout failed"; exit 1; }
if ! node tools/sync_travel_data.mjs >>"$LOG" 2>&1; then
  log "sync failed; nothing pushed"; /usr/bin/git checkout -q -- review/ >>"$LOG" 2>&1; exit 2
fi
node tools/verify_current_travel.cjs >>"$LOG" 2>&1 || { log "verify failed; nothing pushed"; /usr/bin/git checkout -q -- review/ data/ >>"$LOG" 2>&1; exit 3; }
/usr/bin/git add -- data/travel/sources review/travel-current.js review/travel-sync-status.js
if /usr/bin/git diff --cached --quiet; then log "no change"; exit 0; fi
/usr/bin/git -c user.name="$(/usr/bin/git -C "$REPO" config user.name)" -c user.email="$(/usr/bin/git -C "$REPO" config user.email)" \
  commit -q -m "Update verified CDC travel snapshot and sync status (local sync from Taiwan)" >>"$LOG" 2>&1 || { log "commit failed"; exit 4; }
/usr/bin/git push origin HEAD:main >>"$LOG" 2>&1 || { log "push failed"; exit 5; }
log "pushed $(/usr/bin/git rev-parse --short HEAD)"
