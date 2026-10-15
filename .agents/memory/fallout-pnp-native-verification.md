---
name: Fallout PnP native regression verification
description: Distinguishing device interaction results from Expo web and source-level checks
---

Native interaction checks must run against an installed Android or iOS build, not the Expo web preview. Do not report a native pass based only on type checking, source-level tests, or web screenshots.

**Why:** At the time this was recorded, the Replit workspace had neither Maestro nor an Android/iOS simulator available; those checks could not exercise native modal taps or AsyncStorage reloads.

**How to apply:** Run the native automation on a connected device or simulator with Maestro and a launchable app build, and report separately whether native execution actually happened. Recheck local device/tool availability because the environment may change.

Provider-level reload tests with in-memory AsyncStorage can verify migration wiring, context state, and save-back, but are not evidence that native storage survives closing the app.

**Why:** A real React provider exercises the JavaScript reload path, while substituting storage still bypasses the device's disk and application lifecycle.

**How to apply:** Use provider tests for focused migration regressions; keep native restart verification separate and describe the storage substitute explicitly when reporting results.
