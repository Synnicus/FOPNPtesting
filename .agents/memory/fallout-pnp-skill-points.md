---
name: Fallout PnP skill points & XP
description: Level-up formulas used in the combat calculator app (per the manual PDF)
---

- Skill points per level: `5 + 2×INT` (`calcSkillPointsPerLevel` in data/derived.ts). Earlier builds used other formulas — the manual value is authoritative.
- Tagged skill +20 is free (NOT from the pool) and applied at compute/display time, never baked into `char.skills`.
- Unspent pool tracked as `unspentSkillPoints`; on level-down it is clamped at 0.
- XP table (manual): XP(n) = 500·n·(n−1) up to level 21 (1k, 3k, 6k … 210k), then +40,000 per level. Helpers `xpForLevel`/`levelForXP` in data/derived.ts; XP and level fields sync both directions in the character editor.
- HP per level: 3 + END/2 (+ race bonusHPPerLevel, e.g. Deathclaw +2).
- Perk cadence by race: default 1/3 levels; Super Mutant & Deathclaw 1/4; Dog 1/2 (`perksPerLevels` in data/races.ts).

**Why:** user asked for strict fidelity to the Fallout PnP 2.0 manual (attached_assets/fallout_pnp_2_0_1784196210693.pdf).
