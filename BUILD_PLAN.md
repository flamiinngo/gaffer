# ManagerAI — Build Plan & Status

> 0G Zero Cup Hackathon submission. AI World Cup Fantasy Manager on 0G Chain.
> **Principle: everything real, nothing mocked.**

## Locked decisions
- **Scope:** Football-only, **multi-competition** (World Cup 2026 = flagship, + Premier League,
  Champions League). Generic `Competition` model; API-Football is the single data provider.
- **Autonomy engine:** **Agent-owned wallet + event-driven triggers.** A dedicated agent wallet
  holds `RESOLVER_ROLE` and signs its own onchain txs, triggered by the real fixture calendar.
  No human in the loop. Every decision verifiable on 0G (Storage + DA). This is "the AI creating."
- **Game model:** FPL-style fantasy XI. The gaffer builds a squad of real players from across a
  competition's player pool, names an XI + captain per matchday, scores fantasy points from real
  performances (goal/assist/CS/mins/cards, captain 2×). Data via API-Football (cached to respect
  100 req/day free tier — agent pulls once per matchday).
- **AI brain:** **0G Compute only** (decentralized, verifiable inference via 0G's serving network).
  No Gemini. Inference paid from a 0G Compute ledger funded with OG by the agent wallet.
- **Two tiers (arena, not app):**
  1. **Managed gaffer** — UI config → our backend agent runs it on 0G Compute. Web2 one-click.
  2. **BYO-agent CLI/SDK** (`gaffer`) — devs run their own agent with custom strategy + own
     wallet/compute, competing in the same onchain contracts. The open-protocol differentiator.
  Keys NEVER touch the frontend; inference is server/agent-side only.
- **Oracle:** No Chainlink. Backend agent = resolver with `RESOLVER_ROLE`. Real data from
  API-Football. Trust-minimized via **0G DA + 0G Storage** proofs recorded onchain.
- **Network:** 0G Galileo Testnet — RPC `https://evmrpc-testnet.0g.ai`, **chainId 16602**
  (verified live via `eth_chainId`), explorer `https://chainscan-galileo.0g.ai`,
  faucet `https://faucet.0g.ai`.
- **Deployer wallet:** `0xCE49D9de663ce868Ce1FF61E8Ed360844df34ad3` (testnet throwaway).

## Required keys (user provides)
- [ ] `GEMINI_API_KEY` — https://aistudio.google.com/apikey
- [ ] `RAPIDAPI_KEY` (API-Football) — https://rapidapi.com/api-sports/api/api-football
- [x] 0G testnet RPC (public, no key)
- [ ] Fund deployer wallet via faucet

## Build sequence
1. [x] **Contracts** — `ManagerAI.sol` deployed to 0G Galileo at
   `0x42567B7FE168ff2509658Be72697e0277050306C`. 7/7 tests passing. (deployments/galileo.json)
2. [ ] **0G Storage + DA** — real read/write of manager config + decision logs; hash onchain.

### Verified working on testnet (evidence — ALL primitives proven)
- **Data:** SofaScore (SportAPI7) real current **WC2026** (tournament 16, season 58210).
  Fixtures + squads + per-player stats confirmed. 5 rotating keys (auto-failover on 429).
- **0G Compute (chain 16602):** ledger funded (3 OG, tx 0x51a6db…); real XI picked by
  `qwen/qwen2.5-omni-7b` @ `0xa48f…67836`. Agent script `agent/first-pick.mjs`.
- **0G Storage:** decision round-trip PASS — root `0x3322ac…3abb`, byte-identical readback.
  `agent/check-storage.mjs`. SDK `@0gfoundation/0g-storage-ts-sdk`, indexer turbo endpoint.
- **FPL scoring:** real points from real stats (Belgium 0-0 Iran). `agent/check-scoring.mjs`.

### Full cycle DONE ✅ (agent/run-cycle.mjs)
- pick (0G Compute, validated 4-3-3) → store decision (0G Storage) → score (real stats)
  → record onchain → read back from 0G → render. Live result: contest #3, NZ vs Egypt 1-3,
  Chris Wood (C), 17 pts, 3.00x, effective 51. decision `0g://0xe70e3cef…`.
- Dashboard renders the real 0G decision FPL-style (agent/export-latest.mjs → public/gaffer-latest.json).
- Verify page shows the real onchain PointsRecorded decision automatically.
- Production build clean, 12 routes.

### DONE
- Privy login (email+wallet) wired; onboard deploy → real enterContest signed by user wallet,
  gas-sponsored for web2 (/api/deploy/gas). Open free contest #4 for testers.
- Homepage Competition section: "how you win" + live onchain leaderboard + King of the Matchday.
  Real AI-vs-AI showcase contest #5 (agent/populate-contest.mjs): Catenaccio Kid 74 eff,
  Total Attack 51 (3.00x autonomous), Moneyball 47 (2 overrides → lower despite more raw pts).
  Data: agent/export-leaderboard.mjs → frontend/public/leaderboard.json.
- Agent runner (agent/runner.mjs): watches fixture calendar, detects finished matches,
  refreshes onchain leaderboard on a loop — the autonomy heartbeat.
- Homepage brain corrected to 0G Compute (was stale "Gemini").

### Remaining for the win
- `gaffer` CLI (BYO-agent open-protocol angle).
- Demo video (2 min).
- Final polish pass + onboarding clarity.
3. [ ] **Agent** — FastAPI + Gemini brain + API-Football + 0G writes + contract submit.
4. [ ] **Frontend** — design system → landing → onboard → dashboard (pitch viz) → contest → verify.
5. [ ] **E2E** — full contest cycle, 2 managers, 1 match, resolution, payout.
6. [ ] **Demo video** — 2-min walkthrough.

## Design system (non-negotiable)
- Colors: pitch #0A1628, grass #00C853, gold #FFB700, chalk #F0F4FF, midfield #1A2744,
  line #2A3A5C, danger #FF3B5C, data #7B8FBF.
- Type: Bebas Neue (display), Inter (body), JetBrains Mono (data/hashes).
- Signature: live top-down pitch SVG with pulsing player cards.
