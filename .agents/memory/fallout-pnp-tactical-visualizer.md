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

Vehicle paths can be declared on the driver's character turn or the vehicle's own turn, with no driving AP cost. Every vehicle gets a separate initiative entry after all characters; vehicle entries follow their assigned driver's initiative, with unassigned vehicles last. Ending a vehicle turn resolves only that vehicle's checked path. A moving vehicle without a path or a pending Pilot check blocks turn advancement. Vehicle entries have 0 AP and do not tick character statuses or temporary AC.

**Why:** The user selected separate vehicle initiative entries at the end of the tracker, ordered by driver initiative, superseding the earlier round-end movement choice.

**How to apply:** Keep character AP/status timing unchanged. Do not advance the round while any vehicle entry remains unacted, and preserve this ordering when syncing or loading active combat state.

Burst fire uses the manual drawing's first single hex followed by a fixed three-hex-wide corridor, not an ever-widening cone. Target the nearest combatant first and reroll only missed rounds against subsequent targets without charging ammunition or AP again.

**Why:** The user explicitly chose the diagram interpretation where the text and drawing could be read differently.

**How to apply:** Preserve the original burst direction and attack session while resolving downstream misses.
