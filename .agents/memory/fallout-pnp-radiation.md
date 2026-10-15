---
name: Fallout PnP Radiation
description: Durable rules for accumulated radiation, resistance, and combat application
---

Accumulated radiation is a persistent 0–1000 whole-number meter that is entirely separate from HP. Radiation sickness is an automatic, non-dismissible effect derived from the current meter stage, but it has no numeric penalties under the core PnP 2.0 rules.

A separate campaign-wide Hardcore ruleset may be enabled explicitly. It is default-off and applies penalties only to effective SPECIAL and values derived from it; it never rewrites saved SPECIAL or HP. At 1000 radiation it displays fatal/instant death rather than converting radiation to damage.

**Why:** The user wants PnP 2.0 sickness labels to remain narrative-only and clearly distinguished from optional Hardcore mechanics. Deriving sickness prevents stale state, while a separate opt-in layer avoids silently changing the base rules.

**How to apply:** Manual additions may optionally use effective resistance, including the character's racial/base resistance, resistance traits, applicable perks, active effects, and worn equipment; cap at 100%. Combat outputs are already post-resistance. Show PnP sickness stages at 200/400/600/800/1000. Apply optional penalties at 150/300/500/750/1000 only when the campaign toggle is enabled, through the shared effective-sheet resolver.