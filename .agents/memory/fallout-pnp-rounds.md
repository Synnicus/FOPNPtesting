---
name: Fallout PnP combat round rules
description: Turn/round AP and tempAC semantics in the combat calculator app
---

Rule: unspent AP converts to tempAC when a combatant's turn ends. AP is replenished and tempAC cleared ONLY when that same combatant's next turn begins — never for everyone at round rollover.

**Why:** Resetting all combatants at round start negated the tempAC defensive bonus for everyone who hadn't acted yet in the new round (user-reported bug, fixed July 2026).

**How to apply:** Any change to `nextTurn`/`nextRound` in AppContext must keep per-combatant AP/tempAC reset at own-turn start. Both `initiativeEntries` and the mirrored `characters` state must be updated together.
