---
name: Fallout PnP v4 Schema
description: Key schema decisions for the Fallout PnP mobile app — storage key, skill tracking, tagged skills, perk points
---

## Storage Key
`@fallout_pnp_v4` — bumped from v3 when DR/5-type damage/pilot skill/custom bestiary were added. Discards old v3 data on load.

## Tagged Skills
- `char.taggedSkills: SkillType[]` — array of tagged skill names
- `char.skills[skill]` = SPECIAL base + manual offset (does NOT include the tagged +20)
- Tagged +20 is added at calculation time: combat CtH, skill display in characters.tsx
- In index.tsx: `const isTaggedSkill = weapon ? (attacker?.taggedSkills ?? []).includes(weapon.skill as any) : false; const baseSkill = rawBaseSkill + (isTaggedSkill ? 20 : 0);`

## Perk Points
- 1 perk per 3 levels for humans/ghouls/robots
- 1 per 4 levels for Super Mutants (calcAvailablePerkPoints handles this)
- `calcUsedPerkPoints(char.perks)` = sum of all perk ranks

## SPECIAL Point Pool
- Default 40 total (Human: 5×7 = 35 base + 5 bonus)
- Tracked as `specialPoolTotal` state in the characters form (not stored on char)
- Warning shown if sum(SPECIAL) > pool

## Custom Bestiary
- `customBestiaryTemplates: BestiaryTemplate[]` in AppState
- `isCustom: true` distinguishes from built-in
- Actions: `addCustomBestiaryTemplate`, `removeCustomBestiaryTemplate` in AppContext

## New Fields on Character (v4)
- `sequence: number` — PER×2, computed by calcSequence()
- `radiationResistance`, `gasResistance`, `electricityResistance: number`
- Skills now include `pilot: number`
- `pilot` skill formula: `per * 2 + int * 2` (same as firstAid)

**Why:** DR/DT split required all 5 damage types and new armor fields; custom bestiary needed to be persisted.
