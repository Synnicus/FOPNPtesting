---
name: Fallout PnP Damage Formula
description: Damage calculation logic including DT/DR split and damage type system
---

## Damage Formula
`finalDmg = max(0, (baseDmg − DT) × (1 − DR/100))`
- DT (Damage Threshold) applied first as flat reduction
- DR (Damage Resistance) applied as percentage after DT
- Implemented in `applyProtection(rawDamage, dt, dr)` in `data/armor.ts`

## 5 Damage Types
`DamageType = 'normal' | 'laser' | 'fire' | 'plasma' | 'explosion'`
- Labels: N / L / F / P / E (exported as `DAMAGE_TYPE_LABELS` from types.ts)
- 'bio' removed in v4
- Fire: flamethrowers, venom, acid. Plasma: plasma weapons. Explosion: grenades/rockets.

## Armor Fields (per damage type)
- `dtNormal, dtLaser, dtFire, dtPlasma, dtExplosion` — flat threshold
- `drNormal, drLaser, drFire, drPlasma, drExplosion` — percentage resistance (0-90% cap)
- `acBonus` — added to character's base AC

## Field Mapping in index.tsx
```typescript
const dtFieldMap = { normal: 'dtNormal', laser: 'dtLaser', fire: 'dtFire', plasma: 'dtPlasma', explosion: 'dtExplosion' };
const drFieldMap = { normal: 'drNormal', laser: 'drLaser', fire: 'drFire', plasma: 'drPlasma', explosion: 'drExplosion' };
```

## Initiative/Round Tracker
Integrated into the combat screen (index.tsx) — no separate initiative tab.
- ROUNDS button in top right toggles the tracker panel
- `startCombat(entries)` sorts by initiative desc, sequence as tiebreaker
- `nextTurn()`: converts unspent AP → tempAC for current actor; auto-advances round when all acted
- `nextRound()`: resets all AP to max, clears tempAC

**Why:** DT-then-DR is the Fallout PnP rulebook formula. 'bio' was dropped as a damage type in v4.
