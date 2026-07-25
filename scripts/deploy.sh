#!/usr/bin/env bash
set -euo pipefail

# Deploys the celengan contract to testnet against the DeFindex USDC vault.
# Usage: ./scripts/deploy.sh <deployer-identity> <owner-g-address>

NETWORK=testnet
USDC=CAQCFVLOBK5GIULPNZRGATJJMIZL5BSP7X5YJVMGCPTUEPFM4AVSRCJU
VAULT=CBMVK2JK6NTOT2O4HNQAIQFJY232BHKGLIMXDVQVHIIZKDACXDFZDWHN
BLEND_POOL=CCEBVDYM32YNYCVNRXQKDFFPISJJCV557CDZEIRBEE4NCV4KHPQ44HGF
SOROSWAP_ROUTER=CCJUD55AG6W5HAI5LRVNKAE5WDP5XGZBUDS5WNTIVDU7O264UZZE7BRD
SOROSWAP_FACTORY=CDP3HMUH6SMS3S7NPGNDJLULCOXXEPSHY4JKUKMBNQMATHDHWXRRJTBY
SOROSWAP_PAIR=CBR76WMT6J733CCVBP23M2EL5QGP5HXLPEFNFZGZ7IB6QHOJAHP7YM3V
XLM=CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC

DEPLOYER=${1:?deployer identity required}
OWNER=${2:?owner G-address required}

cd "$(dirname "$0")/../contracts"
stellar contract build

stellar contract deploy \
  --wasm target/wasm32v1-none/release/celengan.wasm \
  --source-account "$DEPLOYER" \
  --network "$NETWORK" \
  -- \
  --owner "$OWNER" \
  --usdc "$USDC" \
  --vault "$VAULT" \
  --blend_pool "$BLEND_POOL" \
  --soroswap_router "$SOROSWAP_ROUTER" \
  --soroswap_factory "$SOROSWAP_FACTORY" \
  --soroswap_pair "$SOROSWAP_PAIR" \
  --xlm "$XLM"
