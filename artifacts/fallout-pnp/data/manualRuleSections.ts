import { QUICK_RULES, type QuickRule, type QuickRuleTable } from './quickRules.ts';

export interface QuickRuleSubsection {
  id: string;
  title: string;
  manualPages: string;
  keywords: string[];
  rules: QuickRule[];
}

export interface QuickRuleSection {
  id: string;
  title: string;
  manualPages: string;
  description: string;
  subsections: QuickRuleSubsection[];
}

const table = (
  title: string,
  columns: string[],
  rows: QuickRuleTable['rows'],
): QuickRuleTable => ({ title, columns, rows });

function rule(
  id: string,
  title: string,
  preview: string,
  manualPages: string,
  details: string[],
  keywords: string[] = [],
  tables?: QuickRuleTable[],
): QuickRule {
  return { id, title, preview, manualPages, details, keywords, tables };
}

function subsection(
  id: string,
  title: string,
  manualPages: string,
  keywords: string[],
  rules: QuickRule[],
): QuickRuleSubsection {
  return { id, title, manualPages, keywords, rules };
}

function existing(...ids: string[]): QuickRule[] {
  return ids.map(id => {
    const found = QUICK_RULES.find(candidate => candidate.id === id);
    if (!found) throw new Error(`Missing existing quick rule: ${id}`);
    return found;
  });
}

const statsTable = table('Secondary statistic rules', ['Manual rule'], [
  { label: 'Hit Points', values: ['15 + STR + (2 × EN); each level adds 3 + floor(EN ÷ 2)'] },
  { label: 'Armor Class', values: ['AGI + armor AC'] },
  { label: 'Action Points', values: ['AGI 1: 5; 2–3: 6; 4–5: 7; 6–7: 8; 8–9: 9; 10+: 10'] },
  { label: 'Carry Weight', values: ['25 lb + (25 lb × STR)'] },
  { label: 'Melee Damage', values: ['STR 1–6: 1; 7: 2; 8: 3; then +1 per STR'] },
  { label: 'Poison Resistance', values: ['5 × EN percent'] },
  { label: 'Radiation Resistance', values: ['2 × EN percent'] },
  { label: 'Sequence', values: ['2 × PER'] },
  { label: 'Healing Rate', values: ['EN 1–5: 1; 6–8: 2; 9–10: 3; 11+: 4'] },
  { label: 'Critical Chance', values: ['Luck percent'] },
]);

const skillTable = table('Starting skill formulas', ['Starting value'], [
  { label: 'Small Guns', values: ['5 + (4 × AG)'] },
  { label: 'Big Guns', values: ['2 × AG'] },
  { label: 'Energy Weapons', values: ['2 × AG'] },
  { label: 'Unarmed', values: ['30 + 2 × (AG + STR)'] },
  { label: 'Melee Weapons', values: ['20 + 2 × (AG + STR)'] },
  { label: 'Throwing', values: ['4 × AG'] },
  { label: 'First Aid', values: ['2 × (PER + EN)'] },
  { label: 'Doctor', values: ['5 + PER + IN'] },
  { label: 'Sneak', values: ['5 + (3 × AG)'] },
  { label: 'Lockpick', values: ['10 + PER + AG'] },
  { label: 'Steal', values: ['3 × AG'] },
  { label: 'Traps', values: ['10 + PER + AG'] },
  { label: 'Science', values: ['4 × IN'] },
  { label: 'Repair', values: ['3 × IN'] },
  { label: 'Pilot', values: ['2 × (AG + PER)'] },
  { label: 'Speech', values: ['5 × CH'] },
  { label: 'Barter', values: ['4 × CH'] },
  { label: 'Gambling', values: ['5 × LK'] },
  { label: 'Outdoorsman', values: ['2 × (EN + IN)'] },
]);

const armorConditionTable = table('Armor condition modifier', ['Boxes filled', 'DT and DR loss'], [
  ...[0, 1, 2, 3].map(n => ({ label: String(n), values: ['None'] })),
  { label: '4', values: ['5%'] },
  { label: '5', values: ['10%'] },
  { label: '6', values: ['20%'] },
  { label: '7', values: ['30%'] },
  { label: '8', values: ['40%'] },
  { label: '9', values: ['50%'] },
  { label: '10', values: ['60%'] },
]);

const terrainTable = table('Combat movement by terrain', ['AP multiplier'], [
  { label: 'Open, flat ground', values: ['1×'] },
  { label: 'Rough or wet ground', values: ['2×'] },
  { label: 'Torn or muddy ground; water (swimming)', values: ['3×'] },
]);

const lightingTable = table('To-hit light modifiers', ['Penalty'], [
  { label: 'Clear daylight / well-lit building', values: ['0%'] },
  { label: 'Light clouds', values: ['−5%'] },
  { label: 'Medium clouds', values: ['−10%'] },
  { label: 'Heavy clouds', values: ['−15%'] },
  { label: 'Medium-lit building', values: ['−20%'] },
  { label: 'Light rain or dust', values: ['−30%'] },
  { label: 'Medium rain or dust', values: ['−40%'] },
  { label: 'Bad indoor light', values: ['−50%'] },
  { label: 'Heavy rain or dust', values: ['−60%'] },
  { label: 'Downpour / dust storm / cave with flare', values: ['−80%'] },
  { label: 'Blizzard / hurricane / tornado', values: ['−150%'] },
  { label: 'Total cave darkness', values: ['−200%'] },
  { label: 'Full / crescent / new moon (additional)', values: ['−10% / −20% / −40%'] },
]);

const radiationTable = table('Radiation poisoning thresholds', ['Effects begin 24 hours after reaching this level'], [
  { label: '50 rads', values: ['Abnormal tiredness'] },
  { label: '100 rads', values: ['Weakness, aches, itching, rash'] },
  { label: '400 rads', values: ['Severe weakness and pain, sores, hair loss; fertility effects for humans'] },
  { label: '600 rads', values: ['Vomiting, diarrhea, widespread sores, major hair loss, visible glow'] },
  { label: '800 rads', values: ['Bloody vomiting/diarrhea; death within 72 hours without treatment'] },
  { label: '1000 rads', values: ['Unconsciousness within minutes, followed by organ shutdown'] },
]);

const xpTable = table('XP required by level', ['Total XP'], [
  ...[
    0, 1000, 3000, 6000, 10000, 15000, 21000, 28000, 36000, 45000, 55000,
    66000, 78000, 91000, 105000, 120000, 136000, 153000, 171000, 190000, 210000,
  ].map((xp, index) => ({ label: `Level ${index + 1}`, values: [xp.toLocaleString()] })),
  { label: 'Level 22+', values: ['Add 40,000 XP for each additional level'] },
]);

const skillCostTable = table('Skill-point cost per 1 percentage point', ['SP cost'], [
  { label: '1–100%', values: ['1'] },
  { label: '101–125%', values: ['2'] },
  { label: '126–150%', values: ['3'] },
  { label: '151–175%', values: ['4'] },
  { label: '176–200%', values: ['5'] },
  { label: '201%+', values: ['6'] },
]);

export const QUICK_RULE_SECTIONS: QuickRuleSection[] = [
  {
    id: 'introduction',
    title: 'Part I — Introduction',
    manualPages: 'pp. 4–5',
    description: 'Purpose, materials, and terminology used by the manual.',
    subsections: [
      subsection('intro-play', 'Playing the game and glossary', 'pp. 4–5', ['equipment required', 'dice', 'glossary', 'round', 'player', 'pc', 'npc', 'critter', 'gm', 'experience', 'level', 'rank'], [
        rule('intro-glossary', 'Core terms and materials', 'A tabletop roleplaying game guided by a GM and resolved with percentile skill checks and polyhedral dice.', 'pp. 4–5', [
          'The manual describes the GM as storyteller and rules judge; the GM makes most NPC rolls and adjudicates situations not covered by a specific rule.',
          'A round is a unit of game time; combat rounds represent 10 seconds. A PC is a player character, an NPC is a non-player character, and “critter” refers to creatures and characters used as opponents.',
          'The manual recommends a normal set of polyhedral dice (d4, d6, d8, d10, d12, d20), character sheets, and hex sheets for combat.',
        ], ['rules from Fallout games', 'Fallout setting', 'experience points', 'XP', 'karma definition', 'skill check']),
      ]),
    ],
  },
  {
    id: 'character-creation',
    title: 'Part II — Character Creation',
    manualPages: 'pp. 6–22',
    description: 'Create a character in order: concept, race, traits, stats, skills, and finishing details.',
    subsections: [
      subsection('creation-concept', 'Character concept and terminology', 'pp. 6–7', ['character concept', 'character creation', 'player character', 'npc', 'critter', 'rank'], [
        rule('creation-basics', 'Starting a character', 'Choose a concept, race, traits, SPECIAL, skills, and finishing details.', 'pp. 6–7', [
          'The manual presents character creation as a sequence: imagine the character, select race and traits, assign SPECIAL, calculate secondary statistics, choose skills, and finish with Karma and roleplaying details.',
          'Beginning characters start with Karma 0. The GM decides how actions affect Karma during play.',
          'The GM can override or adapt rules for the campaign; the manual frames the rules as guidance for an open-ended tabletop game.',
        ], ['terminology', 'creating a character', 'karma at start']),
      ]),
      subsection('creation-races', 'Race', 'pp. 7–11', ['human', 'ghoul', 'super-mutant', 'mutant', 'half-mutant', 'deathclaw', 'dog', 'robot', 'racial minimum', 'racial maximum'], [
        rule('race-overview', 'Race abilities and restrictions', 'Race sets SPECIAL limits and may grant resistances, growth, skill changes, equipment restrictions, or special maintenance.', 'pp. 7–11', [
          'Humans use the standard SPECIAL range and gain perks on the human cadence. Ghouls have strong radiation resistance and a different perk cadence; consult their race entry for SPECIAL limits and other racial effects.',
          'Super-mutants have substantial radiation, poison, and general damage resistance, extra HP per level, a Small Guns Perception penalty, and cannot wear human-sized armor. Half-mutants have smaller resistance bonuses and can use human armor.',
          'Deathclaws have natural attacks and protection, cannot use ordinary equipment like a human, and gain perks less often. Dogs have restricted equipment use and a faster perk cadence. Robots do not naturally heal or gain perks and require regular maintenance.',
          'Apply a race’s minimums, maximums, bonuses, penalties, and equipment restrictions as printed. The Bestiary tab is a separate catalog for creatures; this section summarizes player-race rules.',
        ], ['racial traits', 'racial abilities', 'mutant', 'super mutant', 'ghoul', 'deathclaw race', 'dog race', 'robot race']),
      ]),
      subsection('creation-traits', 'Traits', 'pp. 11–13', ['traits', 'trait', 'fast metabolism', 'small frame', 'one hander', 'finesse', 'kamikaze', 'heavy handed', 'gifted', 'skilled'], [
        rule('traits-rule', 'Choosing traits', 'A character may choose up to two traits; each has a benefit and a trade-off.', 'pp. 11–13', [
          'Read both sides of a trait before selecting it. Some traits are restricted by race, and some alter starting skills, SPECIAL, resistances, perk cadence, or combat behavior.',
          'Traits are not perks: they are selected during character creation. Use the character editor’s Traits tab for the full trait descriptions and current app implementation.',
        ], ['trait list', 'trait restrictions', 'trait bonuses', 'trait penalties']),
      ]),
      subsection('creation-statistics', 'Statistics — Primary Statistics', 'pp. 13–16', ['special', 'strength', 'perception', 'endurance', 'charisma', 'intelligence', 'agility', 'luck', 'primary statistics'], [
        rule('primary-stats', 'Assigning SPECIAL', 'Begin at 5 in each of the seven primary stats and distribute five additional character points.', 'pp. 13–16', [
          'The seven primary statistics are Strength, Perception, Endurance, Charisma, Intelligence, Agility, and Luck (SPECIAL). Points may be moved between stats, but none may be lost.',
          'Respect the selected race’s minimum and maximum for each statistic. Recheck those limits after applying traits and racial effects.',
          'Strength affects carrying, melee damage, HP, weapon requirements, and feats of force; Perception affects sequence, skills, noticing, and effective ranged distance; Endurance affects HP, resistances, healing, and endurance checks.',
          'Charisma is used for social interaction and Barter/Speech; Intelligence supports many non-combat skills and skill points at advancement; Agility affects AC, AP, and many skills; Luck influences Critical Chance and Gambling.',
        ], ['special stats', 'special', 'primary stats', 'stat points', 'stat rolls']),
      ]),
      subsection('creation-secondary', 'Statistics — Secondary Statistics', 'pp. 16–18', ['secondary statistics', 'hit points', 'hp', 'armor class', 'ac', 'action points', 'ap', 'carry weight', 'melee damage', 'poison resistance', 'radiation resistance', 'gas resistance', 'electricity resistance', 'damage resistance', 'damage threshold', 'sequence', 'healing rate', 'critical chance'], [
        rule('secondary-stat-table', 'Calculate secondary statistics', 'Use these manual formulas before adding racial, trait, armor, and perk modifiers.', 'pp. 16–18', [
          'Apply racial and trait modifiers after calculating the base secondary statistics. Armor contributes AC, DT, DR, and other resistances from its own entry.',
          'Damage Threshold is a flat amount supplied by armor; Damage Resistance is a percentage. The sheet’s protection categories include the manual’s damage types.',
        ], ['stat formula', 'agility table', 'endurance table'], [statsTable]),
      ]),
      subsection('creation-skills', 'Skills', 'pp. 18–22', ['skills', 'tag skills', 'small guns', 'big guns', 'energy weapons', 'unarmed', 'melee weapons', 'throwing', 'first aid', 'doctor', 'sneak', 'lockpick', 'steal', 'traps', 'science', 'repair', 'pilot', 'speech', 'barter', 'gambling', 'outdoorsman'], [
        rule('skill-basics', 'Tag skills and starting skill values', 'Choose three tag skills; each gets +20% and improves twice as quickly when spending skill points.', 'pp. 18–22', [
          'The listed starting values are base percentages before tag bonuses, traits, or later skill-point spending. Each tag skill gets an immediate +20 percentage points and gains 2% per skill point spent rather than 1%.',
          'Unarmed includes fists, feet, and weapons that enhance hand-to-hand attacks. Throwing distance also depends on Strength and the thrown item. First Aid and Doctor have daily use limits described under Healing.',
          'The manual’s special unarmed techniques list individual damage, AP, critical bonuses, and SPECIAL/skill/level requirements; use the full table below.',
        ], ['skill list', 'skill progression', 'starting skill formulas', 'special unarmed attacks'], [
          skillTable,
          table('Special unarmed techniques (manual pp. 19–20)', ['Bonus / cost / requirement'], [
            { label: 'Strong Punch', values: ['+3 damage; 3 AP; Unarmed 55%, AGI 6'] },
            { label: 'Hammer Punch', values: ['+5 damage, +5% crit; 3 AP; Unarmed 75%, AGI 6, STR 5, level 6'] },
            { label: 'Haymaker', values: ['+7 damage, +15% crit; 3 AP; Unarmed 100%, AGI 7, STR 5, level 9'] },
            { label: 'Jab', values: ['+3 damage, +10% crit; 3 AP; Unarmed 75%, AGI 7, STR 5, level 5'] },
            { label: 'Palm Strike', values: ['+7 damage, +20% crit, AC-piercing; 6 AP; Unarmed 115%, AGI 7, STR 5, level 12'] },
            { label: 'Piercing Strike', values: ['+10 damage, +40% crit, AC-piercing; 8 AP; Unarmed 130%, AGI 7, STR 5, level 16'] },
            { label: 'Strong Kick', values: ['+5 damage; 4 AP; Unarmed 40%, AGI 6'] },
            { label: 'Snap Kick', values: ['+7 damage; 4 AP; Unarmed 60%, AGI 6, STR 6, level 6'] },
            { label: 'Power Kick', values: ['+9 damage, +5% crit; 4 AP; Unarmed 80%, AGI 6, STR 6, level 9'] },
            { label: 'Hip Kick', values: ['+7 damage; 7 AP; Unarmed 60%, AGI 7, STR 6, level 6'] },
            { label: 'Hook Kick', values: ['+9 damage, +10% crit, AC-piercing; 7 AP; Unarmed 100%, AGI 7, STR 6, level 12'] },
            { label: 'Piercing Kick', values: ['+12 damage, +50% crit, AC-piercing; 9 AP; Unarmed 125%, AGI 8, STR 6, level 15'] },
          ]),
        ]),
      ]),
      subsection('creation-finishing', 'Finishing Touches and Karma', 'p. 22', ['finishing touches', 'karma', 'starting karma'], [
        rule('creation-finish', 'Complete the character', 'Starting Karma is 0; finish with character details and roleplaying traits.', 'p. 22', [
          'After calculating skills, record Karma as zero and add character details, quirks, and personality that help guide play.',
          'The manual’s examples of Karma awards and losses are in Part III → Life in the Wastes → Karma.',
        ], ['character creation complete']),
      ]),
    ],
  },
  {
    id: 'the-game',
    title: 'Part III — The Game',
    manualPages: 'pp. 22–58',
    description: 'Equipment readiness, combat, injury, travel, social actions, and character advancement.',
    subsections: [
      subsection('before-combat', 'Before Combat', 'pp. 22–24', ['holding items', 'equipping armor', 'armor', 'weapon condition', 'repairing weapons', 'vehicle condition', 'repairing vehicles', 'armor condition', 'repairing armor', 'ammo loading'], [
        rule('precombat-equipment', 'Holding weapons and objects', 'A character can equip at most two weapons, one per hand; two-handed weapons occupy both hands.', 'pp. 22–23', [
          'Items must be held to use them. Carried items may be stored elsewhere on the character, but using an item in combat requires access and AP.',
          'A weapon can only use compatible ammunition. Different ammunition types such as AP and JHP cannot be combined in one magazine.',
          'Armor entries provide AC, DT, DR, resistances, and any skill penalties. Helmets may be worn separately when compatible; a helmet reduces the chance of a targeted head shot becoming critical by 15%.',
        ], ['weapons and objects', 'carrying objects', 'armor equipping', 'helmet']),
        rule('vehicle-condition', 'Vehicle condition and repair', 'Vehicles track hit points in separate systems rather than condition boxes.', 'p. 23', [
          'The manual divides a vehicle into five systems, each with its own hit points. A system that loses more than two-thirds of its hit points becomes inoperative.',
          'To repair a system, choose the system and spend 8 hours; a successful Repair roll restores 3d10 HP to that system. Vehicle system effects are detailed in Vehicle Combat.',
        ], ['vehicle condition', 'repairing vehicles', 'vehicle systems']),
        rule('armor-condition-rule', 'Armor condition and repair', 'Every five successful damaging hits fill one armor condition box; filled boxes reduce armor DT and DR.', 'p. 24', [
          'Count successful hits that actually cause damage against a character wearing that armor. Every five such hits fill one box. Armor Class remains; wear reduces only DT and DR.',
          'Subtract the chart modifier from each original DT and DR value: adjusted value = original × (1 − modifier). Repair takes four hours; a successful Repair roll empties two boxes.',
        ], ['condition boxes', 'armor durability', 'armor hits', 'repairing armor', 'durability chart'], [armorConditionTable]),
        ...existing('weapon-condition'),
      ]),
      subsection('combat-basics', 'Combat — Begins, Sequence, and Action', 'pp. 24–27', ['combat begins', 'sequence', 'round', 'turn', 'action points', 'movement', 'terrain', 'defending', 'reload', 'reloading', 'healing in combat', 'getting up', 'equipping items', 'taking items', 'skills in combat', 'laying mines', 'tripod'], [
        rule('combat-flow', 'Combat order', 'Combat uses 10-second rounds; the initiator acts before Sequence is determined.', 'pp. 24–25', [
          'The character or critter that starts combat gets the opportunity to spend all AP before Sequence is rolled. Then determine turn order from highest Sequence downward.',
          'Resolve each combatant’s turn in order. Tied Sequence scores are broken with opposed d10 rolls at the start of combat; that order remains for the combat.',
        ], ['combat procedure', 'determine sequence', 'combat round']),
        rule('combat-movement-actions', 'Movement and common combat actions', 'Movement usually costs 1 AP per hex; terrain and position can increase the cost.', 'pp. 25–27', [
          'A hex is one meter. The GM can use terrain multipliers for movement. Using a held item costs 3 AP; equipping an item costs 4 AP per item; taking a ground/container item costs 4 AP per item.',
          'Reloading usually costs 2 AP. Mortars, artillery, and most vehicle weapons require a full turn. AP and JHP ammunition cannot share a clip.',
          'A GM sets combat-skill action costs. A character using a skill does not gain AC bonuses from Agility or unused AP. Healing an unconscious ally takes 10 AP and a successful First Aid or Doctor roll; it restores 1 HP and consumes a daily use.',
          'Getting up from the ground costs 4 AP. Laying a mine costs 6 AP and a successful Traps roll. Setting up a tripod or artillery piece uses all AP for the turn and requires a Big Guns roll.',
        ], ['taking items in combat', 'items in combat', 'reloading weapons', 'skills in combat', 'healing in combat', 'getting up in combat', 'mines in combat', 'tripod setup'], [terrainTable]),
        rule('combat-defending', 'Defending', 'When a character ends the turn to defend, remaining AP increase AC.', 'p. 27', [
          'A character may stop acting and defend. Add the unused AP to Armor Class for defense. The character gives up the rest of the turn’s actions.',
        ], ['defending in combat', 'unused action points']),
        ...existing('action-points', 'positions'),
      ]),
      subsection('combat-attacking', 'Combat — Attacking and To-Hit', 'pp. 27–31', ['attacking', 'to-hit', 'chance to hit', 'base chance', 'range modifiers', 'light modifiers', 'cover modifiers', 'burst mode', 'rate of fire', 'streamlined burst', 'double shot', 'critical failure', 'critical hits', 'knockdowns'], [
        ...existing('attack-roll', 'range-penalty', 'targeted-melee', 'targeted-ranged'),
        rule('light-modifiers', 'Light and night modifiers', 'Lighting imposes a to-hit modifier; moonlight can add a further nighttime penalty.', 'p. 28', [
          'Apply the lighting penalty to the attack chance before rolling. The GM determines which listed condition best fits the scene; full, crescent, and new moon penalties are added at night.',
        ], ['light modifiers to hit', 'darkness', 'night', 'rain', 'dust'], [lightingTable]),
        rule('cover-modifiers', 'Cover modifiers', 'Subtract the percentage of the target concealed by cover; cover does not modify melee attacks.', 'p. 29', [
          'Estimate how much of the target is hidden. For example, cover hiding roughly 15% of the target imposes −15% to-hit. The GM determines concealment and whether line of sight is sufficient.',
        ], ['cover modifiers to hit', 'concealment', 'partial cover']),
        rule('burst-and-double-shot', 'Burst and double-shot attacks', 'Burst fire resolves bullets individually or by the streamlined nearest-10% method; a double-shot shotgun uses one hit roll and two damage rolls.', 'pp. 28–30', [
          'A burst is automatic fire; its minimum is three shots and its maximum is set by the weapon. In the streamlined method, round chance to hit to the nearest 10 and roll one d10 per bullet. For bursts of five or fewer, round up; for larger bursts, round down, except miniguns and Bozars round up.',
          'Bullets that miss the first target may hit the next target in the cone of fire. A burst can only be aimed at the nearest target in its cone. A double-shot weapon makes one to-hit roll but rolls damage twice, and a double shotgun shot reduces effective weapon range by 3 hexes.',
        ], ['burst mode', 'streamlined burst mode', 'rate of fire', 'double-shot weapons', 'cone of fire']),
        rule('critical-failure-rule', 'Critical failures and weapon wear', 'A failed attack roll of 97–100 triggers the critical-failure table; a missed attack also wears the weapon.', 'pp. 23, 31', [
          'When an attack fails on 97–100, roll on the Critical Failure table. Each missed attack fills one weapon condition box; at 8 or more filled boxes the weapon takes −10% to hit, and at 10 it is jammed or broken.',
        ], ['critical failure', 'weapon wear from misses']),
        rule('knockdowns', 'Knockdowns', 'Heavy melee hits and bursts can knock a target down; Endurance may prevent the fall.', 'p. 31', [
          'The manual gives melee knockdown thresholds based on weapon weight and describes an Endurance check when more than half the burst’s bullets hit. Check the weapon or creature entry and apply the manual’s threshold for the specific attack.',
        ], ['knockdown', 'knocked down', 'burst knockdown', 'weapon weight']),
      ]),
      subsection('combat-damage-criticals', 'Combat — Damage and Criticals', 'pp. 31–34', ['damage formula', 'non-conventional weapons', 'damage threshold', 'damage resistance', 'critical hit', 'critical chance', 'critical table', 'damage types'], [
        ...existing('damage', 'criticals', 'critical-failure'),
        rule('nonconventional-damage', 'Non-conventional weapon damage', 'Explosive, flame, gas, and other unusual attacks can have special damage or area rules.', 'pp. 31–33', [
          'Use each weapon’s description for damage type, blast or gas area, direct damage, and special effects. Apply the matching DT/DR and any stated exceptions; do not assume every attack uses ordinary bullet damage.',
          'Damage is reduced by the relevant DT first, then by DR. The manual’s calculation is (initial damage − DT) − ((initial damage − DT) × DR), rounding down.',
        ], ['explosions', 'firearms', 'energy weapons', 'gas weapons', 'damage formula']),
        rule('critical-shot-rules', 'Critical hit resolution', 'A successful attack can be critical when its roll is within the attacker’s Critical Chance.', 'pp. 33–34', [
          'Use Luck as the base Critical Chance, then apply applicable weapon, perk, or targeted-shot bonuses. A targeted critical uses the selected body area’s effect; an untargeted critical uses the Critical Hits table.',
          'The existing critical-result tables are reproduced in the Criticals topic above, with manual page citations.',
        ], ['critical hits', 'critical chance', 'targeted critical', 'critical effects']),
      ]),
      subsection('combat-ending', 'Combat — Continuing and Ending Combat', 'p. 34', ['ending combat', 'combat resolution', 'experience after combat'], [
        rule('combat-end', 'Ending combat', 'Combat continues until the opposing sides are incapacitated, dead, or have fled.', 'p. 34', [
          'Repeat combat rounds until the conflict is resolved. The manual then awards experience and allows survivors to recover or claim items as the GM permits.',
        ], ['combat ends', 'combat continues']),
      ]),
      subsection('vehicle-combat', 'Vehicle Combat and Mechanics', 'pp. 35–38', ['vehicle combat', 'pilot roll', 'crashing', 'nudging', 'running down', 'turn radius', 'vehicle speed', 'vehicle systems', 'engine', 'control', 'drive', 'treads', 'tires'], [
        rule('vehicle-combat-rules', 'Vehicle systems and combat actions', 'Vehicles have separate system hit points; disabled systems affect operation and destroyed systems can disable the vehicle.', 'pp. 35–38', [
          'Vehicle combat uses a Pilot roll for driving actions. Each vehicle has systems such as structure, engine, control, drive, and treads or tires; the vehicle entry supplies its system HP and protection.',
          'Attacking from a moving vehicle applies the manual’s to-hit penalty. Attacking while driving also affects the Pilot roll. A system losing more than two-thirds of its HP becomes inoperative; destruction has more severe effects.',
          'Terrain, weather, speed, acceleration, braking, turning, and attacking can modify Pilot rolls. Combine applicable modifiers; the manual’s terrain and action tables are on p. 38.',
          'At the end of a round, vehicle movement in meters is current KPH × 2.78, rounded down. Consult the vehicle entry and the manual’s table for exact handling conditions.',
        ], ['pilot roll', 'terrain modifiers', 'action modifiers', 'vehicle damage']),
        rule('vehicle-crashes', 'Crashes and occupants', 'A failed Pilot roll can cause a crash; occupants take speed-based damage and may suffer broken limbs.', 'pp. 38–39', [
          'For each 10 KPH, rounded down, each occupant rolls one d10 damage. The vehicle also takes damage distributed among its systems. Sea vehicles overturn rather than taking ordinary crash damage.',
          'Each occupant has a broken-limb chance equal to vehicle speed in KPH; a restraint halves that chance, rounding up. A roll of 5 or less also causes a head wound and unconsciousness; the character is reduced to 10 HP and wakes after 15 rounds minus Endurance.',
          'After a crash, occupants spend at least one full combat round getting out; a character with broken limbs needs three rounds unless helped.',
        ], ['crashing', 'broken limbs in crash', 'seat belt', 'vehicle movement']),
      ]),
      subsection('damage-death', 'Damage and Death', 'pp. 39–43', ['fire damage', 'acid damage', 'poison damage', 'radiation damage', 'gas damage', 'electrical damage', 'chems', 'addiction', 'withdrawal', 'crippled limbs', 'blindness', 'healing', 'robot healing', 'death'], [
        rule('fire-acid', 'Fire and acid', 'Fire or acid causes 1d6 damage per round until stopped or washed away.', 'p. 39', [
          'A burning character may spend a full round rolling on suitable ground to extinguish fire, but still takes damage during that turn; getting up then costs the normal 4 AP. AC while rolling is based on what is worn.',
          'Acid usually requires water or chemicals to remove, but some acids react badly with water. Follow the specific acid or equipment description.',
        ], ['fire damage', 'acid damage', 'burning']),
        rule('poison-rules', 'Poison', 'A failed Poison Resistance check causes a poison level; repeated failures add levels.', 'pp. 39–40', [
          'Each poison type has its own duration and effect. Some cause hourly or per-round HP loss, some temporarily reduce stats, and severe types cause coma or death. Successful natural recovery without antidote or a doctor adds +2% Poison Resistance.',
          'When poison reduces stats, racial minimums do not protect the character from the reduction. Use the type-specific description and apply its Endurance checks and duration.',
        ], ['poison damage and effects', 'poison types', 'antidote']),
        rule('radiation-rules', 'Radiation', 'Radiation Resistance reduces the rads entering the body; poisoning effects occur at thresholds after 24 hours.', 'pp. 40–41', [
          'About 10 rads leave the body in 24 hours. Radiation effects are cumulative and are treated at qualified medical institutions or with appropriate drugs. A Geiger counter can reveal exposure; otherwise the GM tracks it.',
          'Use the threshold table for the manual’s symptoms and consequences. Around 1,000 rads is lethal; the 1,000-rad threshold causes rapid unconsciousness and bodily shutdown.',
        ], ['radiation damage', 'rads', 'radiation poisoning', 'Geiger counter'], [radiationTable]),
        rule('gas-electricity', 'Gas and electrical damage', 'Gas may be inhaled or contact-based; equipment resistance determines protection.', 'p. 41', [
          'Gas effects depend on the gas and weapon description. Leaving the cloud promptly limits continuing exposure; the gas can continue affecting a character who remains in it after the cloud disperses.',
          'Armor and gas masks may protect against inhaled gas, contact gas, or both. The two values in gas resistance are inhaled/contact. Electrical damage is reduced by the character’s applicable electrical resistance.',
        ], ['gas damage', 'electrical damage', 'inhaled gas', 'contact gas']),
        rule('injury-rules', 'Crippled limbs and blindness', 'Crippled limbs restrict movement and weapon use; blindness imposes darkness penalties and PER 1.', 'pp. 41–42', [
          'One crippled leg halves movement and effective Agility; two reduce movement to one hex per round and effective Agility to 1. Each crippled arm reduces Agility by 1; one prevents two-handed weapon use, and two prevent weapon use.',
          'A blind character suffers total-darkness penalties and has Perception 1. Doctor treats living characters; Repair treats robots. Treated living limbs or eyes take 48 hours with rest to return near normal; repaired robots regain function immediately.',
        ], ['blindness', 'crippled limbs', 'broken limb', 'healing injuries']),
        ...existing('injuries'),
        rule('chem-withdrawal', 'Chems, addiction, and withdrawal', 'When a chem is taken, roll its addiction rate; withdrawal worsens over three days without supply.', 'p. 42', [
          'If the addiction roll succeeds, the character becomes dependent on that chem. After 24 hours without it, lose 1 PER and 1 AG and the ability to heal; after another 24 hours, lose 2 more PER and AG and 1 STR and EN.',
          'After a third day, the character becomes unconscious and checks Endurance hourly. Five consecutive successes end the addiction but permanently reduce EN by 1; five consecutive failures cause death.',
        ], ['chems addiction withdrawal', 'drug withdrawal']),
        rule('healing-rules', 'Healing living characters', 'Natural healing depends on rest; First Aid and Doctor can restore more HP with limited daily uses.', 'pp. 42–43', [
          'Natural healing restores Healing Rate HP per 24 hours of activity, or that amount every six hours of rest. First Aid heals 1d10 HP on a successful check, takes 1d10 minutes, and can be attempted three times per 24 hours.',
          'Doctor heals 2d10 HP on a successful check, takes one hour, and can be used twice per 24 hours. Doctor can also treat crippled limbs and blindness. Healing attempts made in combat count against the daily limit.',
        ], ['healing', 'first aid', 'doctor', 'natural healing']),
        rule('robot-healing-rules', 'Robot healing and maintenance', 'Robots do not heal naturally or benefit from healing chems; use Science and Repair.', 'pp. 10, 43', [
          'A successful Science check restores 1d10 HP in 1d10 minutes, up to three times per 24 hours. Repair can restore 2d10 HP or repair a broken limb/sensor array in one hour, up to twice per 24 hours.',
          'Robots need a successful Repair and Science maintenance examination lasting 12 hours at least once a month. Each 24 hours beyond the deadline causes 1d10 damage.',
        ], ['robot healing', 'robot maintenance', 'science repair']),
        rule('death-rules', 'Death', 'Death is normally permanent; any exception is a GM decision.', 'p. 43', [
          'The manual treats death as a one-way outcome for ordinary play, while leaving unusual story exceptions to the GM. Prepare replacement characters if the campaign needs them.',
        ], ['death definition', 'dead character']),
      ]),
      subsection('life-wastes', 'Life in the Wastes', 'pp. 43–47', ['barter', 'bartering', 'karma', 'karmic perks', 'reading books', 'doors', 'traps', 'explosives', 'mines', 'energy', 'power', 'random encounters', 'detecting sneaks', 'swimming', 'wading'], [
        rule('barter-rules', 'Trading and Barter', 'Compare Barter skills; the higher skill adds the difference as a percentage to that trader’s goods.', 'p. 43', [
          'Trades are based on item value and can be balanced with additional goods or currency. To apply the manual’s skill method, subtract the lower Barter skill from the higher and add that percentage to the goods of the character with the higher skill.',
          'The GM may resolve a trade through roleplay instead of calculations.',
        ], ['bartering', 'trading']),
        rule('karma-rules', 'Karma', 'The GM awards or subtracts Karma for meaningful actions; it should not force players into a moral path.', 'pp. 6, 43–44', [
          'The manual’s example changes are: help someone +10; attack an innocent person −10; kill an innocent person −30; steal from an honest merchant −10; steal from a crooked merchant +5; run over someone’s dog −5; kill a notorious bandit +50; join one −40; disable a ticking nuclear bomb +100; detonate one −500.',
          'Karma records good or evil actions; the GM should use it descriptively rather than as a tool to compel player choices. The app’s character Karma tracker is separate and records the player’s campaign changes.',
        ], ['karma in game', 'karma examples', 'karma definition']),
        rule('karmic-perks', 'Karmic Perks', 'Some notable actions or reputations grant special benefits or social consequences.', 'p. 44', [
          'The manual describes Berserker, Childkiller, Prizefighter, and Slaver as reputation-based karmic perks. Prizefighter grants +20% Unarmed and normal DR; the others primarily affect how people and communities react.',
          'These are distinct from the level-based Perks list in Advancement.',
        ], ['berserker', 'childkiller', 'prizefighter', 'slaver']),
        rule('reading-books', 'Reading books', 'A readable book grants the skill points listed in its item entry.', 'p. 44', [
          'The book’s description supplies the skill and number of points. Apply those points using the Advancement skill-cost bands; a character must be able to read.',
        ], ['reading books', 'books', 'skill points from books']),
        rule('doors-traps-explosives', 'Doors, traps, and explosives', 'Doors and objects can be broken by reducing their HP to zero; traps and explosives use Traps checks.', 'pp. 44–45', [
          'A GM secretly checks Perception to notice a visible trap in line of sight. Disarming takes about 10 seconds and requires Traps; failure triggers it. Setting a trap requires materials and GM-set time, followed by a secret Traps roll.',
          'Setting an explosive takes one round and a secret Traps roll; failure can make its timing wrong. A failed disarm does not automatically detonate it, but a critical failure of 98–100 does. Damage from an explosive cannot be avoided with an Agility roll.',
          'Doors and other objects have HP; attacks or explosives can reduce them to zero and break them open.',
        ], ['doors opening and breaking down', 'traps', 'setting traps', 'explosives', 'disarming explosives']),
        rule('mines-rules', 'Mines', 'Detect mines with a secret Perception check within a radius equal to PER; mines can trigger nearby mines.', 'p. 46', [
          'Mines use the trap-detection procedure but are only detectable within a hex radius equal to Perception and when not obscured. Laying or disarming them follows explosive procedures; a defused mine cannot be reused.',
          'A detonating mine has an 80% chance to set off other mines in its blast radius and a 40% chance for mines in its concussion radius. Characters in the blast radius do not get an Agility avoidance roll.',
        ], ['detecting mines', 'laying mines', 'disarming mines']),
        rule('energy-power', 'Energy, gas, and power', 'Energy cells can be recharged at rare powered stations; small cells are disposable.', 'p. 46', [
          'Small Energy Cells and Micro Fusion Cells store charges for weapons and vehicles. Small cells cannot be recharged; Micro Fusion Cells can be recharged at rare powered machines, usually taking about an hour.',
          'Gasoline-powered equipment is uncommon and fuel is scarce. See Equipment for individual weapon and vehicle energy use.',
        ], ['energy and power', 'micro fusion cells', 'small energy cells', 'gasoline', 'petrol']),
        rule('random-encounters', 'Random encounters', 'The adventure or GM sets encounter frequency; a successful Outdoorsman check can reveal an encounter and allow avoidance.', 'pp. 46–47', [
          'The party’s leader makes the Outdoorsman check. If successful, the party spots the encounter and may decide whether to avoid it.',
          'Starting distance is five hexes multiplied by the leader’s Perception, measured from the center of the encountered group.',
        ], ['random encounters', 'outdoorsman']),
        rule('detect-sneaks', 'Detecting sneaks', 'Base detection chance is 8 × PER; partial darkness reduces it to 5 × PER, total darkness to 2 × PER.', 'p. 47', [
          'The GM asks characters to roll and tells only successful observers what they detected. Use the reduced multiplier when the sneaker is concealed in partial/semi-darkness or total darkness.',
        ], ['detecting sneaking characters', 'sneak detection']),
        rule('swimming-rules', 'Swimming and wading', 'Safe flotation capacity is about 10 lb × STR; swimming costs 3 AP per hex.', 'p. 47', [
          'A character needs at least one free hand and can safely carry about 10 pounds times Strength, including clothing and shoes. Check Endurance every 10 minutes to stay afloat and every minute while swimming.',
          'In water knee-deep or higher, movement is one hex for every 3 AP.',
        ], ['swimming', 'wading', 'floating']),
      ]),
      subsection('art-of-thief', 'The Art of the Thief', 'pp. 47–49', ['sneaking', 'stealing', 'planting items', 'picking locks', 'lockpick'], [
        rule('thief-rules', 'Sneaking, stealing, and planting items', 'Sneak is checked when starting and once per minute; successful sneaking adds +40% to Steal.', 'pp. 47–48', [
          'Cover, light, and observers’ Perception affect Sneak at the GM’s discretion. A successful sneak grants the first attack in combat and may allow avoiding combat; normally a character cannot sneak and run at once.',
          'Steal attempts are harder for large items or multiple items; items actively held or worn cannot be stolen. A failed attempt may be noticed, and the target can initiate combat with the first sequence.',
          'Planting an item uses the same procedure and detection risk as stealing, but transfers the item to the target.',
        ], ['sneaking', 'stealing', 'planting items', 'pickpocket']),
        rule('lockpicking-rules', 'Picking locks', 'Lockpicking takes one minute; a failed roll of 95–100 breaks the lock.', 'p. 48', [
          'Regular locks may be picked without a tool, though a lockpick can help. Electronic locks require an electronic lockpick or key. Some locks need specialized tools.',
          'If the roll is 95 or higher and fails, the lock breaks and can only be opened with explosives, risking damage to whatever is behind it.',
        ], ['picking locks', 'electronic lockpick', 'broken lock']),
      ]),
      subsection('advancement', 'Advancement and Perks', 'pp. 49–58', ['advancement', 'experience', 'xp', 'level', 'skill progression', 'skill points', 'perks'], [
        rule('advancement-rules', 'Experience and leveling', 'A new level grants HP and skill points; skill-point cost rises as a skill becomes higher.', 'p. 49', [
          'Each level adds 3 + half Endurance rounded down to maximum HP, and grants 5 + (2 × Intelligence) skill points. Skill increases cost more points at higher percentages.',
          'Perks are gained at the cadence set by race and campaign rules. Each perk has requirements and may have multiple ranks; robots do not gain ordinary perks.',
        ], ['experience table', 'level advancement', 'skill progression', 'perk list'], [xpTable, skillCostTable]),
        rule('perk-rules', 'Perks', 'Perks are advancement choices with rank limits and level/stat/skill prerequisites.', 'pp. 49–58', [
          'Check each perk’s rank limit and all requirements before selecting it. Perks can modify statistics, skills, resistances, combat, travel, or special situations; some require GM adjudication.',
          'The manual’s full alphabetical perk catalog appears in this section. The character editor’s Perks tab is the app’s searchable catalog; this reference explains how perk rules work.',
        ], ['perk definition', 'perk ranks', 'perks in game', 'perks list']),
      ]),
    ],
  },
  {
    id: 'universe-guide',
    title: 'Part IV — The Fallout Universe: A Rough Guide',
    manualPages: 'pp. 58–64',
    description: 'Setting information and locations; primarily campaign lore rather than mechanical rules.',
    subsections: [
      subsection('universe-setting', 'Common Things and Places to Visit', 'pp. 58–64', ['fallout universe', 'common things', 'places to visit', 'lore', 'setting'], [
        rule('universe-lore', 'Setting guide', 'This part provides background on factions, locations, and the post-war world rather than character or combat mechanics.', 'pp. 58–64', [
          'Use this material as setting inspiration. Campaigns can use a different continuity or interpretation; the GM decides what is true in their wasteland.',
        ], ['brotherhood of steel', 'new california republic', 'places']),
      ]),
    ],
  },
  {
    id: 'bestiary',
    title: 'Part V — A Fallout Bestiary',
    manualPages: 'pp. 65–73',
    description: 'Creature and NPC stat blocks are in the app’s Bestiary tab.',
    subsections: [
      subsection('bestiary-reference', 'Creature entries and combat stats', 'pp. 65–73', ['bestiary', 'creature', 'critter', 'npc', 'hit points', 'natural attack'], [
        rule('bestiary-catalog-link', 'Using the Bestiary', 'The manual’s creature catalog is kept in the app’s Bestiary tab rather than duplicated here.', 'pp. 65–73', [
          'Use the Bestiary tab for creature statistics and combat entries. Apply the general combat, damage, injury, and resistance rules from Part III to those entries.',
        ], ['bestiary stats', 'creature catalog']),
      ]),
    ],
  },
  {
    id: 'equipment-catalog',
    title: 'Part VI — Arms, Armor, Equipment, and Vehicles',
    manualPages: 'pp. 74–118',
    description: 'Catalog entries are in the Equipment tab; this section covers how to read and use them.',
    subsections: [
      subsection('weapons-catalog', 'Weapons, weapon enhancements, and ammunition', 'pp. 74–104', ['weapons', 'unarmed weapons', 'melee', 'small guns', 'big guns', 'energy weapons', 'throwing', 'weapon enhancements', 'ammunition', 'ammo loading', 'ap ammo', 'jhp'], [
        rule('equipment-weapons-rules', 'Weapon entries and ammunition', 'Weapon stats, AP costs, range, strength requirements, condition, enhancements, and compatible ammunition are listed in the Equipment tab.', 'pp. 74–104', [
          'Use the weapon’s listed skill, range, damage, rate of fire, AP cost, minimum Strength, and ammunition. The manual separates weapon catalogs by combat skill and weapon type.',
          'Ammunition can change damage, target DT/DR, or other attack properties; use the selected ammunition’s equipment entry. AP and JHP ammunition cannot be mixed in one clip.',
          'The Quick Rules combat topics explain the attack roll, range, damage, bursts, and double-shots that use those catalog values.',
        ], ['unarmed skill weapons', 'melee skill weapons', 'small guns skill weapons', 'big guns skill weapons', 'energy weapons skill weapons', 'throwing skill weapons', 'weapon enhancements']),
      ]),
      subsection('gas-traps-catalog', 'Types of Gas and Acid; Traps and Mines', 'pp. 104–105', ['types of gas and acid', 'traps and mines', 'gas mask', 'mine'], [
        rule('equipment-hazards', 'Gas, acid, traps, and mines catalog', 'Specific effects and item statistics are listed in the Equipment tab.', 'pp. 104–105', [
          'Use the catalog entry for a gas, acid, trap, or mine’s radius and effects. General exposure, detection, disarming, and chain-detonation procedures are in Part III → Damage and Death and Life in the Wastes.',
        ], ['equipment gas', 'acid item', 'mine entry']),
      ]),
      subsection('armor-catalog', 'Armor, Helmets, and Equipment', 'pp. 105–111', ['armor', 'helmets', 'equipment', 'chems', 'armor class', 'dt', 'dr', 'radiation resistance', 'gas resistance'], [
        rule('equipment-armor-rules', 'Armor and equipment entries', 'Use the Equipment tab for item stats; apply the armor condition chart from Before Combat to worn armor.', 'pp. 105–111', [
          'Armor entries list AC and damage-type DT/DR, plus any resistances and skill penalties. Helmet compatibility and gas protection are item-specific.',
          'Chems list their benefit, duration, and addiction chance. The general addiction and withdrawal procedure is in Part III → Damage and Death.',
        ], ['armor catalog', 'helmet catalog', 'equipment list', 'chems']),
      ]),
      subsection('vehicle-catalog', 'Vehicles and Vehicle Enhancements', 'pp. 112–118', ['vehicles', 'cars', 'trucks', 'motorcycles', 'boats', 'aircraft', 'apcs', 'mobile artillery', 'tanks', 'vehicle enhancements'], [
        rule('equipment-vehicles-rules', 'Vehicle entries', 'The Equipment tab contains vehicle speeds, system HP, protection, capacity, weapons, and enhancements.', 'pp. 112–118', [
          'Use each vehicle’s entry with the vehicle combat and Pilot-roll procedures in Part III. Enhancements modify the listed vehicle or its operating rules as stated in their entries.',
        ], ['car catalog', 'truck catalog', 'motorcycle', 'boat', 'aircraft', 'tank']),
      ]),
    ],
  },
  {
    id: 'appendices',
    title: 'Appendices',
    manualPages: 'pp. 119–153',
    description: 'Maps, GM guidance, adventure material, examples, and references.',
    subsections: [
      subsection('appendix-resources', 'Appendices A–G', 'pp. 119–153', ['map', 'gm advice', 'writing adventures', 'sample characters', 'sample adventure', 'bibliography', 'recommended books', 'movies'], [
        rule('appendix-overview', 'Reference and adventure appendices', 'The appendices provide a map, GM advice, adventure-writing guidance, sample characters, an adventure, and further reading.', 'pp. 119–153', [
          'Appendix A is a map; B and C offer GM and adventure-writing guidance; D provides sample characters; E is a sample adventure; F–G list bibliography and recommended books and films.',
          'These appendices are not additional character or combat rule tables. The index on pp. 154–156 is included as searchable aliases throughout this reference.',
        ], ['appendix a', 'appendix b', 'appendix c', 'appendix d', 'appendix e', 'appendix f', 'appendix g']),
      ]),
    ],
  },
];

export interface QuickRuleSearchResult {
  section: QuickRuleSection;
  subsections: QuickRuleSubsection[];
}

function normalize(value: string): string {
  return value.toLocaleLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').trim();
}

export interface ManualSearchTextSegment {
  text: string;
  highlighted: boolean;
}

export function highlightManualSearchText(text: string, query: string): ManualSearchTextSegment[] {
  const terms = [...new Set(query.trim().split(/\s+/).filter(Boolean))]
    .sort((a, b) => b.length - a.length);
  if (terms.length === 0) return [{ text, highlighted: false }];

  const escapedTerms = terms.map(term => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const matcher = new RegExp(`(${escapedTerms.join('|')})`, 'giu');
  const segments: ManualSearchTextSegment[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = matcher.exec(text)) !== null) {
    if (match.index > cursor) {
      segments.push({ text: text.slice(cursor, match.index), highlighted: false });
    }
    segments.push({ text: match[0], highlighted: true });
    cursor = matcher.lastIndex;
  }

  if (cursor < text.length || segments.length === 0) {
    segments.push({ text: text.slice(cursor), highlighted: false });
  }
  return segments;
}

type TextTranslator = (value: string) => string;

function translatedSearchText(values: string[], translate: TextTranslator): string {
  return normalize(values.flatMap(value => [value, translate(value)]).join(' '));
}

function ruleSearchText(value: QuickRule, translate: TextTranslator): string {
  return translatedSearchText([
    value.id, value.title, value.preview, ...value.keywords, ...value.details,
    value.manualPages,
    ...(value.tables ?? []).flatMap(item => [
      item.title, ...item.columns,
      ...item.rows.flatMap(row => [row.label, ...row.values, row.description ?? '']),
    ]),
  ], translate);
}

export function allQuickRules(sections: readonly QuickRuleSection[] = QUICK_RULE_SECTIONS): QuickRule[] {
  return sections.flatMap(section => section.subsections.flatMap(child => child.rules));
}

export function searchQuickRuleSections(
  query: string,
  sections: readonly QuickRuleSection[] = QUICK_RULE_SECTIONS,
  translate: TextTranslator = value => value,
): QuickRuleSearchResult[] {
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  if (terms.length === 0) {
    return sections.map(section => ({ section, subsections: section.subsections }));
  }

  return sections.flatMap(section => {
    const sectionText = translatedSearchText(
      [section.title, section.description, section.manualPages],
      translate,
    );
    const sectionMatches = terms.some(term => sectionText.includes(term));
    const matchingSubsections = section.subsections.flatMap(child => {
      const childText = translatedSearchText(
        [child.title, child.manualPages, ...child.keywords],
        translate,
      );
      const childMatches = terms.some(term => childText.includes(term));
      const matchingRules = child.rules.filter(item => {
        const text = ruleSearchText(item, translate);
        return terms.some(term => text.includes(term));
      });
      if (matchingRules.length > 0 || childMatches) {
        return [{ ...child, rules: matchingRules }];
      }
      return [];
    });
    return sectionMatches || matchingSubsections.length > 0
      ? [{ section, subsections: matchingSubsections }]
      : [];
  });
}

export function countQuickRuleResults(results: readonly QuickRuleSearchResult[]): number {
  return results.reduce((total, result) =>
    total + result.subsections.reduce((count, child) => count + child.rules.length, 0), 0);
}
