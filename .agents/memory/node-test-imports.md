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

Relative imports from a tested TypeScript data module should include the `.ts` extension when they must run directly under Node's type stripping.

**Why:** Node's ESM resolver does not apply the extensionless resolution behavior used by the app bundler.

**How to apply:** Keep imports between directly tested data modules relative and explicit, including the `.ts` extension.

Runtime-transpiled React test harnesses must target modern JavaScript.

**Why:** TypeScript's default ES5 target turned spreads of Map iterators into empty arrays in the test harness, falsely erasing carried inventory even though the app's normal bundler handled it correctly.

**How to apply:** set an explicit ES2022-or-newer target in test `transpileModule` hooks; do not change production inventory logic to compensate for a harness-only transpilation defect.
