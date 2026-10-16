---
name: Fallout PnP Vault Radio
description: User's soundtrack source and storage choice for music playback.
---

The user describes the supplied 1920s recordings as free to use and intends them to serve as the app's score. They chose App Storage with local caching on first play rather than bundling the collection into the mobile app.

The tracks belong in App Storage's public `vault-radio/` folder, not the private `objects/` directory, so every app instance can discover and stream them.
The user confirmed playback started after moving the folder to public storage.

**Why:** The supplied collection is about 49 MiB; the user accepted external storage and first-play caching to keep the app bundle smaller while supporting repeat listening.

**How to apply:** Keep future soundtrack additions in the public `vault-radio/` folder, separate from system and combat effects, and do not package the large recordings in the native app.
