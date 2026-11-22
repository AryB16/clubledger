#!/usr/bin/env bash
# Broadcasts the 4 refusal proofs from SPEC §2.9 with a fixed gas limit (skips estimation → the tx is mined and reverts).
# Writes hashes to contracts/proofs.json. Keys come from contracts/.env and are never printed.
set -euo pipefail
cd "$(dirname "$0")/.."
_RPC_OVERRIDE="${RPC:-}"; _ADDR_OVERRIDE="${CLUBLEDGER_ADDRESS:-}"
set -a; . ./.env; set +a
RPC="${_RPC_OVERRIDE:-$BASE_SEPOLIA_RPC}"
ADDR="${_ADDR_OVERRIDE:-$CLUBLEDGER_ADDRESS}"; [ -n "$ADDR" ] || { echo "set CLUBLEDGER_ADDRESS" >&2; exit 1; }
SIG_POST="postEntry(uint8,uint256,string,string,string,string)"
SIG_FIX="correctEntry(uint256,uint256,string,string,string,string)"
EXP2_ORIG=$(cast call "$ADDR" "versionsOf(string)(uint256[])" "EXP-0002" --rpc-url "$RPC" | tr -d '[] ' | cut -d, -f1)

send() { # $1 name, $2 key var, rest: sig + args
  local name=$1 key=$2; shift 2
  local out hash status
  out=$(cast send "$ADDR" "$@" --gas-limit 300000 --rpc-url "$RPC" --private-key "${!key}" --json 2>&1) || true
  hash=$(echo "$out" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const o=JSON.parse(s);console.log(o.transactionHash||o.data?.transactionHash||"")}catch{console.log("")}})')
  if [ -z "$hash" ]; then echo "✗ $name: cast did not broadcast:" >&2; echo "$out" | grep -v -i "private" | head -5 >&2; return 1; fi
  status=$(cast receipt "$hash" status --rpc-url "$RPC")
  echo "$name $hash status=$status" >&2
  echo "\"$name\": \"$hash\""
}

{
  echo "{"
  send rule1_refused PK_RANDOM "$SIG_POST" 1 50000 "Equipment" "Refusal proof" "Random member tries to record money" "EXP-9001"; echo ","
  send rule2_refused PK_TREASURER "$SIG_POST" 1 5000000 "Equipment" "Refusal proof" "Expense larger than the balance" "EXP-9002"; echo ","
  send rule3_refused PK_TREASURER "$SIG_POST" 0 500000 "Sponsorship" "Refusal proof" "Duplicate receipt number" "INC-0001"; echo ","
  send rule4_refused PK_TREASURER "$SIG_FIX" "$EXP2_ORIG" 1000 "Events" "Refusal proof" "Correcting an already-corrected version" "Second correction of the original"
  echo "}"
} > proofs.json
cat proofs.json
