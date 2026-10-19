---
name: Expo web font-loading fallback
description: Diagnosing blank browser previews caused by waiting for fonts before rendering.
---

Keep Expo web preview rendering while local fonts resolve. Native splash screens can still wait for fonts, but a browser-only font delay should not return a blank app.

**Why:** The Replit browser preview showed a blank screen with no runtime error while the Expo root layout returned `null` waiting on `useFonts`; Metro was healthy. Rendering with fallback fonts on web restored the preview.

**How to apply:** If an Expo web preview is blank with clean Metro and browser logs, check font-loading gates before assuming the route or server is broken.
