# Gaffer — Round of 32 Build Log

Running record of every change made for the next-round (top-32) submission, so it's ready to drop into the submission form. Newest entries at the bottom of each section.

**Context:** Qualified top 32 of 200 for the 0G Zero Cup. Goal this round: deepen the 0G-native story (verifiable AI), make the AI's decisions visible and verifiable to logged-out visitors straight from the homepage, and raise the whole product to ecosystem-app quality (sexy front, real back).

---

## Winning thesis (positioning for the form)
> Gaffer is the first **provably autonomous** AI agent you can own — it thinks on 0G Compute, remembers on 0G Storage, proves itself on 0G DA, and competes onchain. You don't trust it because we say so; you verify every decision yourself.

## The four pillars this round
1. **Proof Explorer (flagship)** — every AI decision is a replayable cryptographic proof across all 4 0G layers, verifiable live from the homepage.
2. **Ownable Gaffer identities** — each agent has a public, clickable, tamper-proof career page (visible logged-out).
3. **Press Room** — the AI cuts a post-match promo in its persona (0G Compute) → shareable match-report card.
4. **60-second magic onboarding** — name → crest → personality → instant live preview of its first pick.

## Hard requirements (from the user)
- Everything must actually work and be verifiable **from the homepage**.
- The field, lineup and agent decisions must be visible to visitors **without signing up**; clicking an agent opens its full pick + profile.
- Sexy, #1-quality homepage; great backend + visually appealing frontend.
- **No pushing until every change is done and we're ready** — build + verify locally, push once.
- A "custom entry type" will be added later — leave a clean hook, don't block it.

---

## 🏆 Competition engine — FPL knockout format (Phase 1) — the big one
See `COMPETITION_DESIGN.md` for the full format. Rebuilt the showcase engine so it's a real
World-Cup-native fantasy game, not a single-game scrap.
- **Selection pool = EVERY nation in the round, not just teams who've played.** `buildRound()` in
  `populate-contest.mjs` now reads `events/last` + `events/next`, detects the active round
  (Round of 32), pulls **all 32 nations' squads** (`/team/{id}/players`) and builds the pool
  (top GK + top 6 outfield per nation). Verified live: **224 players across 32 nations** incl.
  Mbappé, Haaland, Hakimi, Nuno Mendes, Pacho.
- **Real market-value pricing.** Replaced noisy single-matchday rating with each player's
  **actual market value** (`proposedMarketValue`, €) mapped position-aware onto the £4.0–£14.0 FPL
  band (sqrt curve so the top compresses like real FPL; GK/DEF caps). Mbappé/Haaland £14.0,
  full-backs £8.5, squad players ~£4.5–5.5. **The £100m now genuinely bites** — squads land at
  £97.8–99.5m (vs the old £83m with cash to spare).
- **FPL squad rules enforced.** £100m for 15, valid formation, captain (2×), and **max 3 per
  nation** — the cap relaxes by necessity as nations are eliminated: `max(3, ceil(15/teamsLeft))`
  (3 through QF, 4 in semis, up to 8 in the final). Deterministic enforcement in `pickXI` +
  `enforceBudget` (both nation- and budget-aware) backs up the AI's own choices.
- **Live "gameweek in progress" scoring.** Only finished games score; players whose nation hasn't
  kicked off are **pending** (no fake zeros). Each decision carries `gamesPlayed/gamesTotal`,
  `numTeams`, `maxPerNation`, and per-player `pending`. As the real Round of 32 plays out, the
  daily autonomous refresh fills the points in — honest and live.
- **DRY_RUN mode** (`DRY_RUN=1`) previews the full pool + each gaffer's squad with **zero gas /
  zero storage / no contest** — used to verify the engine before minting. Dry run confirmed:
  3 divergent strategies, all within the per-nation cap, budget biting, pending flags correct.
- **Pipeline + UI:** `export-leaderboard.mjs` carries the new round/budget/pending fields into
  `proofs.json` / `leaderboard.json` / `gaffer-latest.json`; `Pitch.tsx` shows each player's
  £price, the squad-value & in-the-bank strip, and a **pending marker** for not-yet-kicked-off
  players. `tsc --noEmit` clean.

## 🎮 Phase 2 — retention / fun (in progress)
- **"Next to kick off" now live (was "syncing").** Root cause: the FRONTEND env
  (`frontend/.env.local`) still held the dead 5-key rotation, so `/api/fixtures` always 429'd.
  Swapped in the paid Pro key; the homepage Match Center now shows the **real upcoming Round of
  32 fixtures** (Brazil v Japan, Germany v Paraguay, France v Sweden…) with live countdowns.
- **Knockout-survival board (signature mechanic).** New `/api/round` + `getRoundStatus()` derive
  each nation's status for the live round (through / out / pending) from real fixtures (penalty
  ties handled). New `SurvivalStrip` on the gaffer profile shows **"Nations you're riding"** —
  each squad nation with player count and status, eliminated nations greyed/red. Verified live:
  South Africa shows **OUT** (banked its R32 points but is knocked out → gone next round), the
  rest "live soon". This is the World-Cup-native drama no season-league fantasy game has.
- Quality: `tsc --noEmit` clean throughout.

## 🧹 Reality & simplicity audit (owner mandate: real pages, no fakes, no unnecessary build)
- **Removed fabricated data:** deleted `ReasoningFeed.tsx` (a hardcoded fake AI feed — "Rotating
  Saka → preserve for QF", fake timestamps/confidence/hash; it was imported nowhere) and the
  dummy `DEFAULT_XI`/`BENCH` (Bellingham/Mbappé placeholder players) from `Pitch.tsx` — pitches
  now only ever render real data (default XI is `[]`, not fake names).
- **Fixed fake stat:** the homepage "Matches left" was `static FIXTURES + 9` (an arbitrary fudge).
  Now it's the **real count of upcoming World Cup fixtures from the live feed** (30 right now).
- **Removed dead build:** stripped the unused static schedule + helpers from `lib/competitions.ts`
  (`FIXTURES` with stale fake dates, `upcomingFixtures`, `teamOf`, `competitionOf`, `TEAMS`) — all
  orphaned. Kept only the live `COMPETITIONS` data the homepage uses.
- **Trimmed the homepage** (~825px shorter): deleted the redundant `Competition` section — it was
  a SECOND leaderboard + King card (duplicating `HomeShowcase`) plus a duplicate "how it works"
  block and a third Deploy CTA. Now one live arena, one how-it-works — a single clean narrative.
  Depth (full leaderboard, King) lives on `/contest` where it belongs.
- **Sign-up model set (owner decision):** viewing/verifying is **zero sign-up**; sign-in (Privy
  email/wallet, gas-sponsored) is required only to deploy an agent (inherent — agents are owned &
  verifiable onchain). Honest hero line: "Watch live — no sign-up. Deploy in one click." No
  blanket "no sign-up" claim, since onchain ownership needs an identity.
- `tsc --noEmit` clean after all removals.

## 🏟️ Contract v2 — GafferArena (agents = tradeable NFTs + full economy)
The big architectural step (see `MASTER_BLUEPRINT.md`). New `contracts/contracts/GafferArena.sol`
written, compiles paris-safe, **7/7 tests passing**. Built as a NEW contract so the live
ManagerAI stays referenced until v2 is deployed + fully wired (no broken state mid-migration).
- **Agents are ERC-721 NFTs** with a persistent career (contestsEntered, roundsScored, totalPoints,
  totalEffective, wins, overrideCount) → tier view (Rookie→Pro→Elite→Legend).
- **Permissionless contests:** anyone calls `createContest(name, fee, start, end, isPrivate, brief)`
  — user-created private paid contests with a custom brief, all onchain.
- **Agents enter by tokenId** (`enterContest(contestId, agentId)`, owner-checked), pay the fee,
  career accrues. Override penalty (−0.25x) is per-entry, same for everyone.
- **Marketplace:** `listAgent`/`buyAgent` — but `isTradeable` gates listing behind a real record
  (≥3 scored rounds); buying transfers the NFT **with its full record + 0G knowledge** and pays the
  seller (pull-payment). Veteran > Rookie, by price.
- **Resolve/payout** unchanged in spirit: top-3 by effective score split 60/30/10, winner gets a
  career win (even free contests build a real record).
- Toolchain: pinned OZ to 5.0.2 (5.6.1's ERC721 pulled `mcopy`/Bytes which 0G's paris EVM rejects)
  and enabled `viaIR` for the multi-field views.

## ⏳ Still to do (Phase 2 + polish)
- **GafferArena DEPLOYED** to 0G Galileo: `0xD946206A90B2E24cb410f8438D968a8081dBE08d`
  (`deployments/galileo-v2.json`). Old ManagerAI `0x42567B7FE168ff2509658Be72697e0277050306C`
  stays live until cutover. **Cutover identity decision: agent = tokenId (agentId)** replaces
  per-contest owner-address as the gaffer identity (profiles become agentId-based). Showcase will
  mint 3 "house" agents so the marketplace is demoable; real users mint their own via onboard.
- **Rewire (in progress):** frontend ABI/CONTRACT_ADDRESS, `contract.ts` reader, agent
  `populate`/`export` scripts (agentId-keyed), re-mint the R32 showcase.
- **Frontend:** onboard mints an agent NFT; career/level on the profile; "Open a contest" UI;
  the marketplace (browse/list/buy by record + level).
- **Shareable match cards** (viral loop) — AI-persona card per gaffer per round.
- **Private leagues** (invite link → private table) — the retention engine.
- **Simplicity pass** — strip any friction/clutter; simplest possible login + first-run
  understanding (owner mandate: zero hindrance to understand & play).
- **Foundation for tradeable agent NFTs** — verifiable career/win-record per agent (the value an
  agent accrues by entering & winning), which the ownership/marketplace economy builds on.
- **Submission docs** (`SUBMISSION.md`, `DEMO_SCRIPT.md`, `BUILD_PLAN.md`) still describe the OLD
  single-matchday format — to be updated to the FPL-knockout format + re-audited vs the live site
  before the final push.

## ✅ Unblocked & shipped — FPL £100m budget + pricing (task #9, was blocked)
- **Paid SportAPI7 Pro key wired** — replaced the old 5-key free rotation (which constantly 429'd and blocked this feature) with the single paid Pro key in `.env`. Verified HTTP 200 against the real WC2026 pipeline endpoints, not just a sample call.
- **FPL-realistic pricing SOURCE found + wired** — the build-log's open question ("must reflect true quality, not one noisy matchday") is solved. New `seasonRatings()` in `populate-contest.mjs` pulls `/unique-tournament/16/season/58210/top-players/overall/all` — one call returns each player's **season-average rating** (e.g. Messi 9.07 over 3 apps). Price is now driven by season quality (fallback to matchday rating only if unseen), mapped position-aware to the £4.0–£13.5 FPL band via `priceOf()`. Stars price high, squad players ~£4.5m — exactly how FPL prices sustained form.
- **Budget data flows end-to-end (no mocks):** `populate-contest.mjs` already stores `price` per player + `squadValue`/`budget`/`inTheBank` in each decision (anchored on 0G Storage + onchain). `export-leaderboard.mjs` now carries those fields into `proofs.json`, `leaderboard.json` and `gaffer-latest.json`.
- **Frontend display (FPL signature):** `Pitch.tsx` now shows each player's **£price** on the chip and a header strip with **squad value (£X/£100m)** + **money in the bank (ITB)**. Wired through all consumers — `HomeShowcase`, `ContestBoard`, `GafferProfile`, `LiveDashboard`. Logged-out visitors see a real FPL economy.
- **Quality:** `npx tsc --noEmit` clean; also fixed a pre-existing `Sliders` type error in `OnboardFlow`.

## 🔍 Competitor recon (Zerun, zerun.site + github.com/iziedking/zerun) — June 2026
- Re-verified live, not from memory. **Their arena still reads 0 across the board: 0 contests run, 0 agents, 0 answers thought on 0G, 0 tUSDC settled.** Landing page is abstract ("AI agents that think on 0G", "Enter the arena") with no live metrics, no fandom, no social hook.
- Repo: 62 commits, 0 stars / 1 fork, no releases, testnet-only; contests auto-run by house baseline agents (activity is bot-seeded, not a real community).
- **Read:** they built a polished economic casino with nobody in it. Our wedge is intact and widening — real World Cup fandom + a genuine FPL game + verifiable AI. Beating them = land the social/community loop next.

## Changes (chronological)

### Infrastructure / autonomy
- Activated the autonomous daily refresh: loaded all 7 GitHub Actions secrets via the API and triggered a run that completed green end-to-end (0G Compute → FPL scoring → 0G Storage → onchain record → Vercel redeploy). The agent now self-runs daily at 06:00 UTC.

### Pillar 1 — Proof Explorer (in progress)
- **Proof data pipeline (`agent/export-leaderboard.mjs`):** every decision now carries its onchain tx + block and 0G layer references. New `frontend/public/proofs.json` holds the full verifiable record per agent (complete XI + bench, captain, reasoning, model, 0G Storage root, onchain tx/block, contract). Powers clickable agent profiles + live verification. Verified locally against contest #9 (Matchday 3): 3 agents, real roots + txs.
- **Live verification backend (`frontend/app/api/verify/[hash]/route.ts`):** on-demand proof of any decision across all 4 0G layers, nothing mocked —
  - STORAGE: re-fetches the decision live from 0G Storage by content-addressed root (`indexer-storage-testnet-turbo.0g.ai/file?root=…`), measures bytes + sha256.
  - CHAIN: pulls the exact anchoring tx receipt, decodes the PointsRecorded log, confirms the same root was recorded onchain (age-proof, O(1)); independently reads the manager's onchain points × multiplier → effective score.
  - COMPUTE: surfaces the 0G Compute model from the stored artifact.
  - DA: payload available behind the onchain anchor.
  - Verified live: Storage ✓ (2143 bytes), Chain ✓ (block 40885457), 85 pts × 2.75x = 233 eff, model qwen/qwen2.5-omni-7b.
- Discovered the 0G Storage indexer serves files directly over HTTP by root hash — lets the verify route do a real live re-fetch with no heavy SDK in the Next app.
- **ProofReceipt widget (`components/proof/ProofReceipt.tsx`):** the "Verify on 0G" button — calls the live route and reveals each of the 4 layers turning green with real data (bytes + sha256, anchoring tx + block, model, DA) plus the onchain points × multiplier = effective scoreline. Reused on agent profiles.

### Pillar 2 — Agent profiles / click-through (FPL-grade, logged-out)
- **Public agent profile (`/gaffer/[address]` + `components/gaffer/GafferProfile.tsx`):** click any gaffer to see its full FPL-style matchday scorecard — the field with every player's actual returned points, captain armband (doubled), bench, the AI's "team talk" reasoning, top returners, league rank, matchday points, autonomy multiplier, effective score, and the live ProofReceipt. No login required.
- **Click-through wired:** homepage competition card → `/contest` → contest table (`ContestBoard` rows now clickable) → `/gaffer/[address]`. Leader's XI panel links to the champion's full scorecard.

### Pillar 3 — Homepage (kept the hero photo; additive, professional)
- **HomeShowcase section (`components/landing/HomeShowcase.tsx`)** added right under the stats strip: the champion AI's live field + the full clickable agents table (rank, formation, captain, points, multiplier, effective score). Logged-out visitors see real AI football immediately. Hero photo, headline, all links and the Deploy CTA left exactly in place.
- Replaced the **fake hardcoded terminal** in the "Verify anything" section with an honest 4-layer proof summary + a real "Verify a live gaffer" CTA.
- World Cup competition card is now clickable through to the contest.
- Smoke-tested: `/`, `/contest`, `/gaffer/[address]` all 200, no errors.

### Fixes during review
- **Stale-data bug ("manager not in contest"):** the autonomous workflow had advanced the showcase to contest #11, but local proof data was still #9, so clicking a manager 404'd. Fixed by making `export-leaderboard.mjs` **auto-detect the latest fully-populated contest** from chain (highest id whose participants all recorded a decision) and rewrite `featured.json` to match — so the proof data can never drift from the contest list again. Also derives the match labels from the contest's real decisions instead of a static file.
- Decision-less entrants (e.g., Open Trials managers who haven't picked yet) are now **non-clickable** in the table ("no pick yet") so they never lead to a dead profile.
- Added `proofs.json` to the daily workflow's commit so production stays in sync.
- Re-verified on contest #11: live verify storage ✓ + chain ✓ (282 eff), all pages 200.

### Pitch — FPL-style coloured kits
- Players now render as **football kits coloured by nation** instead of a flag in a grey circle. Each kit has a primary/secondary colour, a nation-flag badge, and the captain armband; bench cards get a nation-coloured edge. Applies everywhere the pitch is used (homepage, profiles, contest, dashboard).
- Colour source is layered: **live SofaScore `teamColors` when available → canonical national-team colour map → default.** Confirmed the API exposes `teamColors` on `homeTeam`/`awayTeam` (we already fetch those objects); the agent (`populate-contest.mjs`) now captures it into each player so exact API colours flow through on the next populated contest. (API keys were 429-rate-limited at build time, so the canonical map is rendering now; both paths are wired.)
- Files: new `lib/teamColors.ts` (`kitFor`, `inkOn`), updated `components/pitch/Pitch.tsx` (Jersey), bench nation passed through in all four pitch consumers.

### Pillar 4 — Magic onboarding (the "watch it come alive" moment)
- **Live first-XI preview that reacts to the strategy sliders** in real time. New `lib/onboardPreview.ts` builds a pool from the real current showcase players and picks a preview XI weighted by the sliders (attack → formation, form → form-vs-reputation weight, risk → differential jitter). As you tune the brain, the team and formation visibly change on a real pitch (kits + all). No inference cost; the deployed agent makes the real pick on 0G Compute.
- **Emerging personality:** `personaFor()` derives an archetype + tagline from the sliders (The Cavalier, The Catenaccio, The Differential King, The Form Hunter, The Tactician…), shown live in the Strategy step, on the review, and on the success screen.
- **Career-start framing on deploy:** "{Persona} · Rookie · Season 1 — its brain is committed to 0G; from here it picks, scores and builds a verifiable career. The longer you trust it, the more it's worth." Seeds the progression/reputation vision.
- Persona is now part of the committed brain config (anchored on 0G).
- `/onboard` compiles + renders 200.

### Consistency / professional auth + deploy flow
- **Unified every deploy CTA to "Deploy your gaffer"** (nav, hero, onboarding, contest pages, dashboard, footer, empty states) — was a mishmash of "Deploy", "Deploy a gaffer", "Deploy Your Manager", "Deploy gaffer".
- **Seamless sign-in:** clicking deploy while logged out opens Privy and auto-continues into the deploy once the wallet is ready (one click, button keeps the deploy label). No more jarring "Sign in to deploy" relabel.
- **Removed the unprofessional cookie-warning tooltip** from `AuthButton` (clean "Sign in" → account chip).
- Files: `Navbar.tsx`, `app/page.tsx`, `OnboardFlow.tsx` (onDeploy + pendingDeploy effect), `AuthButton.tsx`, `ContestBoard`, `ContestBrowser`, `LiveDashboard`, `MyGaffers`, `Competition`, `Footer`, `contest/[id]`, `onboard`, `developers`.

### Progression / "agents get better over time" — design direction (for the form)
> Experience = a verifiable career on 0G Storage + Chain (every decision + outcome, win rate, autonomy streak — can't be faked). Brain that learns = strategy + growing memory on 0G Storage, with the agent's own past results fed back into the 0G Compute prompt. Reputation = a tier (Rookie→Pro→Elite→Legend) derived from the onchain record. Value = ownership of a proven onchain entity (a veteran with a strong record is worth more). Foundations (per-decision verifiable record) are built; onboarding now seeds the persona + career start; full leveling/training/market loop is the roadmap.

---

## Round 2 — The agent economy: GafferArena v2 (agents that earn their way to tradeable NFTs)

This is the structural leap from "scored entries" to **owned, tradeable AI managers with verifiable careers** — the thing that makes people come back and that no competitor has.

### The lifecycle (create → earn → mint-to-NFT → trade)
A gaffer is **not** an NFT at birth. It's born a non-transferable **record**; it earns its way up by playing.
1. **createAgent()** — a gaffer is created as a record (config anchored on 0G). Not yet an NFT, cannot be transferred.
2. It enters contests and is **scored each round** on 0G-verifiable AI decisions, building a career (rounds scored, points, wins, autonomy streak).
3. Once it crosses the **experience threshold** (3 scored rounds) it becomes **eligible**, and the owner can **mintAgent()** to turn it into a real ERC-721 NFT — now tradeable.
4. **Sold inside AND outside our interface.** In-app: `listAgent`/`buyAgent` (pull-payment, full career transfers to the buyer). Outside: it's a standard OpenZeppelin ERC-721, so any ERC-721 marketplace/wallet can trade it. `tokenURI` serves rich metadata (name + career attributes + a generated SVG trading card) so it displays anywhere.
- **Trust rule enforced everywhere:** the experience gate isn't just in our UI — a raw external transfer of an un-earned agent is blocked at the token level. You can only ever sell a proven veteran. (User decision: enforce gate everywhere + add tokenURI; mint only at threshold.)

### Contract — `contracts/contracts/GafferArena.sol` (ERC-721 "Gaffer"/GAFFER)
- `createAgent`, `mintAgent(agentId)` (eligibility-gated), `agentOwner` (record owner pre-mint / ERC-721 owner post-mint), `isEligible`, `level` (Rookie/Pro/Elite/Legend).
- **Permissionless contests:** anyone can `createContest(name, entryFee, startTime, endTime, isPrivate, brief)` — public showcases or **private paid contests** with a custom brief; same override penalty applies.
- `enterContest(contestId, agentId)` (owner-checked, payable), `recordPoints`/`recordOverride` (RESOLVER_ROLE), autonomy multiplier 3.00x→1.00x (−0.25x/override), effective = points × multiplier.
- `resolveContest` pays top-3 (70/30/10 incl. remainder) via pull-payment to the agent's owner; `claim()`.
- Marketplace: `listAgent`/`unlistAgent`/`buyAgent` (NFTs only), listing auto-cleared on transfer.
- `tokenURI` + `setBaseURI` → external metadata; `getAgent` returns the full verifiable career.
- evmVersion **paris** (0G-safe), `viaIR`, OZ 5.0.2. **Tests: 7/7 passing** (`test/GafferArena.test.ts`) covering the full lifecycle, gate, payout, and resale.
- Deployed to 0G Galileo: **`0xc9Ee85F2b3D2e905a5Ea32718d11410843d0b309`**.

### Identity cutover — agent = tokenId (replaces per-contest owner-address)
- Frontend rewired to v2: `lib/chain.ts` (address), `lib/abi.ts` (v2 ABI), `lib/server/contract.ts` (11-field contest, agentId participants, `getEntry`/`getAgent`, owned-agents + marketplace readers).
- Profiles route by **agentId** (`/gaffer/[id]`); HomeShowcase, ContestBoard, VerifyExplorer, contest detail, MyGaffers all key by agentId and surface the career (tier/rounds/wins, NFT vs record, listed price).
- **Onboard deploy** = `createAgent` → read the AgentCreated event → `enterContest(contestId, agentId)` from the user's own wallet; success screen links to the new agent's profile.
- Verify route + Proof Explorer read the v2 `PointsRecorded(contestId, agentId, …)` and `getEntry`.
- Agent scripts rewired: `populate-contest.mjs` (house agents now `createAgent` records), `export-leaderboard.mjs` (agentId-keyed + career block).
- **Verified end-to-end on the new contract:** `/api/contests` returns the R32 showcase (decode OK), `/gaffer/2` + `/contest/1` render 200, profile shows "Agent #2 · owner 0x… · Rookie", NFT metadata + SVG card serve live.

### NFT metadata (external display) — `app/api/nft/[id]` + `app/api/nft/[id]/image`
- ERC-721 metadata JSON (name from the 0G proofs manifest, description, attributes from chain) + a self-contained **SVG trading card** (tier-coloured, name, rounds/wins/career-eff, status). This is what shows on any external marketplace.

### Marketplace, veteran careers, owner actions & user-created contests
- **Real veteran agents (`agent/build-veterans.mjs`):** 3 house agents each played the THREE World Cup group-stage matchdays that were actually played (rounds 1–3, real fixtures, real results, real 0G Compute picks, same FPL engine). After 3 scored rounds they cleared the threshold and were **minted into Pro NFTs**; 2 are listed on the market. Verified onchain: agents #4/#5/#6 `minted=true`, `ownerOf` resolves, listings 0.6/0.9 OG. Their proving-ground contest is **private**, so the public homepage stays on the live Round of 32 (export + contest list now skip private contests).
- **Marketplace (`/market`):** browse listed veterans (tier, rounds, wins, career points, price) and **buy onchain** (`buyAgent`) — career + ownership transfer to the buyer. Reads live listings from chain, names from the manifests.
- **Profile career strip + owner actions (`GafferCareer`):** every profile shows the verifiable career (tier, rounds, wins, career points) + status (Record → Eligible → NFT → Listed). The owner gets inline **Mint as NFT / List for sale / Unlist** actions, gated by the same eligibility rule.
- **My Gaffers** is now the owner's **stable of agent assets** (career, NFT vs record, listed price) — links to each agent.
- **Open a contest (`/contest/new`):** anyone can create a **public or private** contest with an entry fee, window, and a **custom brief** — private ones return an invite link. Same autonomy/override penalty applies. Entry point added to the contest list.
- **NFT card image** (`/api/nft/[id]/image`): tier-coloured SVG trading card so agents look right on any external marketplace.
- Identity-cutover follow-through: career metrics display **career points** (the real accumulated total) rather than effective score, which is only tallied at contest resolution.
- Typecheck clean across all of the above; contract reads (`/api/nft`, `/api/contests`) verified 200 on the new contract `0xc9Ee85F2b3D2e905a5Ea32718d11410843d0b309`.

> Local-dev note: this Windows box hits a Turbopack PostCSS worker-spawn panic (`0xc0000142`) on cold builds after the `.next` cache is cleared (disk is fine — 108 GB free). It's an environment issue, not a code one — API routes serve 200, typecheck is clean, and pages rendered correctly before the cache was cleared. Production (Vercel/Linux) is unaffected.

---

## Identity & visual system — the Gaffer-bot (every agent a character, never a blank)

- **Gaffer-bot** (`components/brand/GafferBot.tsx`): a generative robot **football manager**, unique per agent — friendly glowing eyes, **flat cap**, coach **headset**, **club scarf + touchline coat** in the agent's own colours. Deliberately a *football gaffer*, not a generic AI bot (so it doesn't read like a Zerun clone). Pure SVG → infinite, deterministic, NFT-ready. Seeded by **name** so the deploy preview matches the deployed bot exactly.
- **Identity system** (`lib/agentIdentity.ts`): per-agent palette, **archetype + tagline** ("The Cavalier / The Alchemist / The Wall…"), tier ring (Rookie→Legend). Curated reputations for the house + veteran gaffers, deterministic fallback for everyone else.
- **Collectible card** (`components/brand/GafferCard.tsx`): the NFT-grade representation — the bot on a seeded **aura + particle + pitch-motif** backdrop, **tier frame** with corner accents, holo sheen on Elite/Legend, name + archetype + record.
- **Rolled out everywhere**: homepage **"Own a proven gaffer" marketplace strip** (`HomeMarket`), profiles (bot avatar in header), `/market` cards, **My Gaffers** cards, leaderboard row avatars (home + contest board), the **Live** page leader avatar, the **onboard naming step** (live bot that changes as you type) and the **deploy success screen**, and the external **NFT image** (`/api/nft/[id]/image`, self-contained SVG so it shows on any marketplace).

## UX fixes (from live testing)
- **Live page** reframed: "🟢 Live arena · current leader" with the bot avatar, crown, and a **"See all gaffers →"** link — no longer looks like a single mystery gaffer.
- **Onboard preview** relabeled "Sample XI · preview only / not live yet — your gaffer makes its own real pick on 0G once deployed" (was misleadingly "live preview").
- **Homepage** trimmed (removed the "PL/CL — coming soon" filler section); the empty **"0.00 OG prize pool"** stat replaced with **"Tradeable Gaffers"** (veteran-NFT count).
- Sign-in works; it only needs the local/prod origin added to **Privy → Allowed origins** to open.

## Deploy → profile, end-to-end (a user-deployed gaffer is now first-class)
- **Brain committed onchain, recoverable.** Onboard now commits a compact brain config (`{name, persona, philosophy, sliders}`) in the agent's onchain config field, so its **name + persona are always retrievable** on its profile and the marketplace. (npm could not add the 0G storage SDK to the frontend — a resolver bug — so we use the inline commitment; decision-level proofs still anchor to 0G Storage each matchday when the agent actually plays.)
- **`/api/agent/[id]`**: live agent info from chain + brain (handles both inline configs and 0G-root configs via the storage gateway).
- **`PendingGafferProfile`**: a freshly-deployed gaffer (not yet scored) now shows a proper profile — its **bot, name, persona, tier and career** + a "waiting for its first matchday" state — instead of "Gaffer not found".
- **My Gaffers** resolves each agent's **real name** (not the wallet address / "Agent #id").
- **Deploy success screen** shows the actual **gaffer-bot** + "Brain committed · {persona}".

## Personal dashboard + CLI (parity with the new contract)
- **Personal dashboard made discoverable.** `/dashboard` already renders **My Gaffers** (the owner's stable of agent cards) when signed in; now it's reachable from the **account dropdown → "My Gaffers"** and from the **deploy success screen**, so a deployer always has a home for their agents.
- **`gaffer` CLI updated to GafferArena v2** (`agent/gaffer.mjs`): reads `galileo-v2.json`, `createAgent` → `enterContest(contestId, agentId)`, scores + overrides by **agentId**, `status` reads `getEntry` + `getAgent` (tier/rounds/wins). A terminal gaffer competes in the same arena as the web app, with the same autonomy/override penalty — and its brain is committed to 0G.
- Onboard naming step shows the **live gaffer-bot** (changes as you type; removed the redundant crest-colour picker). Deploy now commits a recoverable brain so the agent's **real name** shows on its profile, My Gaffers and the marketplace.

## Fixes from live round-of-32 testing (names, dashboard IA, stability)
- **Real names everywhere on the contest leaderboard.** Entrants not in the showcase manifest (user-deployed gaffers) are resolved from chain via `/api/agent/[id]`, so they show their **name + gaffer-bot** (e.g. "zach"), not a wallet address. Every row is now clickable to its profile.
- **Personal dashboard is now a clear top-nav item — "My Gaffers"** (was hidden under "Live"). Signed-out, `/dashboard` shows a proper **"Sign in to see your gaffers"** prompt instead of silently showing the public live view (the source of the "My Gaffers leads to Live" confusion).
- **Profile never hangs / never 404s post-deploy** (6s manifest timeout + chain-read retry).
- Note: a deployer's session not persisting on `localhost` is a **Privy allowed-origins** setting (add the origin), not a code bug — once set, `/dashboard` shows the owner's stable.

## End-to-end for EVERY gaffer (not just house agents)
The professional flow — a gaffer **picks its XI when it enters**, points **fill in as the round concludes** — now works for **anyone who deploys**, not only the showcase agents.
- **`agent/score-entrants.mjs`**: for the active contest, every entrant that hasn't picked yet has its **own AI pick its XI on 0G Compute** (using the strategy it was deployed with — read from its onchain brain), stored on 0G Storage, scored on the real finished games, and recorded onchain. House agents already scored are skipped.
- **Wired into the autonomous matchday action** (`.github/workflows/refresh.yml`): `populate → score-entrants → export`, so deploy → pick → score is hands-off going forward.
- Verified live: user-deployed **"zach" (#8)** picked a 4-4-2 (captain Mbappé) on 0G Compute, scored 4 pts, and now sits **2nd** on the Round-of-32 leaderboard with its full XI + 0G proof — read from chain, not a placeholder.

## Truly autonomous, cross-round (R32 → R16 → … → Final)
The gaffer is a season-long autonomous manager, not a one-round pick.
- **Per-round re-pick (the transfer).** `score-entrants.mjs` now skips only if an agent already picked **for the current round (matchId)** — so when the Round of 16 begins, every entered gaffer **re-picks its own XI on 0G Compute from the new survivor pool**, automatically. The engine already auto-detects the active round + rebuilds the survivor pool, and the **max-per-nation cap relaxes as teams are eliminated** (R32–QF: 3, SF: 4, Final: 8) — exactly the knockout model.
- **One persistent contest spans the whole tournament.** The recurring matchday action no longer runs `populate` (which created a new contest each run and would orphan user agents); it runs **`score-entrants → export`** only. Every agent stays entered R32→Final in the same contest; **career (rounds, points) accumulates per agent** across rounds. `populate-contest.mjs` is now a one-time seed (contest + house gaffers).
- **`watch-entrants.mjs`**: an efficient local watcher that auto-picks a brand-new deploy within ~45s (only fires the heavy 0G-Compute pick when a new entrant actually appears) — so deploy → pick is hands-off without waiting for the daily action.
- Honest scope: the R16 reshuffle can't be shown live until the real R16 games are played, but the mechanism is complete and fires on its own when they are.

## Knockout transfers + veterans that play smarter
Two pieces that make it a season-long manager game, not a per-round picker (`agent/score-entrants.mjs`):
- **Transfers, not wholesale re-picks.** When a new round starts, a gaffer **keeps every player whose nation advanced** and the AI replaces **only** the players whose nation was knocked out (same position, from the survivor pool, within £100m + the per-nation cap). If everyone survived, the squad is held. Each decision records the exact `transfers` (out→in) on 0G. A full re-pick is the fallback if a gaffer has no prior team. (`transferXI`)
- **Veterans pick with memory.** Each gaffer's onchain record (tier, rounds, wins) **and its last round's result** (who it captained, who returned) are fed into its 0G Compute system prompt — so an Elite/Legend gaffer chooses with experience a Rookie doesn't have. (`historyLine` → into `pickXI`/`transferXI`.) This is what makes the tiers mean something on the pitch, and why buying a veteran is buying a smarter manager.
- Honest scope: both fire automatically at the Round of 16 (and each round after); they can't be shown live until those games are played. Safe fallbacks mean a failed transfer never crashes a matchday — it degrades to a clean full pick.
