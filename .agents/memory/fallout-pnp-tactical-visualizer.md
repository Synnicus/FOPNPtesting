---
name: Tactical combat visualizer rules
description: User-confirmed visualizer scope, burst shape and vehicle timing.
---

Build playable 2D combat and vehicle movement first. Obstacles are visual only; do not infer blocking, cover, line of sight or pathfinding from uploaded images.

**Why:** The user explicitly selected a 2D-first build and deferred automatic obstacle effects.

**How to apply:** Keep later 3D/standee rendering and automatic obstruction separate from the present rules engine.

The optional 3D board is a second renderer of the same tactical state, available on phones and web. Keep orbit, pan and zoom controls, support transparent image standees plus GLB/STL models, and retain a 2D fallback. Board-only assets must not overwrite character portraits.

**Why:** The user approved 3D on mobile and web with free camera controls, those asset formats, and fallback when needed.

**How to apply:** Do not fork combat or movement state for 3D. Keep model uploads bounded and portable with campaign data, and leave the 2D board available.

Vehicle paths are declared on the driver's own initiative turn, with no driving AP cost. After Pilot checks, all vehicles move together at round end; vehicles do not gain extra initiative turns.

**Why:** The user confirmed round-end timing from the original manual.

**How to apply:** Shared calculator round advancement must not bypass unresolved board driving checks. Crew retain their own initiative turns.

Burst fire uses the manual drawing's first single hex followed by a fixed three-hex-wide corridor, not an ever-widening cone. Target the nearest combatant first and reroll only missed rounds against subsequent targets without charging ammunition or AP again.

**Why:** The user explicitly chose the diagram interpretation where the text and drawing could be read differently.

**How to apply:** Preserve the original burst direction and attack session while resolving downstream misses.
