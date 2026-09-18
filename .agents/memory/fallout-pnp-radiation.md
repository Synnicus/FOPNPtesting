---
name: Fallout PnP Radiation
description: Durable rules for accumulated radiation, resistance, and combat application
---

Accumulated radiation is a persistent 0–1000 whole-number meter that is entirely separate from HP. Radiation sickness is an automatic, non-dismissible effect derived from the current meter stage, but it has no invented numeric penalties.

**Why:** The user wants sickness to remain active until radiation is manually lowered. Deriving it prevents stale or independently disabled sickness state, while keeping radiation separate from HP and unrelated combat mechanics.

**How to apply:** Manual additions may optionally use effective resistance. Combat outputs are already post-resistance. Show the matching sickness stage at 200/400/600/800/1000 and clear it only when the meter falls below 200.