---
name: Fallout PnP effective stats
description: How SPECIAL/AP/AC bonuses from perks and chems are layered without double counting
---

**Rule:** There is one canonical layering for stats:
- `char.special` = base points only, never mutated by perks/chems.
- Permanent Gain-X perks (+1/rank) are added in `data/effects.ts computePerkStatBonuses` and baked into stored derived stats (`maxHp/maxAP/armorClass/sequence`) via `recomputeDerived`.
- Chem `statMods` are applied ONLY at display/combat time via `effectiveSpecial(char)` — NO upper cap (may exceed racial max), floor 1. Boosted stats render green (`#4a8c3f`).
- Defender AC math must subtract `storedAgi − positionalAgi(effective)` since stored armorClass already bakes in perk AGI; chem AGI can make the delta negative (AC up).

**Why:** An earlier clamp to 10 silently ate Psycho/Buffout boosts; and perk bonuses baked into stored stats will double count if also re-added at combat time.

**Per-level HP perks (Lifegiver, Brutish Hulk):** never retroactive — `CharacterPerk.takenAtLevel` is recorded when the perk is taken and only levels gained after count. Old saves without it contribute 0 until next level-up.

**Chem apMod:** applied immediately in `applyChem` (character AND initiative entry), and AP replenish uses `charMaxAP()` (base + apMod) — never raw `maxAP`.
