---
name: Fallout PnP area blast profiles
description: Rules for explosive ammunition, distance zones, custom blast ranges, and deployed mines or traps.
---

Expose built-in blast profiles only when every effect has a manual range; omit ammunition with no printed blast radius. Configure custom ammunition and mine/trap zones in Equipment with the Blast Radius toggle, not during combat. Assign each combatant to one saved zone and resolve every effect reaching that zone together. The triggerer starts in the closest zone. Place a mine or trap into combat only after the GM confirms its Traps check succeeded; keep non-area traps out of the general blast chooser.

Vehicle blast damage always reaches Structure and each selected additional system; EMP remains limited to an electronic system. For successful vehicle cannon shots, the direct-hit target is the impact point: apply the cannon's blast and any in-range concussion through one area resolution, not as a second direct weapon-damage application.

**Why:** The user wants only explicitly configured zones in the combat picker, authored blast settings on custom equipment, and one resolution that can damage multiple vehicle systems.

**How to apply:** Keep manual ranges authoritative for built-ins; require custom blast profiles to define every effect's radius before they appear in combat. Combat should assign targets to those saved zones, apply all in-range effects together, and preserve the Structure-plus-selected-systems vehicle rule.

Keep original built-in explosive-ammo definitions immutable when a house rule supplies missing blast zones. Expose derived copies with the rule's radius, and restore the untouched definitions when the option is disabled.

**Why:** The user explicitly wants the original profiles retained safely so toggling the house rule off can restore their prior behavior.

**How to apply:** Store canonical definitions separately from rule-derived combat profiles; never rewrite or discard the source profiles while applying or removing gameplay options.
