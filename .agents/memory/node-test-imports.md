---
name: Node test imports
description: Import path constraints for the app's direct Node TypeScript test runner.
---

Direct `node:test` runs using Node's TypeScript stripping do not resolve the app's `@/` aliases. Tests that import a module with those aliases fail before reaching assertions.

**Why:** The configured rules test command runs data tests directly in Node without the app's bundler or alias resolver.

**How to apply:** Keep pure data modules used by direct tests on relative imports, or isolate the tested logic from modules that import application aliases.

Direct Node tests also cannot import the app localization module as-is because its JSON imports omit Node's required `type: "json"` import attribute.

**Why:** The app bundler accepts the existing JSON import syntax, but Node's direct TypeScript test runner enforces ESM JSON import attributes before tests execute.

**How to apply:** Test localization data without importing that bundled module directly, or isolate the tested translation logic from its JSON-loading layer.
