#!/usr/bin/env bash
# Pre-push guard: .env must be ignored and no private key / API key from it may appear in tracked or staged files.
set -euo pipefail
cd "$(dirname "$0")/.."
git check-ignore -q contracts/.env || { echo "FAIL: contracts/.env is not git-ignored"; exit 1; }
fail=0
while IFS='=' read -r k v; do
  case "$k" in PK_*|ETHERSCAN_API_KEY) ;; *) continue;; esac
  [ -z "$v" ] && continue
  bare="${v#0x}"
  if git grep -q -i -F -e "$bare" --cached 2>/dev/null || git grep -q -i -F -e "$bare" 2>/dev/null; then echo "FAIL: value of $k found in repo"; fail=1; fi
  if [ -d frontend/dist ] && grep -r -q -i -F -e "$bare" frontend/dist; then echo "FAIL: value of $k found in frontend/dist"; fail=1; fi
done < contracts/.env
[ $fail -eq 0 ] && echo "OK: contracts/.env ignored; no secrets in repo or dist"
exit $fail
