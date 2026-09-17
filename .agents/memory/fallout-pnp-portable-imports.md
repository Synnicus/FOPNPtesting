---
name: Fallout PnP portable imports
description: Safety and portability rules for campaign bundles containing embedded character portraits.
---

Portable campaign imports must validate the complete stable campaign structure and unique IDs before writing portrait files or replacing app state. Remove every imported portrait URI first; only a validated embedded asset matched by character ID may add a portrait back.

**Why:** Device-local, blob, and remote URIs are not portable and can become dead references or unexpected network requests. Shallow validation can replace a valid campaign with structurally unusable data.

**How to apply:** Keep portrait MIME/base64 and size limits at the parse boundary, restore assets with bounded concurrency into isolated storage, and preserve legacy raw JSON compatibility separately from the versioned bundle path.