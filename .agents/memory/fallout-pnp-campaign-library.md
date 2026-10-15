---
name: Fallout PnP campaign library archives
description: Persistence rules for saved campaigns and portrait assets.
---

Store campaign-library entries as portable campaign bundles with embedded portrait assets. Native app storage can keep each record as a document-directory JSON file; browser storage should use IndexedDB for the larger bundles.

**Why:** Portrait files imported into the app are materialized in app-owned storage and may be cleaned up when they are no longer referenced by the active campaign. Raw saved URIs can therefore break after switching campaigns, and browser local storage has small capacity limits.

**How to apply:** Use the portable campaign parser/bundler when saving, exporting, and importing library entries. Restore bundled portraits into app-owned storage when loading a campaign.
