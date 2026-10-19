---
name: Expo workflow restarts
description: Avoid duplicate Metro servers when restarting the Fallout PnP Expo artifact.
---

When an Expo workflow restart reports that the project is already running and asks to use another port, an earlier Metro process may still own the artifact's injected port. The existing server can remain healthy while the new workflow waits at the prompt. Stopping the managed workflow may leave its pnpm/Expo child processes behind, including a child blocked at the port prompt.

**Why:** A second server on a different port can leave the managed preview attached to a stale or unmanaged process.

**How to apply:** Before retrying an Expo restart, check whether the current preview is healthy and identify the process holding the injected port. Keep the artifact workflow on its configured port; do not accept a fallback port or add a replacement workflow. If a restart is blocked, stop it, verify any remaining listener belongs to this Expo artifact, terminate only those exact child processes, confirm the port is free, then restart once.
