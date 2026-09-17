---
name: Fallout PnP powered weapons
description: Ammunition policy for powered melee and unarmed weapons, including the non-ammunition Super Sledge.
---

Powered melee and unarmed weapons consume their defined ammunition on every attack, including misses. The Super Sledge is not ammunition-powered.

**Why:** The manual explicitly gives ammo to the Punch Gun, Power Fists, Cattle Prods, and Ripper, but does not print a Super Sledge capacity. The prior Super Sledge ammo assignment was user-corrected as a mistake.

**How to apply:** Preserve ammo compatibility for custom melee and unarmed weapons, but keep the Super Sledge at zero magazine capacity with no compatible ammo.

Every weapon with compatible ammunition must resolve and persist an equipped ammo type. Missing or invalid saved selections use the first valid compatible ammo entry, and combat math must apply that resolved round's modifiers and damage.

**Why:** Display-only defaults can show ammunition while attacks silently omit its damage dice, AC/DR adjustments, poison, or DT behavior.

**How to apply:** Normalize ammo states on load, import, character updates, and weapon equip; also resolve the default at attack time as a safety boundary.