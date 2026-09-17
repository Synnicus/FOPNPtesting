---
name: Fallout PnP v4 schema & conventions
description: Storage/data conventions in the combat calculator app
---

- Storage key `@fallout_pnp_v4`; new Character fields must stay optional for backward compat.
- Tagged skills: +20 is NOT baked into `char.skills`; added at combat/display time.
- Weapon condition: `WeaponAmmoState.conditionBoxes` counts FILLED boxes 0–10 (manual: −10% to hit at 8–9, jammed at 10). Helpers in `data/condition.ts`. Legacy saves (0–5 "remaining") are migrated once on load via `conditionSemanticsV2` flag in AppState — never remove that migration.
- Per-weapon AP costs: `Weapon.apSingle/apTargeted/apBurst` (null = mode unavailable, e.g. thrown explosives can't be targeted); fallback to AP_COSTS constants.
- Break the Rules uses optional `Character.breakTheRulesPending`; legacy owners with no flag normalize to pending because the perk had no effect before the flag existed.
- Crits/injuries source of truth: `data/criticals.ts` (Luck-based crit chance, targeted bonuses/effects, 1d10 table — display as "Critical Hits", never "Sample") and `data/injuries.ts` (`computeInjuryEffects`).
- ~207 built-in weapons in `data/weapons.ts`, categories incl. 'natural'; built-in ids must remain stable (saved characters reference them).

**Why:** user demands strict fidelity to the Fallout PnP 2.0 manual and existing saves must keep loading.

Hands model: `leftHandWeaponId`/`rightHandWeaponId` are the truth for held weapons; `equippedWeaponId` = ACTIVE weapon (must be one of the held ones). Absent hands fall back to "equipped in right hand". Invariants enforced in `equipWeapon`: a 2H weapon fills both slots; a 1H weapon never occupies both slots (placing 1H clears the other hand if it holds a 2H or the same id). `setActiveWeapon` switches equipped between held weapons without touching hands. Dual-wield UI (offhand swap, per-gun reload chooser, offhand AP button) derives from left≠right.

Shield weapon mods (house rule, data/mods.ts shield_t1..t4): mod fields acBonus/shieldDt/shieldDr aggregate via computeModEffects into acBonus + shieldProtection (Armor-like dtNormal/drNormal shape); applied at combat time only (defender AC + combinedProtectionFor's optional shield param), never baked into stored armorClass.

Poison delivered by weapon mods, natural attacks, or structured poison ammunition creates a persistent `kind: other` ActiveEffect on a committed hit, including zero-damage hits. The effect is flavor-only and must not provide combat modifiers.

**Why:** Most manual poisons resolve over hours; the app should track exposure visibly without automating delayed damage or penalties during combat.

**How to apply:** Show poison alongside other effects on the Characters tab, include its type/source/manual description, and let users toggle or remove it like other ActiveEffects.
