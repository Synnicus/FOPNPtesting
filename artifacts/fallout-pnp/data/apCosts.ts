// Action Point Costs — from Fallout PnP wiki

export interface APCostEntry {
  id: string;
  name: string;
  description: string;
  cost: number;
  isVariable?: boolean; // cost can change with modifiers
}

export const AP_COSTS = {
  // ─── Movement ─────────────────────────────────────────────
  WALK_1: 1,          // walk 1 square (standing)
  CROUCH_1: 2,        // move 1 square while crouching
  PRONE_1: 4,         // crawl 1 square while prone

  // ─── Position Changes ─────────────────────────────────────
  CHANGE_POSITION: 2, // standing↔crouching, crouching↔prone, standing→prone
  STAND_FROM_PRONE: 4, // prone → standing

  // ─── Attacks ──────────────────────────────────────────────
  ATTACK_SINGLE: 4,
  ATTACK_AIMED: 5,
  ATTACK_BURST: 6,
  ATTACK_DOUBLE_SHOT: 5, // double-barrel

  // ─── Weapon Actions ───────────────────────────────────────
  RELOAD: 2,
  EQUIP_WEAPON: 2,
  PICK_UP_ITEM: 2,

  // ─── Items ────────────────────────────────────────────────
  USE_ITEM: 2,        // stims, chems, etc.

  // ─── Skills ───────────────────────────────────────────────
  FIRST_AID: 3,
  DOCTOR: 5,
  /** Healing an unconscious ally/foe in combat (manual physical p. 27). */
  HEAL_FALLEN: 10,
  SNEAK: 0,           // ongoing
  USE_SKILL: 3,

  // ─── Special Actions ─────────────────────────────────────
  DEFEND: 0,          // forfeit remaining AP, convert to tempAC
  LAYING_MINE: 6,
  SETUP_TRIPOD: 3,
} as const;

export const AP_COST_LIST: APCostEntry[] = [
  { id: 'walk', name: 'Walk 1 Square', description: 'Standard walking movement', cost: AP_COSTS.WALK_1 },
  { id: 'crouch_move', name: 'Move while Crouching', description: '1 square while crouching', cost: AP_COSTS.CROUCH_1 },
  { id: 'crawl', name: 'Crawl 1 Square', description: '1 square while prone', cost: AP_COSTS.PRONE_1 },
  { id: 'change_pos', name: 'Change Position', description: 'Standing↔Crouching↔Prone (not prone→standing)', cost: AP_COSTS.CHANGE_POSITION },
  { id: 'stand_prone', name: 'Stand Up from Prone', description: 'Prone → Standing', cost: AP_COSTS.STAND_FROM_PRONE },
  { id: 'attack', name: 'Attack (Single)', description: 'Single shot or melee strike', cost: AP_COSTS.ATTACK_SINGLE },
  { id: 'aimed', name: 'Aimed Attack', description: 'Targeted shot at specific body part', cost: AP_COSTS.ATTACK_AIMED },
  { id: 'burst', name: 'Burst Fire', description: 'Automatic burst', cost: AP_COSTS.ATTACK_BURST },
  { id: 'double', name: 'Double-Shot', description: 'Both barrels of a double-shot weapon', cost: AP_COSTS.ATTACK_DOUBLE_SHOT },
  { id: 'reload', name: 'Reload', description: 'Reload equipped weapon', cost: AP_COSTS.RELOAD },
  { id: 'equip', name: 'Equip / Switch Weapon', description: 'Ready or swap weapon', cost: AP_COSTS.EQUIP_WEAPON },
  { id: 'use_item', name: 'Use Item', description: 'Stim, chem, grenade, etc.', cost: AP_COSTS.USE_ITEM },
  { id: 'pick_up', name: 'Pick Up Item', description: 'Take item from ground', cost: AP_COSTS.PICK_UP_ITEM },
  { id: 'first_aid', name: 'First Aid', description: 'Use First Aid skill', cost: AP_COSTS.FIRST_AID },
  { id: 'doctor', name: 'Doctor', description: 'Use Doctor skill', cost: AP_COSTS.DOCTOR },
  { id: 'heal_fallen', name: 'Heal Fallen', description: 'Heal an unconscious target to 1 HP (First Aid / Doctor; Science / Repair for robots)', cost: AP_COSTS.HEAL_FALLEN, isVariable: true },
  { id: 'use_skill', name: 'Use Skill', description: 'Use a non-combat skill', cost: AP_COSTS.USE_SKILL },
  { id: 'lay_mine', name: 'Lay Mine', description: 'Set a mine (Traps roll)', cost: AP_COSTS.LAYING_MINE },
  { id: 'setup_tripod', name: 'Set Up Tripod', description: 'Set up a tripod/artillery — takes ALL remaining AP this round, success or fail (Big Guns roll)', cost: AP_COSTS.SETUP_TRIPOD, isVariable: true },
  { id: 'defend', name: 'Defend / End Turn', description: 'Forfeit remaining AP — converts to temporary AC', cost: AP_COSTS.DEFEND },
];
