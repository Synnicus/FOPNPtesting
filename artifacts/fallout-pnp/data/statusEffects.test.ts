import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_SKILLS, type Character } from '../context/types.ts';
import {
  clearTemporaryCharacterEffects,
  clearTemporaryEffectsFromActiveCharacters,
} from './statusEffects.ts';
import { createCombatInjury, getInjuryCauseText } from './injuries.ts';
import { createCampaignBundle, parseCampaignFile } from './portableExports.ts';

function makeCharacter(overrides: Record<string, unknown> = {}): Character {
  return {
    id: 'active-character',
    name: 'Courier',
    type: 'pc',
    race: 'human',
    level: 1,
    xp: 0,
    special: { strength: 5, perception: 5, endurance: 5, charisma: 5, intelligence: 5, agility: 5, luck: 5 },
    skills: { ...DEFAULT_SKILLS },
    taggedSkills: [],
    unspentSkillPoints: 0,
    armorClass: 5,
    tempAC: 0,
    maxAP: 7,
    currentAP: 7,
    sequence: 10,
    radiationResistance: 0,
    gasResistance: 0,
    electricityResistance: 0,
    weaponAmmoStates: [],
    conditions: ['minorWithdrawal', 'drunk'],
    effects: [
      { id: 'poison', kind: 'other', poisonType: 'B', poisonCount: 2, name: 'Poisoned', isActive: true },
      { id: 'chem', kind: 'chem', chemId: 'jet', name: 'Jet', isActive: true },
    ],
    isKnockedOut: true,
    knockOutRoundsLeft: 3,
    combatDefenseSuppressed: true,
    areaEffects: [{
      id: 'fire',
      kind: 'fire',
      name: 'On fire',
      damageDieCount: 1,
      damageDie: 6,
      damageBonus: 0,
      damageType: 'fire',
      persistent: true,
    }],
    injuries: [{
      id: 'broken-arm',
      location: 'leftArm',
      severity: 'broken',
      description: 'Broken left arm',
      toHitPenalty: 0,
      skillPenalty: {},
      movementPenalty: 0,
      isActive: true,
      source: 'combat',
    }],
    currentHp: 6,
    maxHp: 30,
    accumulatedRadiation: 40,
    position: 'prone',
    equippedBodyArmorId: 'combat-armor',
    perks: [{ perkId: 'toughness', rank: 1 }],
    ...overrides,
  } as unknown as Character;
}

test('clears temporary statuses while preserving injuries and persistent character data', () => {
  const character = makeCharacter();
  const cleared = clearTemporaryCharacterEffects(character);

  assert.deepEqual(cleared.effects, []);
  assert.deepEqual(cleared.conditions, []);
  assert.equal(cleared.isKnockedOut, false);
  assert.equal(cleared.knockOutRoundsLeft, 0);
  assert.equal(cleared.combatDefenseSuppressed, false);
  assert.deepEqual(cleared.areaEffects, []);
  assert.deepEqual(cleared.injuries, character.injuries);
  assert.equal(cleared.currentHp, 6);
  assert.equal(cleared.accumulatedRadiation, 40);
  assert.equal(cleared.equippedBodyArmorId, 'combat-armor');
  assert.deepEqual(cleared.perks, character.perks);
  assert.equal(character.isKnockedOut, true);
});

test('healing injuries deactivates them without deleting their history', () => {
  const attributedInjury = createCombatInjury(
    'broken-arm',
    { location: 'leftArm', description: 'Broken left arm' },
    'Raider',
    '10mm Pistol',
  );
  const character = makeCharacter({ injuries: [attributedInjury] });
  const cleared = clearTemporaryCharacterEffects(character, true);

  assert.equal(cleared.injuries.length, 1);
  assert.equal(cleared.injuries[0].isActive, false);
  assert.equal(cleared.injuries[0].description, 'Broken left arm');
  assert.equal(cleared.injuries[0].source, 'Raider with 10mm Pistol');
  assert.equal(getInjuryCauseText(cleared.injuries[0].source), 'Caused by: Raider with 10mm Pistol');
  assert.equal(character.injuries[0].isActive, true);
});

test('cleared statuses and active injuries persist through a campaign save/reload round trip', () => {
  const active = makeCharacter();
  const stored = makeCharacter({ id: 'stored-character', inStorage: true });
  const storedBeforeCleanup = JSON.parse(JSON.stringify(stored));

  const saved = {
    characters: clearTemporaryEffectsFromActiveCharacters([active, stored]),
  };
  const reloaded = JSON.parse(JSON.stringify(saved)) as { characters: Character[] };
  const [reloadedActive, reloadedStored] = reloaded.characters;

  assert.deepEqual(reloadedActive.effects, []);
  assert.deepEqual(reloadedActive.conditions, []);
  assert.equal(reloadedActive.isKnockedOut, false);
  assert.equal(reloadedActive.knockOutRoundsLeft, 0);
  assert.equal(reloadedActive.combatDefenseSuppressed, false);
  assert.deepEqual(reloadedActive.areaEffects, []);
  assert.equal(reloadedActive.injuries[0].isActive, true);
  assert.deepEqual(reloadedStored, storedBeforeCleanup);
});

test('healed injuries remain inactive after a campaign save/reload round trip', () => {
  const attributedInjury = createCombatInjury(
    'broken-arm',
    { location: 'leftArm', description: 'Broken left arm' },
    'Raider',
    '10mm Pistol',
  );
  const active = makeCharacter({ injuries: [attributedInjury] });
  const stored = makeCharacter({ id: 'stored-character', inStorage: true });
  const storedBeforeCleanup = JSON.parse(JSON.stringify(stored));

  const saved = {
    characters: clearTemporaryEffectsFromActiveCharacters([active, stored], true),
  };
  const reloaded = JSON.parse(JSON.stringify(saved)) as { characters: Character[] };
  const [reloadedActive, reloadedStored] = reloaded.characters;

  assert.deepEqual(reloadedActive.effects, []);
  assert.deepEqual(reloadedActive.conditions, []);
  assert.equal(reloadedActive.isKnockedOut, false);
  assert.deepEqual(reloadedActive.areaEffects, []);
  assert.equal(reloadedActive.injuries[0].isActive, false);
  assert.equal(reloadedActive.injuries[0].description, 'Broken left arm');
  assert.equal(reloadedActive.injuries[0].source, 'Raider with 10mm Pistol');
  assert.equal(getInjuryCauseText(reloadedActive.injuries[0].source), 'Caused by: Raider with 10mm Pistol');
  assert.deepEqual(reloadedStored, storedBeforeCleanup);
});

test('cleaned statuses and healed injuries survive switching saved campaigns', () => {
  const injury = createCombatInjury(
    'broken-arm',
    { location: 'leftArm', description: 'Broken left arm' },
    'Raider',
    '10mm Pistol',
  );
  const active = makeCharacter({ injuries: [injury] });
  const cleanedState = {
    campaignName: 'Cleaned campaign',
    characters: clearTemporaryEffectsFromActiveCharacters([active], true),
    customWeapons: [],
    customArmor: [],
    customBestiaryTemplates: [],
    initiativeEntries: [],
    currentRound: 1,
    combatActive: false,
    activeEntryId: null,
    lootTables: [],
  };
  const savedRecordJson = JSON.stringify(createCampaignBundle(cleanedState, []));

  // Loading another library entry replaces the active state, but not the
  // saved record for the cleaned campaign.
  const otherCampaignJson = JSON.stringify(createCampaignBundle({
    ...cleanedState,
    campaignName: 'Other campaign',
    characters: [makeCharacter({ id: 'other-character', name: 'Other character' })],
  }, []));
  const otherCampaign = parseCampaignFile(otherCampaignJson);
  assert.equal(otherCampaign.ok, true);
  if (!otherCampaign.ok) return;

  const reloaded = parseCampaignFile(savedRecordJson);
  assert.equal(reloaded.ok, true);
  if (!reloaded.ok || reloaded.source !== 'portable') return;

  const [reloadedCharacter] = reloaded.bundle.state.characters;
  assert.deepEqual(reloadedCharacter.effects, []);
  assert.deepEqual(reloadedCharacter.conditions, []);
  assert.equal(reloadedCharacter.isKnockedOut, false);
  assert.equal(reloadedCharacter.knockOutRoundsLeft, 0);
  assert.equal(reloadedCharacter.injuries[0].isActive, false);
  assert.equal(reloadedCharacter.injuries[0].description, 'Broken left arm');
  assert.equal(reloadedCharacter.injuries[0].source, 'Raider with 10mm Pistol');
  assert.equal(reloaded.bundle.state.campaignName, 'Cleaned campaign');
  assert.equal(reloadedCharacter.accumulatedRadiation, 40);
  assert.equal(reloadedCharacter.currentHp, 6);
  assert.equal(reloadedCharacter.equippedBodyArmorId, 'combat-armor');
});
