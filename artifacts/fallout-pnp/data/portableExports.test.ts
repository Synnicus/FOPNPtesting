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

test('condition survives character/campaign bundles including unequipped custom armor', () => {
  const wornCharacter = { ...character, equippedBodyArmorId: undefined,
    armorConditionStates: [{ armorId: customArmor.id, hitSegments: 24 }],
    weaponAmmoStates: [{ weaponId: customWeapon.id, currentAmmo: 4, conditionBoxes: 8 }],
  };
  const bundle = createCharacterBundle(wornCharacter, [customWeapon], [customArmor]);
  assert.equal(bundle.customArmor[0].id, customArmor.id);
  const parsed = parseIndividualFile(JSON.stringify(bundle));
  assert.equal(parsed.ok, true);
  if (parsed.ok && parsed.kind === 'character') {
    assert.deepEqual(parsed.bundle.character.armorConditionStates, wornCharacter.armorConditionStates);
    assert.deepEqual(parsed.bundle.character.weaponAmmoStates, wornCharacter.weaponAmmoStates);
  }
  const campaign = createCampaignBundle({ ...state, characters: [wornCharacter] }, []);
  const loaded = parseCampaignFile(JSON.stringify(campaign));
  assert.equal(loaded.ok, true);
  if (loaded.ok && loaded.source === 'portable') assert.deepEqual(loaded.bundle.state.characters[0].armorConditionStates, wornCharacter.armorConditionStates);
});

test('portable imports reject invalid armor wear before mutation, while accepting older saves', () => {
  const legacy = createCharacterBundle(character, [customWeapon], [customArmor]);
  assert.equal(parseIndividualFile(JSON.stringify(legacy)).ok, true);
  for (const hitSegments of [-1, 51, 1.5, '20']) {
    const invalid = { ...legacy, character: { ...legacy.character,
      armorConditionStates: [{ armorId: customArmor.id, hitSegments }] } };
    assert.equal(parseIndividualFile(JSON.stringify(invalid)).ok, false);
  }
  const duplicate = { ...legacy, character: { ...legacy.character,
    armorConditionStates: [{ armorId: customArmor.id, hitSegments: 20 }, { armorId: customArmor.id, hitSegments: 21 }] } };
  assert.equal(parseIndividualFile(JSON.stringify(duplicate)).ok, false);
});

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

test('portable campaign exports round-trip theme and audio preferences', () => {
  const bundle = createCampaignBundle({
    ...state,
    visualTheme: 'eastern',
    systemSoundsEnabled: false,
    musicEnabled: true,
  }, []);
  const parsed = parseCampaignFile(JSON.stringify(bundle));
  assert.equal(parsed.ok, true);
  if (parsed.ok && parsed.source === 'portable') {
    assert.equal(parsed.bundle.state.visualTheme, 'eastern');
    assert.equal(parsed.bundle.state.systemSoundsEnabled, false);
    assert.equal(parsed.bundle.state.musicEnabled, true);
  }
});

test('legacy and portable campaigns without options remain accepted', () => {
  const bundle = createCampaignBundle(state, []);
  const { visualTheme: _theme, systemSoundsEnabled: _sounds, musicEnabled: _music, ...olderState } = bundle.state;
  const portable = { ...bundle, state: olderState };
  for (const file of [state, portable]) {
    const parsed = parseCampaignFile(JSON.stringify(file));
    assert.equal(parsed.ok, true);
    if (parsed.ok) {
      const loadedState = parsed.source === 'portable' ? parsed.bundle.state : parsed.state;
      assert.equal(loadedState.visualTheme, undefined);
      assert.equal(loadedState.systemSoundsEnabled, undefined);
      assert.equal(loadedState.musicEnabled, undefined);
    }
  }
});

test('campaign imports reject invalid visual theme and non-boolean audio options', () => {
  const bundle = createCampaignBundle(state, []);
  for (const invalidSettings of [
    { visualTheme: 'northern' },
    { systemSoundsEnabled: 'false' },
    { musicEnabled: 0 },
  ]) {
    const parsed = parseCampaignFile(JSON.stringify({
      ...bundle,
      state: { ...bundle.state, ...invalidSettings },
    }));
    assert.equal(parsed.ok, false);
  }
});

for (const { label, settings, expected } of [
  { label: 'enabled Hardcore rules', settings: { hardcoreRadiationRules: true }, expected: true },
  { label: 'disabled Hardcore rules', settings: { hardcoreRadiationRules: false }, expected: false },
  { label: 'missing rules default to disabled', settings: {}, expected: false },
  { label: 'enabled legacy Fallout 3 rules', settings: { fallout3RadiationDebuffs: true }, expected: true },
  { label: 'disabled legacy Fallout 3 rules', settings: { fallout3RadiationDebuffs: false }, expected: false },
  {
    label: 'explicit Hardcore off overrides legacy on',
    settings: { fallout3RadiationDebuffs: true, hardcoreRadiationRules: false },
    expected: false,
  },
  {
    label: 'explicit Hardcore on overrides legacy off',
    settings: { fallout3RadiationDebuffs: false, hardcoreRadiationRules: true },
    expected: true,
  },
]) {
  test(`campaign export/import preserves radiation settings: ${label}`, async () => {
    const asset = portraitAsset(character.id, 'image/jpeg', 'AQID');
    assert.ok(asset);
    const bundle = createCampaignBundle({ ...state, ...settings }, [asset]);
    assert.equal(bundle.state.hardcoreRadiationRules, expected);
    assert.equal('fallout3RadiationDebuffs' in bundle.state, false);

    const parsed = parseCampaignFile(JSON.stringify(bundle));
    assert.ok(parsed.ok);
    assert.equal(parsed.source, 'portable');
    if (parsed.source !== 'portable') assert.fail('Expected a portable campaign');
    assert.equal(parsed.bundle.state.hardcoreRadiationRules, expected);

    const restored = await restoreCampaignPortraits(parsed.bundle, async image =>
      `restored://${image.characterId}`);
    assert.equal(restored.restored, 1);
    assert.equal(restored.state.hardcoreRadiationRules, expected);
    assert.equal(restored.state.characters[0].portrait, 'restored://character-1');
  });
}

test('older raw and portable campaigns without radiation settings remain default-off', () => {
  const { hardcoreRadiationRules: _rules, ...olderState } = createCampaignBundle(state, []).state;
  const olderBundle = { ...createCampaignBundle(state, []), state: olderState };
  for (const [source, file] of [['legacy', olderState], ['portable', olderBundle]] as const) {
    assert.equal('hardcoreRadiationRules' in olderState, false);
    assert.equal('fallout3RadiationDebuffs' in olderState, false);
    const parsed = parseCampaignFile(JSON.stringify(file));
    assert.ok(parsed.ok);
    assert.equal(parsed.source, source);
    const importedState = parsed.source === 'portable' ? parsed.bundle.state : parsed.state;
    assert.equal(importedState.hardcoreRadiationRules ?? false, false);
    assert.equal(createCampaignBundle(importedState, []).state.hardcoreRadiationRules, false);
  }
});

test('radiation settings do not bypass malformed portable campaign validation', () => {
  for (const hardcoreRadiationRules of [true, false]) {
    const bundle = createCampaignBundle({ ...state, hardcoreRadiationRules }, []);
    for (const characters of [[{ id: 'incomplete-character' }], [character, { ...character }]]) {
      assert.deepEqual(parseCampaignFile(JSON.stringify({
        ...bundle,
        state: { ...bundle.state, characters },
      })), {
        ok: false,
        error: 'The campaign export is incomplete or damaged.',
      });
    }
  }
});

test('portable characters accept legacy missing radiation and validate a present meter', () => {
  const legacy = createCharacterBundle(character, [customWeapon], [customArmor]);
  assert.equal(parseIndividualFile(JSON.stringify(legacy)).ok, true);
  const current = createCharacterBundle({ ...character, accumulatedRadiation: 425 }, [customWeapon], [customArmor]);
  assert.equal(parseIndividualFile(JSON.stringify(current)).ok, true);
  const invalid = { ...current, character: { ...current.character, accumulatedRadiation: 425.5 } };
  assert.equal(parseIndividualFile(JSON.stringify(invalid)).ok, false);
});

test('Karma totals and chronological logs survive individual and campaign portable exports', () => {
  const karmaLog = [
    { id: 'karma-1', change: 300, reason: 'Helped a settlement', createdAt: 1000 },
    { id: 'karma-2', change: -50, reason: 'Stole supplies', createdAt: 2000 },
  ];
  const karmaCharacter = { ...character, karma: 250, karmaLog };

  const characterExport = createCharacterBundle(karmaCharacter, [customWeapon], [customArmor]);
  const parsedCharacter = parseIndividualFile(JSON.stringify(characterExport));
  assert.equal(parsedCharacter.ok, true);
  if (parsedCharacter.ok && parsedCharacter.kind === 'character') {
    assert.equal(parsedCharacter.bundle.character.karma, 250);
    assert.deepEqual(parsedCharacter.bundle.character.karmaLog, karmaLog);
  }

  const campaignExport = createCampaignBundle({ ...state, characters: [karmaCharacter] }, []);
  const parsedCampaign = parseCampaignFile(JSON.stringify(campaignExport));
  assert.equal(parsedCampaign.ok, true);
  if (parsedCampaign.ok && parsedCampaign.source === 'portable') {
    assert.equal(parsedCampaign.bundle.state.characters[0].karma, 250);
    assert.deepEqual(parsedCampaign.bundle.state.characters[0].karmaLog, karmaLog);
  }
});

test('portable imports accept legacy characters but reject invalid or inconsistent Karma data', () => {
  const legacy = createCharacterBundle(character, [customWeapon], [customArmor]);
  assert.equal('karma' in legacy.character, false);
  assert.equal('karmaLog' in legacy.character, false);
  assert.equal(parseIndividualFile(JSON.stringify(legacy)).ok, true);

  const withKarma = createCharacterBundle({
    ...character,
    karma: 25,
    karmaLog: [{ id: 'karma-1', change: 25, reason: 'Saved a traveler', createdAt: 1000 }],
  }, [customWeapon], [customArmor]);
  assert.equal(parseIndividualFile(JSON.stringify(withKarma)).ok, true);
  assert.equal(parseIndividualFile(JSON.stringify({
    ...withKarma,
    character: { ...withKarma.character, karma: 26 },
  })).ok, false);
  assert.equal(parseIndividualFile(JSON.stringify({
    ...withKarma,
    character: { ...withKarma.character, karmaLog: [{ id: 'karma-1', change: 0, reason: '', createdAt: 1000 }] },
  })).ok, false);
  assert.equal(parseIndividualFile(JSON.stringify({
    ...withKarma,
    character: { ...withKarma.character, karma: 1001 },
  })).ok, false);
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