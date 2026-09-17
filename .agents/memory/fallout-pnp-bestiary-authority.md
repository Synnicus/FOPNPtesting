---
name: Fallout PnP bestiary authority
description: How to preserve printed creature stats when the manual omits SPECIAL and prints two-part gas ratings.
---

Part V creature entries do not print SPECIAL attributes. Treat their printed HP, AC, AP, Sequence, CC, skills, resistances, DT/DR, and attacks as authoritative instead of reconstructing them from invented SPECIAL values.

**Why:** Odd Sequence values and variant attack chances cannot be represented faithfully by the normal character derivation path. The natural-attack dice are complete printed damage profiles, so adding character Melee Damage would also overstate them.

**How to apply:** Keep any compatibility SPECIAL internal, preserve explicit manual overrides through spawning and combat, use each attack's own hit chance, and do not add Melee Damage to spawned manual natural attacks.

Spawned NPC HP uses the printed/template max HP as its level-1 baseline. For levels above 1, add the normal Endurance-based per-level HP gain (plus applicable per-level HP perks) without replacing the printed baseline.

**Why:** Printed creature HP must remain exact at spawn, but NPCs still need max HP progression when the user levels them.

**How to apply:** Persist an optional level-1 HP baseline with manual derived stats; for legacy NPCs lacking it, capture their stored max HP as the baseline on first recalculation.

Bestiary `GR X/Y` must preserve and display both printed numbers. The first number drives the app's single gas-resistance mechanic; the second remains display-only until the app models the manual's second gas component.

**Why:** Collapsing `GR 0/50`, `100/90`, or `100/100` to one number loses source data and makes exact catalog verification impossible.

**How to apply:** Store both values on templates and spawned creatures, but only feed the first into current gas-resistance checks.