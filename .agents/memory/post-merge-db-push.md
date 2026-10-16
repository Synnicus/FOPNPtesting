---
name: Post-merge database push
description: Timeout requirement for the workspace post-merge setup sequence.
---

The post-merge script installs workspace dependencies before running Drizzle's schema push. A 20-second timeout can terminate the database check even when there are no schema changes; the configured two-minute timeout lets the sequence complete.

**Why:** Dependency installation took nearly 16 seconds, leaving too little time for the database schema pull under the previous limit.

**How to apply:** Keep enough timeout for both installation and schema inspection when changing the post-merge setup sequence.
