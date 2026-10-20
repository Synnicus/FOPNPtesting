import { DEFAULT_SKILLS } from '../context/types.ts';
import { createCharacterBundle } from '../data/portableExports.ts';

const [id, name] = process.argv.slice(2);

if (!id || !name) {
  throw new Error('Pass a unique character ID and display name.');
}

const character = {
  id,
  name,
  type: 'pc',
  race: 'human',
  level: 1,
  xp: 0,
  special: {
    strength: 5,
    perception: 5,
    endurance: 5,
    charisma: 5,
    intelligence: 5,
    agility: 5,
    luck: 5,
  },
  maxHp: 30,
  currentHp: 30,
  armorClass: 5,
  tempAC: 0,
  maxAP: 7,
  currentAP: 7,
  position: 'standing',
  sequence: 10,
  skills: { ...DEFAULT_SKILLS },
  taggedSkills: [],
  unspentSkillPoints: 0,
  perks: [],
  radiationResistance: 0,
  gasResistance: 0,
  electricityResistance: 0,
  weaponAmmoStates: [],
  injuries: [
    {
      id: `${id}-attributed`,
      location: 'rightArm',
      severity: 'broken',
      description: 'A raider shot the character in the right arm.',
      toHitPenalty: -3,
      skillPenalty: { smallGuns: -2 },
      movementPenalty: 0,
      isActive: true,
      source: 'Raider with Hunting Rifle',
    },
    {
      id: `${id}-legacy`,
      location: 'leftArm',
      severity: 'crippled',
      description: 'The left arm was already crippled in an older export.',
      toHitPenalty: -2,
      skillPenalty: {},
      movementPenalty: 0,
      isActive: true,
    },
  ],
  isKnockedOut: false,
  knockOutRoundsLeft: 0,
  conditions: [],
};

const bundle = createCharacterBundle(character, [], []);
process.stdout.write(JSON.stringify(bundle));
