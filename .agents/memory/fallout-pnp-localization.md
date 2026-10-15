---
name: Fallout PnP localization
description: Scope rules for language preferences and authored content in the Fallout PnP app.
---

Keep the selected app language separate from campaign data and portable campaign exports. Switching the interface language must not translate or alter player-entered names, notes, or other authored content.

**Why:** Language is a device/interface preference, while authored campaign text belongs to the campaign and should remain exactly as its creator entered it.

**How to apply:** Persist locale in app-local storage; translate built-in interface, rules, and catalog strings at display time only.
