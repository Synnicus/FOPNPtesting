---
name: Fallout PnP Vault Radio
description: Soundtrack storage, playback, and custom-label scope.
---

The user describes the supplied 1920s recordings as free to use and intends them to serve as the app's score. They chose App Storage with local caching on first play rather than bundling the collection into the mobile app.

The tracks belong in App Storage's public `vault-radio/` folder, not the private `objects/` directory, so every app instance can discover and stream them.
The user confirmed playback started after moving the folder to public storage.

**Why:** The supplied collection is about 49 MiB; the user accepted external storage and first-play caching to keep the app bundle smaller while supporting repeat listening.

**How to apply:** Keep future soundtrack additions in the public `vault-radio/` folder, separate from system and combat effects, and do not package the large recordings in the native app.

The user later requested station-specific names, descriptions, ordered song slots, and per-song title/artist metadata to be campaign data included in portable campaign JSON. Imported station slots retain filenames as references only; the audio itself is never embedded and missing files must be replaceable in the editor. The built-in Vault Radio descriptor is "Public Domain 1920's".

**Why:** The user wants campaign exports to restore the station setup across devices while avoiding audio-file duplication and leaving missing recordings to be relinked by the receiving user.

**How to apply:** Keep each station's ordered file references and editable labels in campaign state, validate them during import, and never serialize audio bytes or URLs. Preserve unavailable song slots so users can relink them without losing metadata.
