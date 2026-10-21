# Android native test: step-by-step guide

These checks run the app on a temporary Android emulator hosted by GitHub. You
do not need to install an emulator, connect your phone, or change the GitHub
connection in Replit. The emulator is created only for the test run; it is not
added to the app or this repository.

## Run the test again

1. Open [Synnicus/FOPNPtesting](https://github.com/Synnicus/FOPNPtesting) on GitHub.
2. Select **Actions** near the top of the repository page.
3. Select **Fallout PnP Android native regression** in the workflow list.
4. Select **Run workflow**.
5. Choose the branch to test:
   - Before this change is merged, choose `agent/ghoul-radiation-native`.
   - After it is merged, choose `main`.
6. Select **Run workflow** again to start it.
7. Open the new run and wait for **Ghoul and Hardcore radiation native
   regressions** to finish. A green check means the native tests passed. A red
   X means something failed; open the job to see the step and error.

The first Android run can take 20 minutes or more while it builds the app and
creates an emulator snapshot. Later runs reuse cached Gradle outputs and the
emulator snapshot, so they should start much faster. GitHub may evict old
caches, in which case a run may need to rebuild them. Keep the run page open or
come back to it later; you do not need to keep the Replit project open.

## What runs automatically

GitHub also starts this workflow when a pull request or push changes the Fallout
PnP app or its shared dependencies. After the pull request is merged, future
changes to those files run the check on `main`.

## If a run fails

Send the agent the URL of the failed GitHub Actions run. The URL is on the run
page in your browser. You do not need to disconnect or reconnect GitHub, copy
tokens, install Android Studio, or paste secret values.

The Git connection shown in Replit is separate from this test's **Run workflow**
button. Seeing the repository under Remote Updates means the repository is
linked; use GitHub's **Actions** page to start or inspect the emulator test.
