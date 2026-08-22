---
name: Fallout PnP skill points & XP
description: Level-up formulas used in the combat calculator app (per the manual PDF)
---

- Skill points per level: `5 + 2×INT`; the manual value is authoritative.
- Tagged skill +20 is free (NOT from the pool) and applied at compute/display time, never baked into `char.skills`.
- One operation costs/refunds one point: untagged skills change by 1%; tagged skills change by 2%.
- Tags can change only when every skill is back at its current SPECIAL-derived base. Race/SPECIAL changes preserve purchased offsets and reconcile the unspent pool by the old-to-new total difference.
- Unspent pool is signed. If Intelligence, race, or level reduces the pool below points already spent, preserve the negative balance as debt; refunds pay it down before points become available.
- XP table (manual): XP(n) = 500·n·(n−1) up to level 21 (1k, 3k, 6k … 210k), then +40,000 per level. XP and level fields sync both directions.
- HP per level: 3 + END/2 (+ race bonusHPPerLevel, e.g. Deathclaw +2).
- Perk cadence by race: default 1/3 levels; Super Mutant and Deathclaw 1/4; Dog 1/2.

**Why:** Allowing retagging while purchased offsets exist revalues past operations and can create skill points on refund. Pool reconciliation prevents Intelligence or race changes from producing negative or extra points.

**How to apply:** Preserve raw purchased offsets whenever SPECIAL-derived bases move. Do not unlock retagging until all offsets are refunded to the new bases.
