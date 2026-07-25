#!/usr/bin/env bash
set -euo pipefail

# End-to-end check on testnet: faucet -> pay -> split -> vault -> withdraw.
# Usage: ./scripts/e2e.sh <contract-id> [payer-identity] [worker-identity]
# Identities are created and funded if they do not exist yet.

NETWORK=testnet
USDC=CAQCFVLOBK5GIULPNZRGATJJMIZL5BSP7X5YJVMGCPTUEPFM4AVSRCJU
USDC_ISSUER=GATALTGTWIOT6BUDBCZM3Q4OQ4BO2COLOAZ7IYSKPLC2PMSOPPGF5V56
FAUCET=https://ewqw4hx7oa.execute-api.us-east-1.amazonaws.com/getAssets

CONTRACT=${1:?contract id required}
PAYER_ID=${2:-celengan-payer}
WORKER_ID=${3:-celengan-worker}

ensure_identity() {
  stellar keys address "$1" >/dev/null 2>&1 ||
    stellar keys generate "$1" --network "$NETWORK" --fund
}

invoke() {
  local source=$1
  shift
  stellar contract invoke --id "$CONTRACT" --source-account "$source" \
    --network "$NETWORK" -- "$@"
}

ensure_identity "$PAYER_ID"
ensure_identity "$WORKER_ID"
PAYER=$(stellar keys address "$PAYER_ID")
WORKER=$(stellar keys address "$WORKER_ID")

echo "payer:  $PAYER"
echo "worker: $WORKER"

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

payer_balance() {
  stellar contract invoke --id "$USDC" --source-account "$PAYER_ID" \
    --network "$NETWORK" -- balance --id "$PAYER" | tr -d '"'
}

if [ "$(payer_balance)" -lt 1000000000 ]; then
  echo "-- funding payer with test USDC (Blend faucet)"
  curl -sf "$FAUCET?userId=$PAYER" | tr -d '"' > "$tmp/faucet.xdr"
  stellar tx sign --sign-with-key "$PAYER_ID" --network "$NETWORK" \
    < "$tmp/faucet.xdr" > "$tmp/faucet-signed.xdr"
  stellar tx send --network "$NETWORK" < "$tmp/faucet-signed.xdr" >/dev/null
fi

echo "-- ensuring worker USDC trustline"
stellar tx new change-trust --source-account "$WORKER_ID" \
  --line "USDC:$USDC_ISSUER" --network "$NETWORK" >/dev/null 2>&1 || true

echo "-- pay 100 USDC through the splitter"
invoke "$PAYER_ID" pay --from "$PAYER" --to "$WORKER" --amount 1000000000

echo "-- worker account after pay (expect spend 80, shares 20 at default split)"
invoke "$WORKER_ID" account_of --user "$WORKER"

echo "-- withdraw 50 USDC spendable"
invoke "$WORKER_ID" withdraw_spend --user "$WORKER" --amount 500000000

echo "-- redeem all savings shares"
SHARES=$(invoke "$WORKER_ID" account_of --user "$WORKER" | python3 -c \
  'import json,sys; print(json.load(sys.stdin)["shares"])')
invoke "$WORKER_ID" withdraw_savings --user "$WORKER" --shares "$SHARES"

echo "-- final worker state"
invoke "$WORKER_ID" account_of --user "$WORKER"

echo "-- worker wallet USDC balance"
stellar contract invoke --id "$USDC" --source-account "$WORKER_ID" \
  --network "$NETWORK" -- balance --id "$WORKER"

echo "e2e ok"
