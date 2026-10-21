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

Provider-level reload tests with in-memory AsyncStorage can verify migration wiring, context state, and save-back, but are not evidence that native storage survives closing the app.

**Why:** A real React provider exercises the JavaScript reload path, while substituting storage still bypasses the device's disk and application lifecycle.

**How to apply:** Use provider tests for focused migration regressions; keep native restart verification separate and describe the storage substitute explicitly when reporting results.
