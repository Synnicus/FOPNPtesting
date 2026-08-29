---
name: Fallout PnP effective stats
description: How permanent and conditional Fallout PnP modifiers are layered without double counting
---

**Rule:** There is one canonical layering for stats:
- `char.special` = base points only, never mutated by perks/chems.
- Immediate trait modifiers are computed from base values, then permanent Gain-X perks are layered on.
- Night Person is applied next and bounded to racial limits; conditions and chems are last, have a floor of 1, and are not upper-capped.
- Stored derived values may include base SPECIAL, Gain-X, armor, and racial sources. Replacing a natural component must strip the complete permanent component first, then add the current effective component once.

**Why:** An earlier clamp to 10 silently ate Psycho/Buffout boosts; and perk bonuses baked into stored stats will double count if also re-added at combat time.

**Perk requirements:** use permanent immediate-trait and Gain-X SPECIAL plus rebased trait/tag skill values. Do not let temporary chems, conditions, or Night Person qualify a character.

**Why:** A temporary state should not permanently unlock advancement, while traits and permanent perks must count everywhere their values are tested.

**How to apply:** Any new sheet, combat, eligibility, or derived-stat path must consume the same layered effective values rather than reading saved bases directly or writing modifiers back into them.

**Per-level HP perks (Lifegiver, Brutish Hulk):** never retroactive — `CharacterPerk.takenAtLevel` is recorded when the perk is taken and only levels gained after count. Old saves without it contribute 0 until next level-up.

**Chem apMod:** applied immediately in `applyChem` (character AND initiative entry), and AP replenish uses `charMaxAP()` (base + apMod) — never raw `maxAP`.
