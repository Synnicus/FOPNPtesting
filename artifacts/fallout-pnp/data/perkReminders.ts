import type { CharacterPerk } from '../context/types.ts';

/**
 * Context reminders for benefits that depend on GM judgment, travel/encounter
 * procedures, or a future hex-map workflow. They are shown on character cards,
 * not silently applied to unrelated rolls.
 */
const REMINDERS: Readonly<Record<string, string>> = {
  fear_the_reaper: 'Track elapsed days manually in Effects; check the Reaper trigger at the printed interval.',
  divine_favor: 'Once per 24 hours, a failed roll may be rerolled. Mark the use in Effects.',
  glowing_one: 'Reminder: nearby characters gain 10 radiation per hour. Use the radiation exposure action.',
  rad_child: 'Reminder: radiation-level healing is tracked separately from normal healing.',
  animal_friend: 'Animals do not attack unless threatened or attacked first.',
  bluff_master: 'If caught stealing, a speech check may let you talk your way out.',
  bonsai: 'Ghoul reminder: maintain the steady fruit supply benefit in the fiction.',
  brown_noser: 'Apply the listed reaction bonus when dealing with authority figures.',
  cautious_nature: 'Apply the Perception bonus when determining starting positions.',
  crazy_bomber: 'On a failed explosives setup, use the perk’s detect/reset procedure.',
  cult_of_personality: 'Reverse the normal karma direction when judging NPC reactions.',
  empathy: 'GM reminder: flag dialogue choices likely to be interpreted badly.',
  explorer: 'Check for the perk’s special encounters and unusual finds during exploration.',
  fortune_finder: 'Apply the extra-money result when a random encounter awards money.',
  karma_beacon: 'Double karma-based reaction effects when resolving NPC reactions.',
  mysterious_stranger: 'At random encounters, check the perk’s temporary-ally chance.',
  presence: 'Add the perk’s Charisma reaction bonus when NPC reactions are resolved.',
  ranger: 'Add +15 Outdoorsman and check for the perk’s special encounter benefit.',
  scout: 'Use the improved sighting distance and easier map/special-encounter procedure.',
  scrounger: 'Double ammunition found from random-encounter results.',
  smooth_talker: 'Add +1 effective Intelligence per rank on stat rolls to smooth-talk NPCs.',
  team_player: 'When all allies are within 10 hexes, apply +10 to all skills.',
  treasure_hunter: 'Check for improved loot quality when resolving eligible finds.',
  awareness: 'When examining a target, reveal its HP and currently equipped weapon.',
  sex_appeal: 'Apply the reaction benefit only for eligible NPC interactions.',
  bonus_move: 'Reserve the movement-hex bonus for the future hex-map movement rules.',
  hth_evade: 'Apply its defense bonus when the character is unarmed and in close combat.',
  leadfoot: 'Apply the driving bonus only during vehicle-related checks.',
  road_warrior: 'Apply the vehicle combat benefits only when operating a vehicle.',
};

export function getCharacterPerkReminders(perks: readonly CharacterPerk[] | undefined): string[] {
  return (perks ?? [])
    .filter(perk => perk.rank > 0 && REMINDERS[perk.perkId])
    .map(perk => `${perk.perkId === 'fear_the_reaper' || perk.perkId === 'divine_favor' ? '' : ''}${REMINDERS[perk.perkId]}`);
}

export function getCharacterPerkReminderCount(perks: readonly CharacterPerk[] | undefined): number {
  return (perks ?? []).filter(perk => perk.rank > 0 && !!REMINDERS[perk.perkId]).length;
}
