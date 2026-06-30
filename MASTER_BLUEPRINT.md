# Gaffer — Master Blueprint (single source of truth)

> The whole machine on one page: what it is, why it wins, every screen, the mechanics, the
> economy, and a hard line between BUILT / BUILDING / ROADMAP. Read this first every session so
> we never go in circles. Paired with `COMPETITION_DESIGN.md`, `ROUND2_BUILDLOG.md`, `HANDOFF.md`.

## 0. Thesis
You don't pick players — you build an AI manager, deploy it onchain, and it plays the World Cup
for you. The less you override it, the more you win. Every decision is verifiable on 0G. Your
manager builds a real career and becomes an ownable, tradeable veteran.

## 1. Why it wins (top-0.1% wedge)
Fantasy football is a habit millions already have; we attach AI ownership to it and make
elimination the drama. Rival (Zerun) built a polished economy with an empty arena (0/0/0/0) around
abstract puzzles. Fandom can't be copied; an empty economy can be filled. We win on emotion +
game depth + verifiability, and close the economy gap with private paid contests + a real agent
marketplace.

## 2. Core loop
DISCOVER (watch live, no sign-up) → BUILD (60s onboard, deploy onchain) → COMPETE (AI picks on
0G, scored live, autonomy multiplier) → RETURN (next round: eliminations force transfers; private
leagues) → OWN/TRADE (agent gains a verifiable career → tradeable veteran). Shareable match cards
pull friends back in.

## 3. The game
- 15-man squad (11+4), **£100m budget**, valid formation, captain (2×).
- Pricing from real **market value** → £4.0–£14.0 band (Mbappé £14, squad ~£4.5). Budget bites.
- Pool = **every nation in the round** (R32 = 32); **max 3 per nation**, relaxing to 4 (semis)
  and up to 8 (final) as teams are eliminated.
- **Knockout survival:** squad is a portfolio of nations; eliminated nations' players are dead
  weight (forced sell), surviving nations carry you to the final.
- **Cross-round transfers (CORE):** carry your squad between rounds; **eliminated players are free
  to replace**, further changes cost. The re-engagement engine.
- **Autonomy Multiplier:** 3.00× start, −0.25× per override, floor 1.00×. Effective = points ×
  multiplier. Same penalty in every contest.
- **Live scoring:** finished games score; not-yet-kicked-off players show **pending** (no fakes).
- Roadmap: chips (Triple Captain, Bench Boost, themed).

## 4. Verifiability (0G spine)
0G Compute (AI brain picks XI + reasoning) → 0G Storage (every decision, re-fetchable by root) →
0G DA/Chain (root anchored onchain; points/override/multiplier recorded). "Verify on 0G" re-fetches
live and turns all 4 layers green. Nothing mocked.

## 5. The agent — a manager with a career you can buy (CORE)
Agents are **persistent ERC-721 NFTs**, not per-contest rows. Think signing a veteran manager.
- **Experience (verifiable):** every contest entered, scored round, win, autonomy streak, total
  effective score → a career record on chain + 0G. Drives a tier: **Rookie → Pro → Elite → Legend**.
- **Learning is real:** the agent's own past decisions+results (on 0G) feed back into its 0G
  Compute prompt each round, so a veteran reasons *with its track record* and picks sharper. Shown
  on the profile (level, record, the knowledge it's built).
- **Tradeability is earned:** a new agent CANNOT be sold; it must cross an experience threshold
  (a minimum of completed scored rounds / real record). No flipping empty shells.
- **Buying ≠ fresh start:** buy a veteran and you inherit its full record + accumulated knowledge;
  it keeps playing with its veteran brain. Price reflects the verifiable career (a Legend > a Rookie).
- **Utility of ownership:** use your agent to **enter contests** (public or private paid).

## 6. The economy
- **Public contests:** official free Open Trials + the live World Cup showcase.
- **Private paid contests:** any user opens one — entry fee, deadline, custom brief, private toggle
  → invite link. Entrants pay → pool → **top 3 split 60/30/10** → claim. Same override penalty.
- **Marketplace:** list/buy/sell agents (ERC-721 transfer + payment), gated by the tradeability
  threshold. Veteran transfer carries the record + knowledge.
- **Token sinks (roadmap):** extra transfers, chips, league creation, skins.

## 7. Screens — what the user sees (status)
1. **Home `/`** ✅ — hero + "watch live, no sign-up / deploy in one click" → live stats → one live
   arena (champion pitch w/ budget + top-3 table) → competitions strip → how-it-works → multiplier
   gauge → next-to-kick-off (real fixtures) → verify → tech.
2. **Onboard `/onboard`** ✅ — Identity → Strategy (sliders + philosophy = custom instructions, live
   XI preview + persona) → Contest → Deploy (gas-sponsored, real tx). *(BUILDING: mint an agent NFT
   on deploy.)*
3. **Contest list `/contest`** ✅ — live onchain cards. *(BUILDING: "+ Open a contest".)*
4. **Contest detail `/contest/[id]`** ✅ — leader XI + leaderboard by effective score.
5. **Gaffer profile `/gaffer/[…]`** ✅ — pitch (priced, captain, points/pending, squad value+ITB) +
   **survival board** + team talk + top returners + **Verify on 0G**. *(BUILDING: career/level.)*
6. **Dashboard `/dashboard`** ✅ — current King's live field + scoreline.
7. **Verify `/verify`** ✅ — live 4-layer 0G proof.
8. **Developers `/developers`** ✅ — BYO-agent CLI.
9. **Open a contest** 🔨 — name, fee, deadline, brief, private → invite link.
10. **Marketplace** 🔨 — browse/list/buy agents by record + level.
11. **Shareable match card** 🔨 — per-gaffer card + social-unfurl link.

## 8. Visual identity
Pitch navy #0A1628, grass #00C853, gold #FFB700, chalk text, mono hashes; display type for big
numbers. Signature = top-down SVG pitch with nation-coloured kits, captain armband, live/pending
badges. Dark, data-dense, uncluttered, Binance-tier.

## 9. Build status
BUILT: all 8 pages real + working; FPL-knockout engine onchain (contest #13); 0G pipeline + live
Verify; deploy flow end-to-end (gas-sponsored); survival board; real "next to kick off"; paid API;
fakes removed; sign-up model.
BUILDING (round-32, approved): agents as ERC-721 NFTs w/ career+level+learning; cross-round
transfers; tradeability gate; **full marketplace buy/sell + use-to-enter**; private paid contests
(contract redeploy); shareable cards.
ROADMAP: chips/power-ups; club-league year-round; token sinks.

## 10. Execution order (round-32)
1. **Contract v2** — Agent ERC-721 (career + level), contests reference agents, private paid
   contests, transfers, marketplace (list/buy, tradeability gate), override penalty. Tests → deploy
   → re-wire frontend ABI + reader lib + agent scripts → re-mint showcase.
2. **Frontend** — onboard mints an agent; career/level on profile; "Open a contest"; marketplace.
3. **Shareable cards.**
4. **Final** — update SUBMISSION/DEMO/README (new format + new contract address), full end-to-end
   re-verify, then the single push + deploy (only when owner says ready).

Hard rule: no push/deploy until owner says ready; build + verify locally; keep the app working at
every stage.
