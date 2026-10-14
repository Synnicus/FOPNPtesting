# Native radiation regression

Use a connected Android device/emulator or iOS simulator with a **launchable native build** of this app installed. Run the app's Metro server if using a development build. This test cannot run in a browser or in a Node test runner. Install Maestro and check that `maestro --version` and `adb devices` (Android) or the iOS simulator are available before running.

From the repository root:

```sh
pnpm --filter @workspace/fallout-pnp run test:native:radiation
```

For iOS, use the same command with a booted iOS simulator; both native builds use `com.falloutpnpcalculator.app`. This flow creates one test character in the **current campaign** and does not delete existing characters or clear app data. Use a disposable campaign/device if that matters. A unique `TEST_NAME` ensures it reopens the character it just created even when other characters exist.

The test asserts NO adds the full 100, YES adds 80 at 20% resistance, subtraction bypasses the prompt and clamps at zero, and 90 radiation remains after a cold app restart (including AsyncStorage reload). A failure must fail the native test command; a successful source-level test alone does not count as a native pass.
