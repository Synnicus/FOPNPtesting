import {
  CRITICAL_FAILURE_TABLE,
  CRITICAL_HIT_TABLE,
  TARGETED_CRIT_EFFECTS,
} from './criticals.ts';

export interface QuickRuleTableRow {
  label: string;
  values: string[];
  description?: string;
}

export interface QuickRuleTable {
  title: string;
  columns: string[];
  rows: QuickRuleTableRow[];
}

export interface QuickRule {
  id: string;
  title: string;
  preview: string;
  keywords: string[];
  details: string[];
  manualPages: string;
  tables?: QuickRuleTable[];
}

const targetedShotTable = (attackType: 'melee' | 'ranged'): QuickRuleTable => ({
  title: `Targeted-shot penalties — ${attackType}`,
  columns: ['To-hit penalty'],
  rows: attackType === 'melee'
    ? [
        { label: 'Torso', values: ['0%'] },
        { label: 'Legs', values: ['−10%'] },
        { label: 'Arms / groin', values: ['−15%'] },
        { label: 'Head', values: ['−20%'] },
        { label: 'Eyes', values: ['−30%'] },
      ]
    : [
        { label: 'Torso', values: ['0%'] },
        { label: 'Legs', values: ['−20%'] },
        { label: 'Arms / groin', values: ['−30%'] },
        { label: 'Head', values: ['−40%'] },
        { label: 'Eyes', values: ['−60%'] },
      ],
});

export const QUICK_RULES: QuickRule[] = [
  {
    id: 'attack-roll',
    title: 'Attack Roll',
    preview: 'Build your chance to hit from skill and combat modifiers.',
    keywords: ['chance to hit', 'cth', 'to-hit', 'percentile', 'skill', 'light', 'cover', 'armor class'],
    details: [
      'Start with the skill for the weapon being used. The target must be visible and in range.',
      'Apply range, light, target Armor Class, cover, weapon bonuses or penalties, and any targeted-shot penalty. The manual’s formula is: Base Skill − Range − Light − Armor Class − Cover ± other modifiers − Targeted Shot.',
      'After the final chance is calculated, roll d100. A roll at or below that chance hits. If the chance is below 0%, the attacker may cancel, but spent AP are not returned.',
    ],
    manualPages: 'pp. 28–29',
  },
  {
    id: 'range-penalty',
    title: 'Range Penalty',
    preview: 'Add character range to weapon range; subtract 3% per extra hex.',
    keywords: ['range', 'perception', 'strength', 'hexes', 'meters', 'thrown', 'double shot'],
    details: [
      'The character’s Perception gives a base range in hexes. Add that range to the weapon’s listed range. Each hex beyond the combined range applies a −3% to-hit penalty.',
      'Thrown weapons can be affected by both Strength and Perception range limits. The manual says to substitute Strength in the range table for thrown-weapon range where applicable. A shotgun double-shot reduces that weapon’s effective range by 3 hexes.',
    ],
    manualPages: 'p. 28',
    tables: [{
      title: 'Character range by Perception or Strength',
      columns: ['Range'],
      rows: [
        { label: '1', values: ['1 hex'] },
        { label: '2', values: ['3 hexes'] },
        { label: '3', values: ['5 hexes'] },
        { label: '4', values: ['7 hexes'] },
        { label: '5', values: ['9 hexes'] },
        { label: '6', values: ['11 hexes'] },
        { label: '7', values: ['13 hexes'] },
        { label: '8', values: ['15 hexes'] },
        { label: '9', values: ['17 hexes'] },
        { label: '10', values: ['19 hexes'] },
      ],
    }],
  },
  {
    id: 'damage',
    title: 'Damage',
    preview: 'Apply armor’s flat Damage Threshold, then its Damage Resistance.',
    keywords: ['damage', 'initial damage', 'dt', 'dr', 'threshold', 'resistance', 'armor'],
    details: [
      'Roll the weapon’s damage. For a burst, roll damage separately for each bullet that hits. The manual’s calculation is: (Initial Damage − DT) − ((Initial Damage − DT) × DR), rounding down.',
      'Damage Threshold is a flat amount absorbed first. Damage Resistance reduces the damage remaining by a percentage. Combine the relevant armor protection for the attack’s damage type.',
    ],
    manualPages: 'p. 32',
  },
  {
    id: 'criticals',
    title: 'Criticals',
    preview: 'A successful attack can become critical; aimed areas add critical chance.',
    keywords: ['critical', 'crit chance', 'luck', 'targeted', 'body part', '1d10', 'critical hits'],
    details: [
      'Critical Chance starts at Luck. A successful attack is critical when its to-hit roll is at or below the character’s Critical Chance. For a burst, only one bullet against a target can be a critical hit.',
      'The More Criticals perk adds +5 percentage points to Critical Chance per rank. A targeted shot also adds a bonus based on the area; a targeted critical uses that area’s effect. For a non-targeted critical, roll 1d10 on the Critical Hits table.',
    ],
    manualPages: 'pp. 18, 33–34, 54',
    tables: [
      {
        title: 'Critical-chance bonus for targeted shots',
        columns: ['Bonus'],
        rows: [
          { label: 'Arms', values: ['+10%'] },
          { label: 'Legs / groin', values: ['+20%'] },
          { label: 'Head', values: ['+25%'] },
          { label: 'Eyes', values: ['+30%'] },
        ],
      },
      {
        title: 'Effects of targeted critical hits',
        columns: ['Effect'],
        rows: [
          { label: 'Torso', values: [TARGETED_CRIT_EFFECTS.torso.label] },
          { label: 'Head', values: [TARGETED_CRIT_EFFECTS.head.label] },
          { label: 'Eyes', values: [TARGETED_CRIT_EFFECTS.eyes.label] },
          { label: 'Groin', values: [TARGETED_CRIT_EFFECTS.groin.label] },
          { label: 'Arms', values: [TARGETED_CRIT_EFFECTS.arms.label] },
          { label: 'Legs', values: [TARGETED_CRIT_EFFECTS.legs.label] },
        ],
      },
      {
        title: 'Critical Hits (1d10)',
        columns: ['Result'],
        rows: CRITICAL_HIT_TABLE.map(entry => ({
          label: String(entry.roll),
          values: [entry.title],
          description: entry.description,
        })),
      },
    ],
  },
  {
    id: 'critical-failure',
    title: 'Critical Failure',
    preview: 'A missed attack on 97–100 triggers the GM’s 1d10 failure table.',
    keywords: ['critical failure', 'miss', '97', '98', '99', '100', 'jam', 'break', 'weapon'],
    details: [
      'The manual gives a 3% chance for a critical failure. If an attack fails on a roll of 97–100, the GM rolls 1d10 on the Critical Failure table.',
    ],
    manualPages: 'p. 31',
    tables: [{
      title: 'Critical Failure (1d10)',
      columns: ['Outcome'],
      rows: CRITICAL_FAILURE_TABLE.map(entry => ({
        label: String(entry.roll),
        values: [entry.title],
        description: entry.description,
      })),
    }],
  },
  {
    id: 'targeted-ranged',
    title: 'Targeted Shot — Ranged',
    preview: 'Ranged attacks take a larger penalty for aiming at specific areas.',
    keywords: ['targeted', 'ranged', 'gun', 'shot', 'aim', 'head', 'eyes', 'legs', 'arms', 'groin', 'torso'],
    details: [
      'Choose a body area when making a targeted ranged attack, then subtract its penalty from the chance to hit. A torso shot has no penalty. Targeted shots can increase the chance of a critical hit to that area.',
    ],
    manualPages: 'p. 29',
    tables: [targetedShotTable('ranged')],
  },
  {
    id: 'targeted-melee',
    title: 'Targeted Shot — Melee',
    preview: 'Melee attacks use different, generally smaller targeted-shot penalties.',
    keywords: ['targeted', 'melee', 'unarmed', 'hand to hand', 'shot', 'aim', 'head', 'eyes', 'legs', 'arms', 'groin', 'torso'],
    details: [
      'Choose a body area when making a targeted melee or unarmed attack, then subtract its penalty from the chance to hit. A torso attack has no penalty. Targeted attacks may improve the chance of a critical hit to that area.',
    ],
    manualPages: 'p. 29',
    tables: [targetedShotTable('melee')],
  },
  {
    id: 'positions',
    title: 'Positions',
    preview: 'Crouching or going prone improves gun accuracy but changes movement and AC.',
    keywords: ['crouch', 'crouching', 'prone', 'standing', 'movement', 'agility', 'armor class', 'ap'],
    details: [
      'Changing position costs 2 AP, except going from prone to standing, which costs 4 AP. Crouching grants +10% to Small Guns, Big Guns, and Energy Weapons to-hit; movement costs 2 AP per hex, and Agility-based AC is reduced to 3 unless it was already below 3.',
      'Prone grants +25% to those gun skills; movement costs 4 AP per hex, and Agility-based AC is reduced to 1. A prone character cannot make melee or unarmed attacks. These position bonuses do not apply to mounted Big Guns.',
    ],
    manualPages: 'p. 27',
  },
  {
    id: 'weapon-condition',
    title: 'Weapon Condition',
    preview: 'A missed attack wears the weapon; 8 filled boxes reduce to-hit by 10%.',
    keywords: ['weapon', 'condition', 'durability', 'boxes', 'jam', 'broken', 'miss', 'repair'],
    details: [
      'Each missed attack with a weapon fills one condition box. The more boxes filled, the worse its condition. At 8 or more filled boxes, the weapon gives a −10% to-hit penalty. When all 10 boxes are filled, it is jammed or broken and must be repaired or discarded.',
      'The GM may also mark condition for other damage to the weapon. The manual describes repairs under Weapon Condition.',
    ],
    manualPages: 'pp. 23, 31',
  },
  {
    id: 'action-points',
    title: 'Action Points',
    preview: 'Spend AP to act, or defend and add remaining AP to Armor Class.',
    keywords: ['ap', 'action points', 'attack', 'single', 'targeted', 'burst', 'defend', 'armor class'],
    details: [
      'Combat actions use Action Points. Attack costs depend on the weapon and whether the character makes a normal, targeted, or burst attack. A turn ends when the character has spent all AP or chooses to defend.',
      'When defending, remaining AP are added to Armor Class until the character’s next turn. Characters using a skill in combat do not receive Armor Class bonuses from Agility or unused AP while performing the skill.',
    ],
    manualPages: 'pp. 25–28',
  },
  {
    id: 'injuries',
    title: 'Injuries',
    preview: 'Crippled limbs limit movement or weapon use; blindness lowers Perception to 1.',
    keywords: ['injury', 'crippled', 'broken limb', 'leg', 'arm', 'blindness', 'perception', 'agility'],
    details: [
      'A crippled leg halves movement, so moving one hex costs 2 AP, and halves effective Agility. Two crippled legs reduce movement to one hex per combat round and effective Agility to 1. Each crippled arm reduces Agility by 1; one prevents two-handed weapon use, and two prevent weapon use.',
      'Blindness applies the penalties for total darkness and reduces Perception to 1. The manual says crippled limbs and blindness require treatment by a Doctor (or Repair for a robot).',
    ],
    manualPages: 'pp. 41–42',
  },
];

function normalizeSearchText(value: string): string {
  return value
    .toLocaleLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function searchableText(rule: QuickRule): string {
  return [
    rule.title,
    rule.preview,
    rule.keywords.join(' '),
    rule.details.join(' '),
    rule.manualPages,
    ...(rule.tables ?? []).flatMap(table => [
      table.title,
      table.columns.join(' '),
      ...table.rows.flatMap(row => [row.label, row.values.join(' '), row.description ?? '']),
    ]),
  ].join(' ');
}

export function searchQuickRules(query: string, rules: readonly QuickRule[] = QUICK_RULES): QuickRule[] {
  const terms = normalizeSearchText(query).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [...rules];

  return rules.filter(rule => {
    const text = normalizeSearchText(searchableText(rule));
    return terms.every(term => text.includes(term));
  });
}
