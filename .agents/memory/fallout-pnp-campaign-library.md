---
name: Fallout PnP campaign library archives
description: Persistence rules for saved campaigns, portrait assets, and map images.
---

Store campaign-library entries as portable campaign bundles with embedded portrait assets. Campaign map backgrounds and user-uploaded map-marker icons also stay embedded in their map records so standalone map exports and campaign bundles are self-contained. Native app storage can keep each record as a document-directory JSON file; browser storage should use IndexedDB for the larger bundles.

**Why:** Portrait files imported into the app are materialized in app-owned storage and may be cleaned up when they are no longer referenced by the active campaign. Raw saved URIs can therefore break after switching campaigns, and browser local storage has small capacity limits. Embedded map assets also let exported map JSON restore artwork and custom marker choices without device-specific file paths.

**How to apply:** Use the portable campaign parser/bundler when saving, exporting, and importing library entries. Restore bundled portraits into app-owned storage when loading a campaign, and preserve map artwork and marker-icon data in both campaign and standalone map JSON.
