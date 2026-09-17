---
name: Fallout PnP combat round rules
description: Turn/round AP and tempAC semantics in the combat calculator app
---

Rule: unspent AP converts to tempAC when a combatant's turn ends. AP is replenished and tempAC cleared ONLY when that same combatant's next turn begins — never for everyone at round rollover.

**Why:** Resetting all combatants at round start negated the tempAC defensive bonus for everyone who hadn't acted yet in the new round (user-reported bug, fixed July 2026).

**How to apply:** Any change to `nextTurn`/`nextRound` in AppContext must keep per-combatant AP/tempAC reset at own-turn start. Both `initiativeEntries` and the mirrored `characters` state must be updated together.

Knockout (KO) lifecycle: `setKnockedOut(id, rounds)` sets `isKnockedOut`/`knockOutRoundsLeft`; a KO'd combatant gets 0 AP at their own turn START (entry AND character), and `koTick` decrements at their turn END (in nextTurn's AP→tempAC conversion, and unconditionally for the prior active char in nextRound — even if they're also first in order). Decrementing at turn start instead wakes them one turn early; forgetting the entry mirror lets their full entry AP convert to tempAC while unconscious.

Heal Fallen's underfunded branch must defer the skill roll, not merely defer applying a result chosen earlier.

**Why:** Printed manual p. 26 (PDF page 27) explicitly puts the roll at action completion. Intervening effects can change the effective skill or invalidate the unconscious target. The recipient's AP restriction is tied to the actual healing round, not the starting round.

**How to apply:** Keep start-time AP spending separate from completion-time outcome selection. Review both same-round recipient turns and round rollover when changing revival timing.

Combat-skill timing follows the requested app workflow where it is more specific than the manual: armor-only AC ends on the next own turn even for a longer GM duration, and confirmed underfunded actions spend all remaining AP without carrying AP debt.

**Why:** The accepted requirements explicitly specify next-turn defense restoration and a spend-all-remaining confirmation branch. Do not silently replace these with ongoing suppression or next-turn AP debt based on a broader reading of the manual.

**How to apply:** Preserve these semantics unless the user changes them; keep action-completion timing separate from defense-restoration timing.
