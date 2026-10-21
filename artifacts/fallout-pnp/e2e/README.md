# Native radiation regression

Use a connected Android device/emulator or iOS simulator with a **launchable native build** of this app installed. Run the app's Metro server if using a development build. These tests cannot run in a browser or in a Node test runner. Android uses application ID `com.pnpcalculator.app`; iOS uses bundle ID `com.pnpcalculator.app`.

From the repository root:

```sh
pnpm --filter @workspace/fallout-pnp run test:native:radiation
```

For iOS, use the same command with a booted iOS simulator. This flow creates one test character in the **current campaign** and does not delete existing characters or clear app data. Use a disposable campaign/device if that matters. A unique `TEST_NAME` ensures it reopens the character it just created even when other characters exist.

The test asserts NO adds the full 100, YES adds 80 at 20% resistance, subtraction bypasses the prompt and clamps at zero, and 90 radiation remains after a cold app restart (including AsyncStorage reload). A failure must fail the native test command; a successful source-level test alone does not count as a native pass.

# Native Hardcore radiation persistence regression

Run the campaign toggle persistence test on an installed native build with:

```sh
pnpm --filter @workspace/fallout-pnp run test:native:hardcore-radiation
```

The flow creates a character with 150 radiation, enables Hardcore radiation penalties, force-stops and relaunches the app, then confirms the campaign setting is still enabled and effective Strength is 4. It disables the rule, restarts again, and confirms the setting remains disabled, radiation remains 150, and effective Strength returns to 5. The rule changes the displayed/effective stat; the saved SPECIAL value must remain 5. The automated Android CI job builds and installs a release APK, clears only that test emulator's app data before the flow, and runs this Maestro test against the emulator's real AsyncStorage.

# Native Karma history regression

Run the Karma editor flow against an installed, launchable Android or iOS build using:

```sh
pnpm --filter @workspace/fallout-pnp run test:native:karma
```

The flow creates a uniquely named character without clearing campaign data. It checks that invalid and zero changes do not create entries, positive and negative reasons remain in order, a capped change stores only its applied amount, the Karma title follows a level change without changing the character name, and all saved entries survive a cold app restart. This must run on a native device or simulator; rule tests and web preview checks are not equivalent.

# Native character action confirmation regression

Run the character action flow against an installed, launchable Android or iOS build using:

```sh
pnpm --filter @workspace/fallout-pnp run test:native:character-actions
```

The flow adds three uniquely named characters and deletes only its own Beta copy. It verifies canceling and confirming healing, storage/return, copying, reordering, and deletion, then cold-restarts the app to confirm the healed and stored Alpha, surviving Alpha copy, deleted Beta copy, and Gamma-before-Beta order persist. The canceled Gamma copy, canceled storage return, and canceled reorder remain unapplied. Backstory opens without an action prompt. Use a disposable campaign because the test characters remain in the campaign after the run. This must run on a native device or simulator; the rule test covers the shared web/native modal wiring but does not replace device interaction testing.

# Native imported injury attribution regression

Run against an installed, launchable Android or iOS build using:

```sh
pnpm --filter @workspace/fallout-pnp run test:native:injury-attribution
```

The flow creates a uniquely identified portable character export, imports it through the JSON paste screen, opens the imported character's Effects tab, and checks the attacker-and-weapon cause line. The same imported character includes a source-less legacy injury, for which the cause-line test ID must not appear. It deletes only the temporary character afterward. This requires a native device or simulator; source-level formatter checks do not verify the rendered character screen.

# Native combatant picker regression

Run against an installed, launchable Android or iOS build using:

```sh
pnpm --filter @workspace/fallout-pnp run test:native:combatant-cards
```

This flow creates four uniquely named characters, chooses different attacker and defender characters, replaces each role, and clears each role while asserting the opposite card stays unchanged. It also verifies that selecting a previously used attacker does not restore an old defender after both roles are cleared. The flow removes only the four test characters before exiting. It must run against an installed native build; source checks and a browser preview do not verify native picker interaction.

# Native manual catalog navigation regression

Run against an installed, launchable Android or iOS build using:

```sh
pnpm --filter @workspace/fallout-pnp run test:native:manual-catalog
```

The flow adds a uniquely named character to the current campaign without clearing existing data. It opens the Mines & Traps Equipment category and a named Deathclaw Bestiary search from the Campaign manual reference, then returns to Campaign after each route and confirms the character remains present. Use a disposable campaign/device if you do not want to retain the test character. This check must run on a native device or simulator; source-level tests and browser previews are not equivalent.

# Native campaign options persistence regression

Run against an installed, launchable Android or iOS build using:

```sh
pnpm --filter @workspace/fallout-pnp run test:native:campaign-options
```

This test imports an older campaign fixture, changes the theme, System Sounds, and Radio independently, force-stops and relaunches the app, and checks all three choices. It then imports the older campaign again and verifies the Western theme and audio compatibility defaults. **Import replaces the active campaign**, so use a disposable campaign/device. The test must run on native; browser preview and source-level tests do not verify disk storage or app lifecycle behavior.
