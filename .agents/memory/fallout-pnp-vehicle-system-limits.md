---
name: Vehicle system limitations
description: Manual-derived behavior and the movement-state simplification for disabled vehicle systems.
---

Apply the manual's per-system consequences when a vehicle system becomes inoperative: engine failure halts the vehicle, controls prevent steering/speed control, drive failure prevents acceleration but permits coasting, tread failure stops the vehicle, and tire failure requires an immediate Pilot check and reduces top speed to 25%. Structural failure remains descriptive.

**Why:** Vehicle profiles track a moving/stopped flag but do not store velocity or passenger crash state. Engine and tread failures therefore set movement to stopped immediately; drive failure preserves an existing moving state while zeroing acceleration.

**How to apply:** Keep combat movement controls, resolved performance, hit modifiers, and the character vehicle panel consistent with these rules. Any later velocity or crash-resolution model should replace the current immediate-stop simplification without changing the manual consequences.
