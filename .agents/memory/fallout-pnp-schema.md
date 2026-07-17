---
name: Fallout PnP v4 schema & conventions
description: Storage/data conventions in the combat calculator app
---

- Storage key `@fallout_pnp_v4`; new Character fields must stay optional for backward compat.
- Tagged skills: +20 is NOT baked into `char.skills`; added at combat/display time.
- Weapon condition: `WeaponAmmoState.conditionBoxes` counts FILLED boxes 0–10 (manual: −10% to hit at 8–9, jammed at 10). Helpers in `data/condition.ts`. Legacy saves (0–5 "remaining") are migrated once on load via `conditionSemanticsV2` flag in AppState — never remove that migration.
- Per-weapon AP costs: `Weapon.apSingle/apTargeted/apBurst` (null = mode unavailable, e.g. thrown explosives can't be targeted); fallback to AP_COSTS constants.
- Crits/injuries source of truth: `data/criticals.ts` (Luck-based crit chance, targeted bonuses/effects, 1d10 table — display as "Critical Hits", never "Sample") and `data/injuries.ts` (`computeInjuryEffects`).
- ~207 built-in weapons in `data/weapons.ts`, categories incl. 'natural'; built-in ids must remain stable (saved characters reference them).

**Why:** user demands strict fidelity to the Fallout PnP 2.0 manual and existing saves must keep loading.
