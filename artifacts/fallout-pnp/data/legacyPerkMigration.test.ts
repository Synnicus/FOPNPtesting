import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { URL } from 'node:url';
import type { Character } from '../context/types.ts';
import { migrateLegacyTraitPerks } from './legacyPerkMigration.ts';

function character(perks: Character['perks'], traits: string[] = []): Character {
  return {
    id: 'legacy-character',
    name: 'Legacy Character',
    type: 'player',
    race: 'human',
    level: 1,
    xp: 0,
    hp: 20,
    maxHp: 20,
    currentHp: 20,
    currentAP: 5,
    maxAP: 5,
    armorClass: 5,
    sequence: 10,
    special: { strength: 5, perception: 5, endurance: 5, charisma: 5, intelligence: 5, agility: 5, luck: 5 },
    skills: {
      smallGuns: 25, bigGuns: 10, energyWeapons: 10, meleeWeapons: 20, unarmed: 20,
      throwing: 20, firstAid: 20, doctor: 10, sneak: 20, lockpick: 20, steal: 15,
      traps: 20, science: 20, repair: 15, speech: 15, barter: 15, gambling: 15,
      outdoorsman: 20, pilot: 10,
    },
    taggedSkills: [],
    perks,
    traits,
    unspentSkillPoints: 0,
    karma: 0,
    isKnockedOut: false,
    isActive: true,
  } as unknown as Character;
}

test('old duplicate perk ids migrate to matching traits and leave other perks intact', () => {
  const original = character([
    { perkId: 'finesse', rank: 1 },
    { perkId: 'Fast-Metabolism', rank: 1 },
    { perkId: 'chem_resistant', rank: 1 },
    { perkId: 'toughness', rank: 2 },
  ]);

  const migrated = migrateLegacyTraitPerks(original);

  assert.deepEqual(migrated.traits, ['finesse', 'fast_metabolism', 'chem_resistant']);
  assert.deepEqual(migrated.perks, [{ perkId: 'toughness', rank: 2 }]);
});

test('migration is idempotent, avoids duplicate traits, and does not enforce the new trait cap on old saves', () => {
  const original = character([
    { perkId: 'finesse', rank: 1 },
    { perkId: 'fast_metabolism', rank: 1 },
  ], ['finesse', 'gifted', 'small_frame']);

  const first = migrateLegacyTraitPerks(original);
  const second = migrateLegacyTraitPerks(first);

  assert.deepEqual(first.traits, ['finesse', 'gifted', 'small_frame', 'fast_metabolism']);
  assert.deepEqual(second, first);
  assert.deepEqual(first.perks, []);
});

test('inactive legacy perk records are removed without granting a trait', () => {
  const migrated = migrateLegacyTraitPerks(character([
    { perkId: 'chem_resistant', rank: 0 },
    { perkId: 'toughness', rank: 1 },
  ]));

  assert.deepEqual(migrated.traits, []);
  assert.deepEqual(migrated.perks, [{ perkId: 'toughness', rank: 1 }]);
});

test('removed duplicate trait perks are no longer offered in the perk catalog', () => {
  const source = readFileSync(new URL('./perks.ts', import.meta.url), 'utf8');
  for (const id of ['finesse', 'fast_metabolism', 'chem_resistant']) {
    assert.doesNotMatch(source, new RegExp(`id:\\s*['"]${id}['"]`), `${id} must be selected through Traits, not Perks`);
  }
});

test('campaign loads and character add/update paths apply the migration', () => {
  const appContext = readFileSync(new URL('../context/AppContext.tsx', import.meta.url), 'utf8');
  assert.match(appContext, /let normalized = migrateLegacyTraitPerks\(character\)/);
  assert.match(appContext, /characters:\s*\(parsed\.characters \?\? \[\]\)\.map\(normalizeCharacter\)/);
  assert.equal([...appContext.matchAll(/migrateLegacyTraitPerks\(char\)/g)].length, 2);
});
