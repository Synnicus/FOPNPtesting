---
name: Fallout PnP native regression verification
description: Distinguishing device interaction results from Expo web and source-level checks
---

Native interaction checks must run against an installed Android or iOS build, not the Expo web preview. For this project, add Maestro flows to the Android emulator workflow at `.github/workflows/fallout-pnp-android-native.yml`; it builds and installs a release app on an emulator and runs the flows. Do not report a native pass until that emulator workflow succeeds. Type checking, source-level tests, and web screenshots are not native evidence.

**Why:** Replit workspaces may lack Maestro and a connected device or simulator. The Android emulator workflow used for radiation persistence provides repeatable native UI and AsyncStorage lifecycle coverage without relying on local device access.

**How to apply:** Add each Fallout PnP native UI regression to the existing Android emulator workflow and its corresponding Maestro flow. Report the actual workflow outcome and any interaction failure; if it has not run or cannot be inspected, say the native result is pending rather than passed. Keep iOS-specific behavior on an installed iOS build when the check depends on it.

Replit workspaces without `/dev/kvm` are not a reliable place to boot Android locally. TCG software emulation can leave Android's package service unavailable and cause `system_server` to time out while the Permission Controller handles first-boot runtime grants; reducing the AVD CPU count did not resolve this.

**Why:** Native app builds can succeed even while the guest OS cannot finish booting, so a successful APK build must not be mistaken for a completed device test.

**How to apply:** Keep local SDKs, AVDs, and generated Android projects in ignored scratch paths. Use the existing hosted Android emulator workflow as the standard native test environment when KVM or a physical device is unavailable.

A GitHub repository linked in the user's primary Replit Git pane may not be configured as a remote in an isolated task-fork checkout. The Git pane can show `origin/main` while the task checkout has only Replit-internal remotes.

**Why:** Task work happens in a forked copy; the user's Git link and write authorization are not necessarily inherited by that checkout.

**How to apply:** Check the task checkout's remotes separately, but do not tell the user their main Replit Git link is broken when their Git pane shows the repository. Use only write access available to the task checkout, or explain the handoff needed; public visibility grants read access, not write access.

When Expo compatibility checks require a just-published patch, pnpm's default 24-hour minimum release age can block installing that compatible version. Do not bypass the release-age protection or substitute an incompatible latest major.

**Why:** The Expo SDK may update its expected patch before pnpm considers that release old enough to install, temporarily leaving `expo install --check` failing on an otherwise valid lockfile.

**How to apply:** Keep the compatible Expo package range and lockfile unchanged until pnpm allows the version, then update and rerun validation. Report the temporary validation blocker rather than weakening the release-age guard.

Provider-level reload tests with in-memory AsyncStorage can verify migration wiring, context state, and save-back, but are not evidence that native storage survives closing the app.

**Why:** A real React provider exercises the JavaScript reload path, while substituting storage still bypasses the device's disk and application lifecycle.

**How to apply:** Use provider tests for focused migration regressions; keep native restart verification separate and describe the storage substitute explicitly when reporting results.

GitHub pull-request runs use the workflow definition from the base branch until the PR is merged. The v3 Android SDK setup action also defaults to installing the retired `tools` package, so specify only `platform-tools` and install required platform/build tools separately.

**Why:** A PR can contain a corrected workflow yet still run the older base-branch workflow, and the default SDK setup currently fails before the emulator starts.

**How to apply:** To verify a new native workflow before merge, use a feature-branch push trigger or another supported branch-specific dispatch. Keep the normal pull-request and main-branch triggers for future changes.

The Android emulator runner executes its `script:` input with `/bin/sh`, not Bash. Bash-only options such as `set -o pipefail` fail before any test commands run.

**Why:** The emulator action's shell is independent of the workflow runner's default shell, so a valid Bash command can stop the job immediately after the emulator boots.

**How to apply:** Keep emulator `script:` commands POSIX-compatible (`set -eu`) or explicitly invoke a Bash script with `bash`; do not assume `pipefail` is available.

On hosted GitHub runners, enable KVM before starting the Android emulator and cache the AVD directory if repeated native tests should boot quickly. For a snapshot cache, warm the AVD without `-no-snapshot`, then run tests with `-no-snapshot-save` and `force-avd-creation: false`.

**Why:** Without KVM the emulator can spend many minutes waiting for boot or time out, and fresh hosted runners otherwise recreate the same AVD on each run.

**How to apply:** Follow the Android emulator runner's KVM and AVD-cache setup in `.github/workflows/fallout-pnp-android-native.yml`; keep cache keys tied to the image API level, target, architecture, and device profile.
