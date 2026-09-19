import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_SKILLS } from '../context/types.ts';
import type { Armor, Character, Weapon } from '../context/types.ts';
import {
  createCampaignBundle,
  createCharacterBundle,
  createEquipmentBundle,
  parseCampaignFile,
  parseIndividualFile,
  portraitAsset,
  restoreCampaignPortraits,
  restoreCharacterPortrait,
} from './portableExports.ts';

const character: Character = {
  id: 'character-1',
  name: 'Courier',
  type: 'pc',
  race: 'human',
  level: 1,
  xp: 0,
  portrait: 'file:///old-device/courier.jpg',
  portraitFit: 'cover',
  portraitOffset: { x: 0.25, y: 0.75 },
  special: { strength: 5, perception: 5, endurance: 5, charisma: 5, intelligence: 5, agility: 5, luck: 5 },
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
  equippedWeaponId: 'custom-rifle',
  inventoryWeaponIds: ['custom-rifle', 'built-in-pistol'],
  equippedBodyArmorId: 'custom-coat',
  weaponAmmoStates: [],
  injuries: [],
  isKnockedOut: false,
  knockOutRoundsLeft: 0,
  conditions: [],
};

const weaponTemplate: Weapon = {
  id: 'template',
  name: 'Template',
  category: 'smallGuns',
  damageType: 'normal',
  damageDieCount: 1,
  damageDie: 6,
  damageBonus: 0,
  skill: 'smallGuns',
  burstLimit: 1,
  isDoubleShot: false,
  magazineSize: 6,
  weight: 3,
  minStr: 2,
  rangeNormal: 10,
  knockdownChance: 0,
  mods: [],
  isCustom: true,
};
const customWeapon = { ...weaponTemplate, id: 'custom-rifle', name: 'Courier Rifle' };
const unrelatedWeapon = { ...weaponTemplate, id: 'other-custom', name: 'Other' };
const customArmor: Armor = {
  id: 'custom-coat',
  name: 'Courier Coat',
  slot: 'body',
  dtNormal: 0,
  dtLaser: 0,
  dtFire: 0,
  dtPlasma: 0,
  dtExplosion: 0,
  drNormal: 10,
  drLaser: 0,
  drFire: 0,
  drPlasma: 0,
  drExplosion: 0,
  acBonus: 2,
  weight: 4,
  isCustom: true,
};

const state = {
  characters: [character, { ...character, id: 'character-2', name: 'Companion', portrait: undefined }],
  customWeapons: [customWeapon, unrelatedWeapon],
  customArmor: [customArmor],
  customBestiaryTemplates: [],
  initiativeEntries: [],
  currentRound: 1,
  combatActive: false,
  activeEntryId: null,
};

test('campaign portrait assets restore only to their matching character id', async () => {
  const asset = portraitAsset(character.id, 'image/jpeg', 'AQID');
  assert.ok(asset);
  const bundle = createCampaignBundle(state, [asset]);
  assert.equal(bundle.state.characters[0].portrait, undefined);
  assert.deepEqual(bundle.state.characters[0].portraitOffset, { x: 0.25, y: 0.75 });

  const restored = await restoreCampaignPortraits(bundle, async image =>
    `restored://${image.characterId}/${image.mimeType}`);
  assert.equal(restored.restored, 1);
  assert.equal(restored.failed, 0);
  assert.equal(restored.state.characters[0].portrait, 'restored://character-1/image/jpeg');
  assert.equal(restored.state.characters[1].portrait, undefined);
});

test('an unreadable portrait does not block the rest of a campaign import', async () => {
  const asset = portraitAsset(character.id, 'image/png', 'AQID');
  assert.ok(asset);
  const restored = await restoreCampaignPortraits(
    createCampaignBundle(state, [asset]),
    async () => { throw new Error('unreadable'); },
  );
  assert.equal(restored.restored, 0);
  assert.equal(restored.failed, 1);
  assert.equal(restored.state.characters.length, 2);
});

test('legacy campaign JSON remains accepted', () => {
  const parsed = parseCampaignFile(JSON.stringify(state));
  assert.equal(parsed.ok, true);
  if (parsed.ok) assert.equal(parsed.source, 'legacy');
});

test('portable campaign exports migrate the legacy radiation flag and prefer Hardcore', () => {
  const legacyBundle = createCampaignBundle({
    ...state,
    fallout3RadiationDebuffs: true,
  }, []);
  assert.equal(legacyBundle.state.hardcoreRadiationRules, true);
  assert.equal('fallout3RadiationDebuffs' in legacyBundle.state, false);

  const explicitOffBundle = createCampaignBundle({
    ...state,
    fallout3RadiationDebuffs: true,
    hardcoreRadiationRules: false,
  }, []);
  assert.equal(explicitOffBundle.state.hardcoreRadiationRules, false);
  assert.equal('fallout3RadiationDebuffs' in explicitOffBundle.state, false);
});

test('portable characters accept legacy missing radiation and validate a present meter', () => {
  const legacy = createCharacterBundle(character, [customWeapon], [customArmor]);
  assert.equal(parseIndividualFile(JSON.stringify(legacy)).ok, true);
  const current = createCharacterBundle({ ...character, accumulatedRadiation: 425 }, [customWeapon], [customArmor]);
  assert.equal(parseIndividualFile(JSON.stringify(current)).ok, true);
  const invalid = { ...current, character: { ...current.character, accumulatedRadiation: 425.5 } };
  assert.equal(parseIndividualFile(JSON.stringify(invalid)).ok, false);
});

test('unembedded portrait URIs are removed rather than exporting device or network dependencies', () => {
  const bundle = createCampaignBundle({
    ...state,
    characters: [{ ...character, portrait: 'https://example.invalid/private-portrait.jpg' }],
  }, []);
  assert.equal(bundle.state.characters[0].portrait, undefined);
  assert.equal(bundle.assets.length, 0);
});

test('standalone character exports include only referenced custom equipment', () => {
  const bundle = createCharacterBundle(
    character,
    [customWeapon, unrelatedWeapon],
    [customArmor],
    portraitAsset(character.id, 'image/jpeg', 'AQID'),
  );
  assert.deepEqual(bundle.customWeapons.map(weapon => weapon.id), ['custom-rifle']);
  assert.deepEqual(bundle.customArmor.map(armor => armor.id), ['custom-coat']);
  assert.equal(bundle.assets[0].characterId, character.id);
  assert.equal(bundle.character.portrait, undefined);
});

test('standalone equipment exports identify their item type', () => {
  const bundle = createEquipmentBundle('weapon', customWeapon);
  assert.equal(bundle.kind, 'equipment');
  assert.equal(bundle.equipmentType, 'weapon');
  assert.equal(bundle.item.id, customWeapon.id);
});

test('individual character files validate dependencies and restore only their matching portrait', async () => {
  const asset = portraitAsset(character.id, 'image/jpeg', 'AQID');
  assert.ok(asset);
  const exported = createCharacterBundle(character, [customWeapon], [customArmor], asset);
  const parsed = parseIndividualFile(JSON.stringify({
    ...exported,
    character: { ...exported.character, portrait: 'file:///attacker-controlled.jpg' },
  }));
  assert.equal(parsed.ok, true);
  if (parsed.ok && parsed.kind === 'character') {
    assert.equal(parsed.bundle.character.portrait, undefined);
    assert.equal(parsed.bundle.customWeapons[0].id, customWeapon.id);
    assert.equal(parsed.bundle.customArmor[0].id, customArmor.id);
    const restored = await restoreCharacterPortrait(
      parsed.bundle,
      async image => `restored://${image.characterId}`,
    );
    assert.equal(restored.character.portrait, `restored://${character.id}`);
    assert.equal(restored.restored, 1);
  }
});

test('individual character files ignore corrupt, duplicate, and mismatched portrait assets', () => {
  const asset = portraitAsset(character.id, 'image/png', 'AQID');
  assert.ok(asset);
  const exported = createCharacterBundle(character, [customWeapon], [customArmor], asset);
  const parsed = parseIndividualFile(JSON.stringify({
    ...exported,
    assets: [
      asset,
      asset,
      { ...asset, characterId: 'someone-else' },
      { ...asset, base64: 'invalid!' },
    ],
  }));
  assert.equal(parsed.ok, true);
  if (parsed.ok && parsed.kind === 'character') {
    assert.equal(parsed.bundle.assets.length, 1);
    assert.equal(parsed.ignoredAssets, 3);
  }
});

test('individual equipment files accept only structurally valid custom equipment', () => {
  const weapon = parseIndividualFile(JSON.stringify(createEquipmentBundle('weapon', customWeapon)));
  assert.equal(weapon.ok, true);
  if (weapon.ok) {
    assert.equal(weapon.kind, 'equipment');
    if (weapon.kind === 'equipment') assert.equal(weapon.bundle.item.id, customWeapon.id);
  }

  const builtIn = parseIndividualFile(JSON.stringify(createEquipmentBundle(
    'weapon',
    { ...customWeapon, isCustom: false },
  )));
  assert.deepEqual(builtIn, {
    ok: false,
    error: 'The equipment export is incomplete, damaged, or not custom equipment.',
  });
});

test('damaged individual character files are rejected before any portrait materialization', () => {
  const exported = createCharacterBundle(character, [customWeapon], [customArmor], null);
  const parsed = parseIndividualFile(JSON.stringify({
    ...exported,
    character: { id: character.id },
  }));
  assert.deepEqual(parsed, {
    ok: false,
    error: 'The character export is incomplete or damaged.',
  });
});

test('individual asset files are rejected by campaign import', () => {
  const parsed = parseCampaignFile(JSON.stringify(createEquipmentBundle('armor', customArmor)));
  assert.deepEqual(parsed, {
    ok: false,
    error: 'Choose a campaign export rather than an individual asset file.',
  });
});

test('portable campaign import ignores corrupt and duplicate portrait assets', () => {
  const asset = portraitAsset(character.id, 'image/jpeg', 'AQID');
  assert.ok(asset);
  const bundle = createCampaignBundle(state, [asset]);
  const parsed = parseCampaignFile(JSON.stringify({
    ...bundle,
    assets: [
      asset,
      asset,
      { ...asset, characterId: 'unknown-character' },
      { ...asset, characterId: 'character-2', base64: 'not-base64!' },
    ],
  }));
  assert.equal(parsed.ok, true);
  if (parsed.ok && parsed.source === 'portable') {
    assert.equal(parsed.bundle.assets.length, 1);
    assert.equal(parsed.ignoredAssets, 3);
  }
});

test('portable campaign import rejects duplicate character ids before restoring files', () => {
  const bundle = createCampaignBundle({
    ...state,
    characters: [character, { ...character }],
  }, []);
  const parsed = parseCampaignFile(JSON.stringify(bundle));
  assert.deepEqual(parsed, {
    ok: false,
    error: 'The campaign export is incomplete or damaged.',
  });
});

test('portable imports strip injected portrait URIs unless a validated asset restores them', async () => {
  const bundle = createCampaignBundle(state, []);
  const parsed = parseCampaignFile(JSON.stringify({
    ...bundle,
    state: {
      ...bundle.state,
      characters: bundle.state.characters.map((item, index) => index === 0
        ? { ...item, portrait: 'https://tracking.invalid/portrait.jpg' }
        : item),
    },
  }));
  assert.equal(parsed.ok, true);
  if (parsed.ok && parsed.source === 'portable') {
    assert.equal(parsed.bundle.state.characters[0].portrait, undefined);
    const restored = await restoreCampaignPortraits(parsed.bundle, async () => 'unused');
    assert.equal(restored.state.characters[0].portrait, undefined);
  }
});

test('portable imports reject structurally incomplete character data before state replacement', () => {
  const bundle = createCampaignBundle(state, []);
  const parsed = parseCampaignFile(JSON.stringify({
    ...bundle,
    state: {
      ...bundle.state,
      characters: [{ id: 'incomplete-character' }],
    },
  }));
  assert.deepEqual(parsed, {
    ok: false,
    error: 'The campaign export is incomplete or damaged.',
  });
});

test('portrait restoration runs sequentially to bound memory and filesystem pressure', async () => {
  const first = portraitAsset('character-1', 'image/jpeg', 'AQID');
  const second = portraitAsset('character-2', 'image/jpeg', 'BAUG');
  assert.ok(first);
  assert.ok(second);
  const bundle = createCampaignBundle(state, [first, second]);
  let active = 0;
  let maxActive = 0;
  const restored = await restoreCampaignPortraits(bundle, async asset => {
    active += 1;
    maxActive = Math.max(maxActive, active);
    await Promise.resolve();
    active -= 1;
    return `restored://${asset.characterId}`;
  });
  assert.equal(restored.restored, 2);
  assert.equal(maxActive, 1);
});