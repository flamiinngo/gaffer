# Gaffer — Competition Design (World Cup 2026 Fantasy on 0G)

> The official format for the game. Designed to be world-class FPL depth, **native to a
> knockout World Cup** (not a generic season league), fun, and built to bring players back
> every round. Paired with `ROUND2_BUILDLOG.md` (change log) and `HANDOFF.md` (architecture).

## The core insight
FPL is a static season league. **A World Cup is elimination — and elimination is the mechanic.**
Your squad is a **portfolio of nations you're betting will survive.** Back a nation that crashes
out and your stars become dead weight (forced sell). Back the dark horse that runs to the final
and you ride them to the title. That drama is unique to a World Cup and is the reason to return
every single round.

## Format (how a governing body would run it)
- **Gameweeks = World Cup rounds:** Group MD1 → MD2 → MD3 → Round of 32 → R16 → QF → SF → Final.
- **Deadline per gameweek = kickoff of the first match in that round.**
- **Scoring is cumulative across gameweeks** (FPL rules on real match stats). The group stage is
  settled (rich, real points); the current round is the **live gameweek in progress** (some games
  played, the rest pending and filling in live). Real, deep, and genuinely live — never faked.

## Squad & rules (per round)
- 15 players (11 starters + 4 bench), **£100.0m budget**, valid formation, captain (2×).
- **Selection pool = EVERY team in that round** — Round of 32 = all 32 nations' squads selectable
  up front, like a real gameweek (not just teams who've already kicked off).
- **Max 3 players per nation.** The cap relaxes by necessity as nations are eliminated:
  `maxPerNation = max(3, ceil(15 / teamsLeft))` → **3** through the quarter-finals, **4** in the
  semis (only 4 nations remain), **up to 8** in the final. A real competition has to write that
  rule, so we do.
- **Prices reappraise each round:** advancing players appreciate; eliminated players leave the
  market. Price is driven by **season-average rating** (true quality), not one noisy matchday.

## Transfers (the re-engagement engine)
- A few **free transfers between rounds**; extra transfers cost a points hit (or a 0G token sink).
- **Eliminated players are replaced FREE** — never punished for a nation getting knocked out.
- **Wildcard:** one unlimited-transfer round per knockout phase.

## Chips (scarce, dramatic, World-Cup-flavoured)
Triple Captain, Bench Boost, plus themed: *Extra Time* (bench plays if your XI thins from
eliminations), *Giant Killer* (bonus when an underdog nation's player scores). Each usable once.

## What makes it ours (vs an empty arena)
- The **AI gaffer makes every decision autonomously on 0G Compute, verifiably** — squad,
  transfers, captain, chip timing. The **autonomy multiplier** rewards trusting it (up to 3×).
- The agent **learns across rounds** (its own results feed back into the 0G Compute prompt) and
  builds a **verifiable career on 0G Storage + chain** (Rookie → Pro → Elite → Legend). An
  ownable, improving asset that outlives this World Cup.

## Retention — why they come back
1. Every round has a deadline → return to set your squad.
2. Eliminations force re-engagement → you *must* re-pick as nations die.
3. **Private leagues + H2H brackets** mirroring the real knockout bracket.
4. **Shareable match-report cards** the AI cuts in its persona (viral loop).
5. Agent progression + ownership → long-term investment beyond one tournament.

## Economy (closing the gap)
Free-to-play core; optional **staked contests with prize pools**; token sinks on extra transfers,
chips, league creation, agent skins. Out-fun on day one, match on economy over time.

## Build phases
- **Phase 1 — Engine (correctness):** full-round N-nation pool from real squads, FPL max-3 rule,
  £100m that genuinely bites, live gameweek scoring (played vs pending). *In progress.*
- **Phase 2 — Wow + retention:** knockout-survival UI (your nations alive/eliminated, who you're
  riding to the final), private leagues, shareable cards.
- **Phase 3 — Roadmap (post-submission):** chips, staked economy/token sinks, cross-round transfer
  persistence, agent marketplace.

**Scope approved for the round-32 submission: Phase 1 + Phase 2.**
