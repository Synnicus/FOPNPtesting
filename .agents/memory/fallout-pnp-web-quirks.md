---
name: Fallout PnP RN-Web quirks & AP-charge pattern
description: React Native Web pitfalls and combat UI conventions for the Fallout PnP app
---

## Alert.alert is a silent no-op on react-native-web
Any `Alert.alert(...)` (with or without buttons) does nothing in the browser, so gates like "Empty Magazine" fail invisibly.
**Why:** RN-web never implemented Alert; caused "button does nothing" bug reports (streamlined damage, bestiary delete).
**How to apply:** use the `notify()` helper in index.tsx (`window.alert` on web) for messages, and `window.confirm` on web for confirm dialogs. Never add a new bare `Alert.alert`.

## AP is charged at selection, never at picker-open
Combat pickers (chems/ammo/weapons) must spend AP only when the user picks an option; cancelling costs nothing. Flags `ammoPickerCosted` / `weaponPickerFree` distinguish AP-costed vs free GM-override flows sharing the same modal.
**Why:** user requirement — cancel must never burn AP.

## Streamlined burst must be transactional
Gate the roll on `currentAmmo >= burstShots`, and hide the ROLL & APPLY button once `streamlinedDmgResult` is set — otherwise repeat taps apply unlimited damage (caught by review).

## Defensive perks are id-based, not regex-only
`computeDefensivePerkBonuses(char, dmgType)` handles Toughness-style structured fields plus id cases: die_hard (HP<20%), hide_of_scars (not fire), tough_hide, hit_the_deck (explosion). HP<50% perks gate on the character's actual HP.
