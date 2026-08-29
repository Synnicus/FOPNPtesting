---
name: Fallout PnP attack sessions
description: The durable rule for choosing and resolving primary versus off-hand attacks.
---

Combat resolution must use one local attack-session weapon as the authoritative source for hit chance, skill, range, strength, AP, modes, ammo, condition, damage, criticals, protection, and labels. Selecting an off-hand attack must not mutate the character's persistent active equipment.

**Why:** Persistent equipment updates are asynchronous and can charge one weapon's AP or ammo while the same attack resolves with another weapon's statistics.

**How to apply:** Any new attack rule must derive from the session weapon. Changing it must clear incompatible mode, targeting, percentile, damage, and applied-result state.