# Native radiation regression

Use a connected Android device/emulator or iOS simulator with a **launchable native build** of this app installed. Run the app's Metro server if using a development build. This test cannot run in a browser or in a Node test runner. Install Maestro and check that `maestro --version` and `adb devices` (Android) or the iOS simulator are available before running.

From the repository root:

```sh
pnpm --filter @workspace/fallout-pnp run test:native:radiation
```

For iOS, use the same command with a booted iOS simulator; both native builds use `com.falloutpnpcalculator.app`. This flow creates one test character in the **current campaign** and does not delete existing characters or clear app data. Use a disposable campaign/device if that matters. A unique `TEST_NAME` ensures it reopens the character it just created even when other characters exist.

The test asserts NO adds the full 100, YES adds 80 at 20% resistance, subtraction bypasses the prompt and clamps at zero, and 90 radiation remains after a cold app restart (including AsyncStorage reload). A failure must fail the native test command; a successful source-level test alone does not count as a native pass.

# Native Karma history regression

Run the Karma editor flow against an installed, launchable Android or iOS build using:

```sh
pnpm --filter @workspace/fallout-pnp run test:native:karma
```

The flow creates a uniquely named character without clearing campaign data. It checks that invalid and zero changes do not create entries, positive and negative reasons remain in order, a capped change stores only its applied amount, the Karma title follows a level change without changing the character name, and all saved entries survive a cold app restart. This must run on a native device or simulator; rule tests and web preview checks are not equivalent.

# Native combatant picker regression

Run against an installed, launchable Android or iOS build using:

```sh
pnpm --filter @workspace/fallout-pnp run test:native:combatant-cards
```

This flow opens the attacker and defender pickers from their combat cards. It does not require characters to exist and does not modify saved data.

# Native manual catalog navigation regression

Run against an installed, launchable Android or iOS build using:

```sh
pnpm --filter @workspace/fallout-pnp run test:native:manual-catalog
```

The flow adds a uniquely named character to the current campaign without clearing existing data. It opens the Mines & Traps Equipment category and a named Deathclaw Bestiary search from the Campaign manual reference, then returns to Campaign after each route and confirms the character remains present. Use a disposable campaign/device if you do not want to retain the test character. This check must run on a native device or simulator; source-level tests and browser previews are not equivalent.
