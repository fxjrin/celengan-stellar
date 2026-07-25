# Level 4 Idea Submission - Celengan

## 1. Problem statement

Gig workers and small merchants across Southeast Asia are paid in small,
irregular amounts and rarely have an employer pension or automatic savings.
Saving is a manual afterthought, so most never do it. At the same time, moving
between cash and crypto still depends on centralized exchanges that are slow,
KYC-heavy for small amounts, and not built around everyday payments.

Celengan makes saving the default: every incoming payment is automatically
split between spendable money and a yield-earning savings position. The Level 4
goal is to take this from a testnet demo to a product Indonesians can actually
get paid into and cash out of.

## 2. Why Stellar?

- Sub-cent fees make micro-savings viable: a 20% split on a $3 gig payout is
  economically pointless if the fee eats it.
- Soroban enables the split, time locks and yield routing as one atomic
  contract call.
- A mature on-chain DeFi stack (DeFindex vaults, Blend lending, Soroswap AMM)
  provides real yield sources without building them from scratch.
- Stellar's anchor framework (SEP-24/SEP-6) is purpose-built for local
  on/off ramps, which is exactly what the cash-out story needs in Indonesia.
- Fast finality fits point-of-sale and payday flows.

## 3. Target users

- Gig workers in Indonesia and wider Southeast Asia (drivers, couriers,
  freelancers) paid per task
- Small merchants who want an automatic savings cut on every sale
- Younger unbanked or underbanked users who already use e-wallets (QRIS is
  ubiquitous in Indonesia) but have no savings product

## 4. Technical architecture

Already built (Levels 1-3): React 19 + Vite frontend, StellarWalletsKit
multi-wallet, Soroban contract with per-account split/lock/yield-target,
inter-contract routing into DeFindex, Blend and Soroswap on testnet, generated
TypeScript bindings, CI, tests.

Level 4 additions:

```
Payer/e-wallet (QRIS) -> Anchor partner (IDR on-ramp, SEP-24)
                             |
                             v
                     USDC on Stellar
                             |
                             v
                 Celengan contract (split)
                   /                  \
          spendable balance     yield source (vault/pool/LP)
                   |
                   v
         Anchor partner (IDR off-ramp) -> bank / e-wallet payout
```

- Anchor integration through SEP-24 interactive flows for IDR deposit and
  withdrawal, so a worker can cash out spendable balance to a local e-wallet.
- A payment-request layer (links/QR) so platforms can pay workers straight
  through the splitter.
- Notifications and a savings-goal tracker on top of contract events.

## 5. Complexity evaluation

- Correct, safe inter-contract yield routing (already implemented, hardest
  part carried forward and battle-tested with 42 unit tests).
- Anchor/SEP-24 integration with proper KYC handoff and webhook status
  handling, which is significantly more involved than a pure dApp flow.
- Handling partial failures across the ramp -> contract -> yield pipeline so
  user funds are never stranded.
- Mainnet hardening: pause paths, upgrade strategy, monitoring of external
  protocol health, and slippage bounds on swap-based yield.

## 6. Roadmap

- MVP (done on testnet): splitter contract + three yield sources + full web app
- Next: anchor sandbox integration (SEP-24 IDR flow), savings goals UX,
  contract audit pass
- User acquisition: partner with one gig platform or merchant community in
  Indonesia for a pilot cohort; payment links make onboarding one tap
- Mainnet vision: launch with a conservative default (vault-only yield),
  progressive rollout of Blend/Soroswap targets, then QRIS-adjacent cash-out
  through licensed local partners
