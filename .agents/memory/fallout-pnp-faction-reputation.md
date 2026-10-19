---
name: Fallout PnP faction reputation thresholds
description: Shared Fame/Infamy tier cutoffs and how old profile-based campaign data is handled.
---

Use one shared threshold set for every faction: 0, 25, 50, and 75 points, applied independently to Fame and Infamy. Combine the two resulting tiers with the existing New Vegas title matrix. The character-tab help button should explain the ranges: 0–24, 25–49, 50–74, and 75+.

Legacy campaign files may contain a faction-specific threshold profile. Accept known old profile IDs for compatibility, ignore their former values, and remove the obsolete field when normalizing saved reputation data.

**Why:** the user chose a simpler universal profile and asked for an in-tab explanation of the thresholds.

**How to apply:** do not add per-faction threshold selectors or let old profile IDs change automated titles; preserve Fame, Infamy, custom titles, and history when loading older campaigns.
