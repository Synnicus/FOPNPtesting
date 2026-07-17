// ─── Injury Effects — Fallout PnP 2.0 manual ("Crippled Limbs and Blindness")
// Mechanical effects, applied wherever effective stats are needed:
//  • Crippled leg: movement costs double (2 AP per hex); effective AGI halved.
//  • Two crippled legs: can only move 1 hex per round; effective AGI drops to 1.
//  • Crippled arm: −1 AGI each; cannot use two-handed weapons.
//  • Two crippled arms: cannot use any weapon at all.
//  • Blindness (eyes): Perception drops to 1 AND the character suffers total
//    darkness penalties when attacking.
//  • Injuries are treated by the Doctor skill; healed limbs/eyes need 48h rest.

import type { Character, Injury } from '@/context/types';

export interface InjuryLocationInfo {
  location: Injury['location'];
  label: string;
  /** Player-facing explanation of what a crippled injury here does. */
  effectText: string;
}

export const INJURY_LOCATION_INFO: InjuryLocationInfo[] = [
  { location: 'head', label: 'Head', effectText: 'Head criticals deal 3× damage; severe head trauma can knock the character unconscious.' },
  { location: 'eyes', label: 'Eyes', effectText: 'Blindness: Perception drops to 1 and all attacks suffer total-darkness penalties. Treatable only by a doctor.' },
  { location: 'torso', label: 'Torso', effectText: 'Torso criticals deal 2× damage. No lasting stat penalty, but the damage is real.' },
  { location: 'leftArm', label: 'Left Arm', effectText: 'Crippled arm: −1 Agility, cannot use two-handed weapons. Two crippled arms: cannot use any weapon.' },
  { location: 'rightArm', label: 'Right Arm', effectText: 'Crippled arm: −1 Agility, cannot use two-handed weapons. Two crippled arms: cannot use any weapon.' },
  { location: 'leftLeg', label: 'Left Leg', effectText: 'Crippled leg: movement costs 2 AP per hex and effective Agility is halved. Two crippled legs: 1 hex per round, Agility drops to 1.' },
  { location: 'rightLeg', label: 'Right Leg', effectText: 'Crippled leg: movement costs 2 AP per hex and effective Agility is halved. Two crippled legs: 1 hex per round, Agility drops to 1.' },
];

export interface InjuryEffectsSummary {
  effectivePerception: number;
  effectiveAgility: number;
  blind: boolean;
  crippledArms: number;
  crippledLegs: number;
  /** Multiplier on AP cost per hex of movement (1, 2) — 2 legs = special. */
  movementApMultiplier: number;
  /** True when movement is limited to 1 hex per round (both legs crippled). */
  oneHexPerRound: boolean;
  cannotUseTwoHanded: boolean;
  cannotUseWeapons: boolean;
  /** Human-readable list of active effects for display in combat/profile. */
  notes: string[];
}

function isCrippling(inj: Injury): boolean {
  return inj.isActive && (inj.severity === 'crippled' || inj.severity === 'broken');
}

/** Compute the manual's injury effects from a character's active injuries. */
export function computeInjuryEffects(
  char: Pick<Character, 'special' | 'injuries'>,
): InjuryEffectsSummary {
  const injuries = (char.injuries ?? []).filter(isCrippling);
  const blind = injuries.some((i) => i.location === 'eyes');
  const crippledArms = injuries.filter((i) => i.location === 'leftArm' || i.location === 'rightArm').length;
  const crippledLegs = injuries.filter((i) => i.location === 'leftLeg' || i.location === 'rightLeg').length;

  let agility = char.special?.agility ?? 5;
  if (crippledLegs >= 2) agility = 1;
  else if (crippledLegs === 1) agility = Math.max(1, Math.floor(agility / 2));
  agility = Math.max(1, agility - Math.min(crippledArms, 2));

  const perception = blind ? 1 : (char.special?.perception ?? 5);

  const notes: string[] = [];
  if (blind) notes.push('Blind: PE 1, attacks at total-darkness penalty');
  if (crippledLegs === 1) notes.push('Crippled leg: 2 AP/hex, AGI halved');
  if (crippledLegs >= 2) notes.push('Both legs crippled: 1 hex/round, AGI 1');
  if (crippledArms === 1) notes.push('Crippled arm: −1 AGI, no two-handed weapons');
  if (crippledArms >= 2) notes.push('Both arms crippled: cannot use weapons');

  return {
    effectivePerception: perception,
    effectiveAgility: agility,
    blind,
    crippledArms,
    crippledLegs,
    movementApMultiplier: crippledLegs === 1 ? 2 : 1,
    oneHexPerRound: crippledLegs >= 2,
    cannotUseTwoHanded: crippledArms >= 1,
    cannotUseWeapons: crippledArms >= 2,
    notes,
  };
}
