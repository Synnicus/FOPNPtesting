---
name: Fallout PnP catalog image portability
description: Persistence and transfer rules for user-added bestiary and vehicle photos.
---

Treat catalog photos as user-supplied campaign data. Store validated image data inside campaign state for built-in bestiary and vehicle entries; this avoids device-local file references that break after switching devices or importing a campaign. Custom vehicle portraits can continue using the existing portable-asset flow.

**Why:** Users add images before spawning catalog entries, so the image must travel with the campaign and appear on spawned combatants. The app should not bundle official artwork.

**How to apply:** For new catalog-image features, validate MIME type and size, sanitize imported values, preserve the image through export/import, and test that spawned entries inherit it.
