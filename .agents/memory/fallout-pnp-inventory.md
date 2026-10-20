---
name: Fallout PnP inventory and ammunition
description: Durable rules for carried inventory, ammunition reserve counts, weight, and NPC provisioning.
---

Reserve ammunition is always stored as individual rounds, never as boxes. Ammo weight can be entered per round or per box; box weight is divided by rounds per box to calculate carried weight.

When Automatic Inventory Tracking is enabled, preserve existing loaded magazines and give player characters zero reserve rounds by default. Provision NPCs about ten turns of ammunition per ammo-using weapon, based on that weapon's strongest legal firing mode, and do not provision the same weapon repeatedly.

**Why:** the user chose configurable per-round or per-box weight, specified empty PC reserves with loaded magazines retained, chose about ten NPC turns of reserve, and clarified that inventory quantities count individual rounds.

**How to apply:** keep reserve counts in rounds in combat, consume rounds from inventory when reloading, and use box data only for weight conversion.

Doctor's Bags are reusable and must not be consumed when used.

**Why:** the user explicitly requested that Doctor's Bags aren't consumed.

**How to apply:** under Automatic Inventory Tracking, require a carried bag but keep its quantity; do not extend this exception to medical kits or chems.
