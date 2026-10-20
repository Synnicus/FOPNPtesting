import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_SKILLS } from '../context/types.ts';
import type {
  Armor,
  CampaignMap,
  CampaignRaceTag,
  CampaignRuleTag,
  CampaignTable,
  Character,
  CustomPerkDefinition,
  CustomRaceDefinition,
  CustomWeaponMod,
  VehicleProfile,
  Weapon,
} from '../context/types.ts';
import {
  applyVehicleSystemDamage,
  BUILT_IN_VEHICLES,
  resolveVehicleRepairAttempt,
  resolveVehicleCrewAssignments,
  spawnVehicleCharacter,
} from './vehicles.ts';
import { customRuleConditionMatches } from './customRules.ts';
import { BUILT_IN_BESTIARY, spawnBestiaryTemplate } from './bestiary.ts';
import { BUILT_IN_WEAPONS } from './weapons.ts';
import { getInjuryCauseText } from './injuries.ts';
import { areaProfileRange, EXPLOSIVE_AMMO_AREA_PROFILES, normalizeAreaProfileRangeOverrides } from './areaEffects.ts';
import {
  createCampaignBundle,
  createCharacterBundle,
  createEquipmentBundle,
  createVehicleBundle,
  parseCampaignFile,
  parseIndividualFile,
  portraitAsset,
  restoreCampaignPortraits,
  restoreCharacterPortrait,
  restoreVehiclePortrait,
  type PortablePortraitAsset,
  vehiclePortraitAsset,
} from './portableExports.ts';

const portraitOwnerId = (asset: PortablePortraitAsset) =>
  asset.kind === 'character-portrait' ? asset.characterId : asset.vehicleId;

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

test('custom race profiles and racial tags survive individual and campaign portable exports', () => {
  const five = { strength: 5, perception: 5, endurance: 5, charisma: 5, intelligence: 5, agility: 5, luck: 5 };
  const profile: CustomRaceDefinition = {
    id: 'synth-profile',
    name: 'Synth',
    description: 'Synthetic humanoid.',
    specialMin: { ...five },
    specialMax: { strength: 10, perception: 10, endurance: 10, charisma: 10, intelligence: 10, agility: 10, luck: 10 },
    specialDefault: { ...five },
    naturalDR: 10,
    naturalGasDR: 100,
    naturalElecDR: 25,
    naturalWeaponIds: [],
    benefits: ['Gas immunity'],
    penalties: [],
    playable: true,
    perksPerLevels: 3,
    naturalACBonus: 1,
  };
  const tag: CampaignRaceTag = { id: 'race-cybernetic', label: 'Cybernetic' };
  const customRaceCharacter: Character = {
    ...character,
    race: 'customRace',
    customRaceId: profile.id,
    customRaceProfile: profile,
    raceTags: [tag.id],
  };

  const individual = createCharacterBundle(customRaceCharacter, [], [], null, [tag]);
  const individualParsed = parseIndividualFile(JSON.stringify(individual));
  assert.equal(individualParsed.ok, true);
  if (individualParsed.ok && individualParsed.kind === 'character') {
    assert.equal(individualParsed.bundle.character.customRaceProfile?.id, profile.id);
    assert.deepEqual(individualParsed.bundle.campaignRaceTags, [tag]);
    assert.deepEqual(individualParsed.bundle.character.raceTags, [tag.id]);
  }

  const campaign = createCampaignBundle({
    ...state,
    characters: [customRaceCharacter],
    customRaces: [profile],
    campaignRaceTags: [tag],
  }, []);
  const campaignParsed = parseCampaignFile(JSON.stringify(campaign));
  assert.equal(campaignParsed.ok, true);
  if (campaignParsed.ok && campaignParsed.source === 'portable') {
    assert.deepEqual(campaignParsed.bundle.state.customRaces, [profile]);
    assert.deepEqual(campaignParsed.bundle.state.campaignRaceTags, [tag]);
    assert.deepEqual(campaignParsed.bundle.state.characters[0].raceTags, [tag.id]);
  }
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

test('portable campaign round-trips loot and encounter ranges, weights, and map markers', () => {
  const lootTable: CampaignTable = {
    id: 'loot-supplies',
    name: 'Supply Cache',
    description: 'A weighted loot table',
    rollCountMin: 2,
    rollCountMax: 5,
    entries: [
      { id: 'water', name: 'Purified Water', description: 'Capped bottles', weight: 7, quantityMin: 1, quantityMax: 3 },
      { id: 'stimpak', name: 'Stimpak', description: 'Medical supplies', weight: 2, quantityMin: 2, quantityMax: 6 },
    ],
  };
  const encounterTable: CampaignTable = {
    id: 'encounters-road',
    name: 'Road Encounters',
    description: 'A campaign encounter table',
    rollCountMin: 1,
    rollCountMax: 4,
    entries: [
      { id: 'raiders', name: 'Raiders', description: 'A small patrol', weight: 3, quantityMin: 1, quantityMax: 2 },
      { id: 'geckos', name: 'Geckos', description: 'A hungry pack', weight: 9, quantityMin: 2, quantityMax: 5 },
    ],
  };
  const campaignMap: CampaignMap = {
    id: 'map-junction',
    name: 'Junction',
    description: 'The party approach',
    imageDataUri: 'data:image/png;base64,aGVsbG8=',
    locations: [{ id: 'north-gate', name: 'North Gate', description: 'Road entrance', x: 0.15, y: 0.3 }],
    party: [
      { characterId: 'character-1', x: 0.4, y: 0.6 },
      { characterId: 'character-2', x: 0.45, y: 0.65 },
    ],
  };
  const bundle = createCampaignBundle({
    ...state,
    lootTables: [lootTable],
    encounterTables: [encounterTable],
    campaignMaps: [campaignMap],
  }, []);
  const parsed = parseCampaignFile(JSON.stringify(bundle));

  assert.equal(parsed.ok, true);
  if (!parsed.ok || parsed.source !== 'portable') {
    assert.fail('Expected the campaign file to round-trip as a portable bundle.');
  }
  assert.deepEqual(parsed.bundle.state.lootTables, [lootTable]);
  assert.deepEqual(parsed.bundle.state.encounterTables, [encounterTable]);
  assert.deepEqual(parsed.bundle.state.campaignMaps, [campaignMap]);
});

test('portable campaign round-trips campaign-specific blast distances', () => {
  const rangeOverrides = {
    'ammo:rocket_explosive': { main: 45 },
    'ammo:40mm_frag': { concussion: 30, fragmentation: 15 },
  };
  const bundle = createCampaignBundle({ ...state, areaProfileRangeOverrides: rangeOverrides }, []);
  const parsed = parseCampaignFile(JSON.stringify(bundle));

  assert.equal(parsed.ok, true);
  if (!parsed.ok || parsed.source !== 'portable') {
    assert.fail('Expected the exported campaign to import as a portable bundle.');
  }
  assert.deepEqual(parsed.bundle.state.areaProfileRangeOverrides, rangeOverrides);

  const rocket = EXPLOSIVE_AMMO_AREA_PROFILES.find(profile => profile.id === 'ammo:rocket_explosive')!;
  const fragmentation = EXPLOSIVE_AMMO_AREA_PROFILES.find(profile => profile.id === 'ammo:40mm_frag')!;
  assert.equal(areaProfileRange(rocket, rocket.effects[0], parsed.bundle.state.areaProfileRangeOverrides!), 45);
  assert.deepEqual(
    fragmentation.effects.map(effect => areaProfileRange(fragmentation, effect, parsed.bundle.state.areaProfileRangeOverrides!)),
    [undefined, 30, 15],
  );
});

test('campaign imports normalize invalid or missing blast ranges without changing printed ranges', () => {
  const bundle = createCampaignBundle({
    ...state,
    areaProfileRangeOverrides: { 'ammo:rocket_explosive': { main: 45 } },
  }, []);
  const malformed = JSON.parse(JSON.stringify(bundle)) as typeof bundle;
  (malformed as unknown as { state: Record<string, unknown> }).state.areaProfileRangeOverrides = {
    'ammo:rocket_explosive': { main: 45, concussion: -2, fragmentation: 'far' },
    'ammo:51mm_explosive_mortar': { main: 999 },
    invalid: ['not', 'a', 'profile'],
  };

  const parsed = parseCampaignFile(JSON.stringify(malformed));
  assert.equal(parsed.ok, true);
  if (!parsed.ok || parsed.source !== 'portable') {
    assert.fail('Expected malformed optional blast ranges to be normalized during import.');
  }
  assert.deepEqual(parsed.bundle.state.areaProfileRangeOverrides, {
    'ammo:rocket_explosive': { main: 45 },
    'ammo:51mm_explosive_mortar': { main: 999 },
  });

  const mortar = EXPLOSIVE_AMMO_AREA_PROFILES.find(profile => profile.id === 'ammo:51mm_explosive_mortar')!;
  assert.equal(areaProfileRange(mortar, mortar.effects[0], parsed.bundle.state.areaProfileRangeOverrides!), 20);

  const missing = { ...bundle, state: { ...bundle.state } };
  delete missing.state.areaProfileRangeOverrides;
  const importedMissing = parseCampaignFile(JSON.stringify(missing));
  assert.equal(importedMissing.ok, true);
  if (importedMissing.ok && importedMissing.source === 'portable') {
    assert.deepEqual(importedMissing.bundle.state.areaProfileRangeOverrides, {});
  }
  assert.deepEqual(normalizeAreaProfileRangeOverrides(undefined), {});
  assert.deepEqual(normalizeAreaProfileRangeOverrides({ rocket_explosive: { main: Infinity, concussion: 12.5 } }), {});
});

test('campaign portrait assets restore only to their matching character id', async () => {
  const asset = portraitAsset(character.id, 'image/jpeg', 'AQID');
  assert.ok(asset);
  const bundle = createCampaignBundle(state, [asset]);
  assert.equal(bundle.state.characters[0].portrait, undefined);
  assert.deepEqual(bundle.state.characters[0].portraitOffset, { x: 0.25, y: 0.75 });

  const restored = await restoreCampaignPortraits(bundle, async image =>
    `restored://${portraitOwnerId(image)}/${image.mimeType}`);
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

test('portable campaigns preserve custom consumable catalog entries and reject malformed ones', () => {
  const consumable = {
    id: 'custom-tonic',
    name: 'Sunset Tonic',
    category: 'drink',
    value: 25,
    description: 'A bitter homemade drink.',
    effectText: 'The GM determines its effects.',
    isCustom: true,
  } as const;
  const bundle = createCampaignBundle({ ...state, customConsumables: [consumable] }, []);
  const parsed = parseCampaignFile(JSON.stringify(bundle));

  assert.equal(parsed.ok, true);
  if (parsed.ok && parsed.source === 'portable') {
    assert.deepEqual(parsed.bundle.state.customConsumables, [consumable]);
  }

  const malformed = {
    ...bundle,
    state: { ...bundle.state, customConsumables: [{ ...consumable, category: 'weapon' }] },
  };
  assert.equal(parseCampaignFile(JSON.stringify(malformed)).ok, false);
});

test('portable campaign round-trips injury attribution, descriptions, and effects', () => {
  const injury = {
    id: 'injury-1',
    location: 'leftArm' as const,
    severity: 'crippled' as const,
    description: 'The left arm is crippled.',
    toHitPenalty: -2,
    skillPenalty: { smallGuns: -2 },
    movementPenalty: 0,
    isActive: true,
    source: 'Raider with Hunting Rifle',
  };
  const campaign = createCampaignBundle({
    ...state,
    characters: [{ ...character, injuries: [injury] }],
  }, []);

  assert.equal(campaign.state.characters[0].injuries[0].source, injury.source);
  const parsed = parseCampaignFile(JSON.stringify(campaign));
  assert.equal(parsed.ok, true);
  if (parsed.ok && parsed.source === 'portable') {
    const importedInjury = parsed.bundle.state.characters[0].injuries[0];
    assert.deepEqual(importedInjury, injury);
    assert.equal(getInjuryCauseText(importedInjury.source), 'Caused by: Raider with Hunting Rifle');
  }
});

test('legacy campaign imports keep attacker and weapon cause text', () => {
  const injury = {
    id: 'injury-legacy-attributed',
    location: 'rightArm' as const,
    severity: 'broken' as const,
    description: 'A raider shot the Courier in the right arm.',
    toHitPenalty: -3,
    skillPenalty: { smallGuns: -2 },
    movementPenalty: 0,
    isActive: true,
    source: 'Raider with Hunting Rifle',
  };
  const parsed = parseCampaignFile(JSON.stringify({
    ...state,
    characters: [{ ...character, injuries: [injury] }],
  }));

  assert.equal(parsed.ok, true);
  if (parsed.ok && parsed.source === 'legacy') {
    const importedInjury = parsed.state.characters[0].injuries[0];
    assert.equal(importedInjury.source, injury.source);
    assert.equal(getInjuryCauseText(importedInjury.source), 'Caused by: Raider with Hunting Rifle');
  }
});

test('campaign imports accept older injuries without source attribution', () => {
  const { source: _source, ...olderInjury } = {
    id: 'injury-legacy',
    location: 'leftArm' as const,
    severity: 'crippled' as const,
    description: 'The left arm is crippled.',
    toHitPenalty: -2,
    skillPenalty: { smallGuns: -2 },
    movementPenalty: 0,
    isActive: true,
    source: 'Raider with Hunting Rifle',
  };
  const olderCharacter = { ...character, injuries: [olderInjury] };
  const portable = createCampaignBundle({ ...state, characters: [olderCharacter] }, []);

  for (const file of [
    { ...portable, state: { ...portable.state, characters: [olderCharacter] } },
    { ...state, characters: [olderCharacter] },
  ]) {
    const parsed = parseCampaignFile(JSON.stringify(file));
    assert.equal(parsed.ok, true);
    if (parsed.ok) {
      const importedCharacter = parsed.source === 'portable'
        ? parsed.bundle.state.characters[0]
        : parsed.state.characters[0];
      assert.deepEqual(importedCharacter.injuries[0], olderInjury);
      assert.equal('source' in importedCharacter.injuries[0], false);
      assert.equal(getInjuryCauseText(undefined), null);
    }
  }
});

test('injury cause text omits empty, whitespace-only, and manual sources', () => {
  assert.equal(getInjuryCauseText(''), null);
  assert.equal(getInjuryCauseText('   '), null);
  assert.equal(getInjuryCauseText('manual'), null);
});

test('individual character exports preserve injury attribution, descriptions, active state, and penalties', () => {
  const injury = {
    id: 'injury-character-export',
    location: 'rightArm' as const,
    severity: 'broken' as const,
    description: 'A raider shot the Courier in the right arm.',
    toHitPenalty: -3,
    skillPenalty: { smallGuns: -2, energyWeapons: -1 },
    movementPenalty: -1,
    isActive: true,
    source: 'Raider with Hunting Rifle',
  };
  const exported = createCharacterBundle({ ...character, injuries: [injury] }, [], []);

  assert.deepEqual(exported.character.injuries[0], injury);
  const parsed = parseIndividualFile(JSON.stringify(exported));
  assert.equal(parsed.ok, true);
  if (parsed.ok && parsed.kind === 'character') {
    assert.deepEqual(parsed.bundle.character.injuries[0], injury);
    assert.equal(
      getInjuryCauseText(parsed.bundle.character.injuries[0].source),
      'Caused by: Raider with Hunting Rifle',
    );
  }
});

test('individual character imports accept older injuries without source attribution', () => {
  const { source: _source, ...olderInjury } = {
    id: 'injury-character-legacy',
    location: 'leftArm' as const,
    severity: 'crippled' as const,
    description: 'The left arm is crippled.',
    toHitPenalty: -2,
    skillPenalty: { smallGuns: -2 },
    movementPenalty: 0,
    isActive: true,
    source: 'Raider with Hunting Rifle',
  };
  const exported = createCharacterBundle({ ...character, injuries: [olderInjury] }, [], []);
  const parsed = parseIndividualFile(JSON.stringify(exported));

  assert.equal(parsed.ok, true);
  if (parsed.ok && parsed.kind === 'character') {
    const importedInjury = parsed.bundle.character.injuries[0];
    assert.deepEqual(importedInjury, olderInjury);
    assert.equal('source' in importedInjury, false);
    assert.equal(
      getInjuryCauseText('source' in importedInjury && typeof importedInjury.source === 'string'
        ? importedInjury.source
        : undefined),
      null,
    );
  }
});

test('portable campaign imports reject malformed injury attribution', () => {
  const bundle = createCampaignBundle({
    ...state,
    characters: [{
      ...character,
      injuries: [{
        id: 'injury-invalid',
        location: 'leftArm',
        severity: 'crippled',
        description: 'The left arm is crippled.',
        toHitPenalty: -2,
        skillPenalty: { smallGuns: -2 },
        movementPenalty: 0,
        isActive: true,
        source: 'Raider with Hunting Rifle',
      }],
    }],
  }, []);
  const malformed = JSON.parse(JSON.stringify(bundle)) as {
    state: { characters: Array<{ injuries: Array<Record<string, unknown>> }> };
  };
  malformed.state.characters[0].injuries[0].source = 42;
  assert.equal(parseCampaignFile(JSON.stringify(malformed)).ok, false);
});

test('portable campaign exports round-trip theme, audio, and mutant radiation preferences', () => {
  const radioStations = [{
    id: 'custom-station',
    name: 'Roadside Radio',
    description: 'Songs from the highway.',
    songs: [
      { id: 'slot-a', file: 'road-song.mp3', title: 'Road Song', artist: 'The Travelers' },
      { id: 'slot-b', file: 'not-uploaded-yet.mp3', title: 'Future Song', artist: null },
      { id: 'slot-c', file: null, title: 'Unassigned', artist: null },
    ],
  }];
  const bundle = createCampaignBundle({
    ...state,
    visualTheme: 'eastern',
    systemSoundsEnabled: false,
    combatSoundsEnabled: false,
    musicEnabled: true,
    radioStations,
    activeRadioStationId: 'custom-station',
    mutantGhoulRadiationRules: true,
    ghoulRadiationHealingOption: 3,
  }, []);
  const json = JSON.stringify(bundle);
  const parsed = parseCampaignFile(json);
  assert.equal(parsed.ok, true);
  assert.match(json, /road-song\.mp3/);
  assert.doesNotMatch(json, /data:audio|base64,/i);
  if (parsed.ok && parsed.source === 'portable') {
    assert.equal(parsed.bundle.state.visualTheme, 'eastern');
    assert.equal(parsed.bundle.state.systemSoundsEnabled, false);
    assert.equal(parsed.bundle.state.combatSoundsEnabled, false);
    assert.equal(parsed.bundle.state.musicEnabled, true);
    assert.deepEqual(parsed.bundle.state.radioStations, radioStations);
    assert.equal(parsed.bundle.state.activeRadioStationId, 'custom-station');
    assert.equal(parsed.bundle.state.mutantGhoulRadiationRules, true);
    assert.equal(parsed.bundle.state.ghoulRadiationHealingOption, 3);
  }
});

test('portable campaigns preserve custom equipment tags and keep imported items eligible for tag conditions', () => {
  const taggedWeapon: Weapon = {
    ...customWeapon,
    tags: ['vault-tech', 'custom-ranged'],
  };
  const taggedArmor: Armor = {
    ...customArmor,
    name: 'T-51 Power Armor',
    tags: ['vault-tech', 'reinforced-weave'],
  };
  const bundle = createCampaignBundle({
    ...state,
    customWeapons: [taggedWeapon],
    customArmor: [taggedArmor],
  }, []);
  const parsed = parseCampaignFile(JSON.stringify(bundle));

  assert.equal(parsed.ok, true);
  if (!parsed.ok || parsed.source !== 'portable') return;

  const importedWeapon = parsed.bundle.state.customWeapons[0];
  const importedArmor = parsed.bundle.state.customArmor[0];
  assert.deepEqual(importedWeapon.tags, taggedWeapon.tags);
  assert.deepEqual(importedArmor.tags, taggedArmor.tags);

  assert.equal(customRuleConditionMatches(character, importedWeapon, [importedArmor], 'single', {
    weaponTags: ['custom-ranged'],
    armorTags: ['reinforced-weave'],
  }), true, 'campaign-defined equipment tags still satisfy perk conditions');
  assert.equal(customRuleConditionMatches(character, importedWeapon, [importedArmor], 'single', {
    weaponTags: ['small guns'],
    armorTags: ['power armor'],
  }), true, 'inferred weapon and armor tags still satisfy perk conditions');
});

test('portable campaigns preserve custom rule tag definitions and mod/perk references', () => {
  const campaignRuleTags: CampaignRuleTag[] = [
    { id: 'campaign-ranged', label: 'Campaign Ranged', appliesTo: 'weapon' },
    { id: 'campaign-insulated', label: 'Campaign Insulated', appliesTo: 'armor' },
  ];
  const customWeaponMod: CustomWeaponMod = {
    id: 'campaign-scope',
    name: 'Campaign Scope',
    description: 'A scope for campaign-specific ranged weapons.',
    programmatic: false,
    appliesToTags: ['campaign-ranged'],
    effects: [],
  };
  const customPerk: CustomPerkDefinition = {
    id: 'campaign-marksman',
    name: 'Campaign Marksman',
    description: 'A perk for campaign-specific equipment.',
    category: 'combat',
    minLevel: 1,
    maxRanks: 1,
    conditions: {
      weaponTags: ['campaign-ranged'],
      armorTags: ['campaign-insulated'],
    },
    programmatic: false,
    effects: [],
  };
  const bundle = createCampaignBundle({
    ...state,
    customWeaponMods: [customWeaponMod],
    customPerks: [customPerk],
    campaignRuleTags,
  }, []);
  const parsed = parseCampaignFile(JSON.stringify(bundle));

  assert.equal(parsed.ok, true);
  if (parsed.ok && parsed.source === 'portable') {
    assert.deepEqual(parsed.bundle.state.campaignRuleTags, campaignRuleTags);
    assert.deepEqual(parsed.bundle.state.customWeaponMods, [customWeaponMod]);
    assert.deepEqual(parsed.bundle.state.customPerks, [customPerk]);
    assert.ok(parsed.bundle.state.campaignRuleTags?.some(tag =>
      tag.id === parsed.bundle.state.customWeaponMods?.[0].appliesToTags?.[0]));
    assert.ok(parsed.bundle.state.campaignRuleTags?.some(tag =>
      tag.id === parsed.bundle.state.customPerks?.[0].conditions?.weaponTags?.[0]));
    assert.ok(parsed.bundle.state.campaignRuleTags?.some(tag =>
      tag.id === parsed.bundle.state.customPerks?.[0].conditions?.armorTags?.[0]));
  }
});

test('malformed equipment tags are discarded without rejecting the rest of an imported campaign', () => {
  const bundle = createCampaignBundle({
    ...state,
    customWeapons: [customWeapon],
    customArmor: [customArmor],
  }, []);
  const malformedPortable = {
    ...bundle,
    state: {
      ...bundle.state,
      customWeapons: [{ ...customWeapon, tags: { invalid: true } }],
      customArmor: [{ ...customArmor, tags: ['kept-tag', 17, null] }],
    },
  };
  const portable = parseCampaignFile(JSON.stringify(malformedPortable));

  assert.equal(portable.ok, true);
  if (portable.ok && portable.source === 'portable') {
    assert.equal(portable.bundle.state.characters.length, state.characters.length);
    assert.equal(portable.bundle.state.customWeapons[0].id, customWeapon.id);
    assert.equal('tags' in portable.bundle.state.customWeapons[0], false);
    assert.deepEqual(portable.bundle.state.customArmor[0].tags, ['kept-tag']);
  }

  const malformedLegacy = {
    ...state,
    customWeapons: [{ ...customWeapon, tags: 'invalid' }],
    customArmor: [{ ...customArmor, tags: ['kept-tag', false] }],
  };
  const legacy = parseCampaignFile(JSON.stringify(malformedLegacy));

  assert.equal(legacy.ok, true);
  if (legacy.ok && legacy.source === 'legacy') {
    assert.equal(legacy.state.characters.length, state.characters.length);
    assert.equal('tags' in legacy.state.customWeapons[0], false);
    assert.deepEqual(legacy.state.customArmor[0].tags, ['kept-tag']);
  }
});

test('legacy and portable campaigns without options remain accepted', () => {
  const bundle = createCampaignBundle(state, []);
  const {
    visualTheme: _theme,
    systemSoundsEnabled: _sounds,
    combatSoundsEnabled: _combatSounds,
    musicEnabled: _music,
    mutantGhoulRadiationRules: _mutantRadiation,
    ghoulRadiationHealingOption: _ghoulHealing,
    ...olderState
  } = bundle.state;
  const portable = { ...bundle, state: olderState };
  for (const file of [state, portable]) {
    const parsed = parseCampaignFile(JSON.stringify(file));
    assert.equal(parsed.ok, true);
    if (parsed.ok) {
      const loadedState = parsed.source === 'portable' ? parsed.bundle.state : parsed.state;
      assert.equal(loadedState.visualTheme, undefined);
      assert.equal(loadedState.systemSoundsEnabled, undefined);
      assert.equal(loadedState.combatSoundsEnabled, undefined);
      assert.equal(loadedState.musicEnabled, undefined);
      assert.equal(loadedState.mutantGhoulRadiationRules, undefined);
      assert.equal(loadedState.ghoulRadiationHealingOption, undefined);
    }
  }
});

test('campaign imports reject invalid theme, audio, and mutant radiation options', () => {
  const bundle = createCampaignBundle(state, []);
  for (const invalidSettings of [
    { visualTheme: 'northern' },
    { systemSoundsEnabled: 'false' },
    { combatSoundsEnabled: 1 },
    { musicEnabled: 0 },
    { mutantGhoulRadiationRules: 'yes' },
    { ghoulRadiationHealingOption: 5 },
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
      `restored://${portraitOwnerId(image)}`);
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
    { id: 'karma-3', change: 0, reason: 'Spared a traveler without changing Karma', createdAt: 3000 },
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
    karmaLog: [
      { id: 'karma-1', change: 25, reason: 'Saved a traveler', createdAt: 1000 },
      { id: 'karma-2', change: 0, reason: 'Allowed a traveler to pass', createdAt: 2000 },
    ],
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

test('faction Fame and Infamy totals and explanatory history survive portable exports and reject inconsistent records', () => {
  const factionReputations: NonNullable<Character['factionReputations']> = [{
    id: 'faction-rep-1',
    name: 'Brotherhood of Steel',
    fame: 3,
    infamy: 0,
    customTitle: 'Paladin',
    log: [
      { id: 'fame-1', kind: 'fame', change: 5, reason: 'Recovered a lost holotape', createdAt: 1000 },
      { id: 'fame-2', kind: 'fame', change: -2, reason: 'Lost standing after an argument', createdAt: 2000 },
    ],
  }];
  const bundle = createCharacterBundle({ ...character, factionReputations }, [customWeapon], [customArmor]);
  const parsed = parseIndividualFile(JSON.stringify(bundle));
  assert.equal(parsed.ok, true);
  if (parsed.ok && parsed.kind === 'character') {
    assert.deepEqual(parsed.bundle.character.factionReputations, factionReputations);
    assert.equal('thresholdProfile' in parsed.bundle.character.factionReputations![0], false);
  }
  const legacyProfileFile = parseIndividualFile(JSON.stringify({
    ...bundle,
    character: {
      ...bundle.character,
      factionReputations: [{ ...factionReputations[0], thresholdProfile: 'brotherhood-of-steel' }],
    },
  }));
  assert.equal(legacyProfileFile.ok, true);

  const campaignBundle = createCampaignBundle({ ...state, characters: [{ ...character, factionReputations }] }, []);
  const parsedCampaign = parseCampaignFile(JSON.stringify(campaignBundle));
  assert.equal(parsedCampaign.ok, true);
  if (parsedCampaign.ok && parsedCampaign.source === 'portable') {
    assert.deepEqual(parsedCampaign.bundle.state.characters[0].factionReputations, factionReputations);
  }

  assert.equal(parseIndividualFile(JSON.stringify({
    ...bundle,
    character: {
      ...bundle.character,
      factionReputations: [{ ...factionReputations[0], fame: 4 }],
    },
  })).ok, false);
  assert.equal(parseIndividualFile(JSON.stringify({
    ...bundle,
    character: {
      ...bundle.character,
      factionReputations: [{ ...factionReputations[0], thresholdProfile: 'made-up-profile' }],
    },
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
  assert.equal(bundle.assets[0]?.kind === 'character-portrait' ? bundle.assets[0].characterId : null, character.id);
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
      async image => `restored://${portraitOwnerId(image)}`,
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

test('custom vehicle profiles and their portraits survive portable campaign round trips', async () => {
  const source: VehicleProfile = {
    ...BUILT_IN_VEHICLES[0],
    id: 'custom-highwayman',
    name: 'Custom Highwayman',
    isCustom: true,
    portrait: 'file:///old-device/highwayman.png',
    systems: BUILT_IN_VEHICLES[0].systems.map(system => ({ ...system })),
  };
  const bundle = createCampaignBundle(
    { ...state, customVehicles: [source] },
    [vehiclePortraitAsset(source.id, 'image/png', 'AQID')!],
  );
  assert.equal(bundle.state.customVehicles?.[0].portrait, undefined);
  const parsed = parseCampaignFile(JSON.stringify(bundle));
  assert.equal(parsed.ok, true);
  if (!parsed.ok || parsed.source !== 'portable') return;
  const restored = await restoreCampaignPortraits(
    parsed.bundle,
    async asset => `restored://${portraitOwnerId(asset)}`,
  );
  assert.equal(restored.restored, 1);
  assert.equal(restored.state.customVehicles?.[0].portrait, `restored://${source.id}`);
  assert.equal(restored.state.customVehicles?.[0].armorClass, 0);
});

test('damaged vehicle systems and repair results survive campaign JSON export and import', () => {
  const spawned = spawnVehicleCharacter(BUILT_IN_VEHICLES[0], 'vehicle-repair-roundtrip');
  const damaged = applyVehicleSystemDamage(spawned.vehicle!, 'engine', 20);
  const repair = resolveVehicleRepairAttempt(damaged, {
    id: 'repair-roundtrip',
    systemId: 'engine',
    mechanicCharacterId: character.id,
    mechanicName: character.name,
    repairSkill: 75,
    checkRoll: 42,
    repairDice: [4, 5, 6],
    createdAt: '2026-10-19T12:00:00.000Z',
  });
  assert.ok(repair);

  const bundle = createCampaignBundle({
    ...state,
    characters: [{ ...spawned, vehicle: repair.vehicle }],
  }, []);
  const parsed = parseCampaignFile(JSON.stringify(bundle));
  assert.equal(parsed.ok, true);
  if (!parsed.ok || parsed.source !== 'portable') return;

  const imported = parsed.bundle.state.characters.find(value => value.id === spawned.id)!;
  assert.equal(imported.vehicle?.systems.find(system => system.id === 'engine')?.currentHp, 45);
  assert.equal(imported.vehicle?.repairHistory?.length, 1);
  assert.deepEqual(imported.vehicle?.repairHistory?.[0], repair.record);
});

test('portable campaigns preserve deployed vehicle mounts, duplicate quantities, and crew assignments', () => {
  const activePilot = { ...character, id: 'vehicle-pilot', name: 'Vehicle Pilot' };
  const storedGunner = { ...character, id: 'stored-gunner', name: 'Stored Gunner', inStorage: true };
  const mountedVehicle: VehicleProfile = {
    ...BUILT_IN_VEHICLES.find(vehicle => vehicle.id === 'm1a1_abrams')!,
    id: 'custom-abrams',
    name: 'Custom Abrams',
    isCustom: true,
    weaponSlots: [
      { id: 'main-gun', name: 'Rheinmetall 120mm Gun', weaponId: 'rheinmetall_120mm_gun', quantity: 1 },
      { id: 'coax', name: 'M2HB', weaponId: 'm2hb', quantity: 2 },
      { id: 'tow', name: 'TOW-II Missile Defense System', weaponId: 'tow_ii_missile_defense_system', quantity: 3 },
    ],
    mountedWeapons: ['Rheinmetall 120mm Gun', 'M2HB ×2', 'TOW-II Missile Defense System ×3'],
  };
  const deployedVehicle = {
    ...spawnVehicleCharacter(mountedVehicle, 'deployed-abrams'),
    vehicleCrew: { pilotCharacterId: activePilot.id, gunnerCharacterId: storedGunner.id },
  };
  const bundle = createCampaignBundle({
    ...state,
    characters: [activePilot, storedGunner, deployedVehicle],
    customVehicles: [mountedVehicle],
  }, []);
  const parsed = parseCampaignFile(JSON.stringify(bundle));

  assert.equal(parsed.ok, true);
  if (!parsed.ok || parsed.source !== 'portable') return;
  const importedVehicle = parsed.bundle.state.characters.find(candidate => candidate.id === deployedVehicle.id)!;
  assert.deepEqual(importedVehicle.vehicle?.weaponSlots, mountedVehicle.weaponSlots);
  assert.deepEqual(importedVehicle.vehicle?.mountedWeapons, mountedVehicle.mountedWeapons);
  assert.deepEqual(importedVehicle.vehicleCrew, deployedVehicle.vehicleCrew);
  assert.deepEqual(parsed.bundle.state.customVehicles?.[0].weaponSlots, mountedVehicle.weaponSlots);
  assert.deepEqual(parsed.bundle.state.customVehicles?.[0].mountedWeapons, mountedVehicle.mountedWeapons);
  const resolvedCrew = resolveVehicleCrewAssignments(importedVehicle, parsed.bundle.state.characters);
  assert.equal(resolvedCrew.pilot?.id, activePilot.id);
  assert.equal(resolvedCrew.gunner, null, 'stored gunner reference remains harmless after import');
});

test('custom vehicle profiles export as importable individual files with portraits', async () => {
  const source: VehicleProfile = {
    ...BUILT_IN_VEHICLES[0],
    id: 'custom-vehicle-file',
    name: 'Custom Vehicle File',
    isCustom: true,
    portrait: 'file:///old-device/custom-vehicle.png',
    systems: BUILT_IN_VEHICLES[0].systems.map(system => ({ ...system })),
    weaponSlots: [
      { id: 'front-cannon', name: 'Front Cannon', weaponId: 'custom-cannon', quantity: 1 },
      { id: 'left-turret', name: 'Left Turret', weaponId: 'custom-turret', quantity: 2 },
      { id: 'right-turret', name: 'Right Turret', weaponId: 'custom-turret', quantity: 1 },
    ],
  };
  const bundle = createVehicleBundle(
    source,
    vehiclePortraitAsset(source.id, 'image/png', 'AQID'),
  );
  assert.equal(bundle.vehicle.portrait, undefined);

  const parsed = parseIndividualFile(JSON.stringify(bundle));
  assert.equal(parsed.ok, true);
  if (!parsed.ok || parsed.kind !== 'vehicle') return;
  const restored = await restoreVehiclePortrait(
    parsed.bundle,
    async asset => `restored://${portraitOwnerId(asset)}`,
  );
  assert.equal(restored.restored, 1);
  assert.equal(restored.vehicle.portrait, `restored://${source.id}`);
  assert.equal(restored.vehicle.armorClass, 0);
  assert.deepEqual(restored.vehicle.weaponSlots, source.weaponSlots);

  assert.equal(parseIndividualFile(JSON.stringify({
    ...bundle,
    vehicle: { ...bundle.vehicle, isCustom: false },
  })).ok, false);

  const { weaponSlots: _weaponSlots, ...olderVehicle } = bundle.vehicle;
  const olderFile = parseIndividualFile(JSON.stringify({
    ...bundle,
    vehicle: olderVehicle,
  }));
  assert.equal(olderFile.ok, true);
  if (olderFile.ok && olderFile.kind === 'vehicle') {
    assert.equal(olderFile.bundle.vehicle.weaponSlots, undefined);
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
    return `restored://${portraitOwnerId(asset)}`;
  });
  assert.equal(restored.restored, 2);
  assert.equal(maxActive, 1);
});

test('catalog photos stay embedded in portable campaigns and reject external image URLs', () => {
  const portrait = 'data:image/png;base64,AQID';
  const bundle = createCampaignBundle({
    ...state,
    bestiaryPortraits: { giant_rat: portrait },
    vehicleCatalogPortraits: { humvee: portrait },
  }, []);
  const parsed = parseCampaignFile(JSON.stringify(bundle));
  assert.equal(parsed.ok, true);
  if (parsed.ok && parsed.source === 'portable') {
    assert.deepEqual(parsed.bundle.state.bestiaryPortraits, { giant_rat: portrait });
    assert.deepEqual(parsed.bundle.state.vehicleCatalogPortraits, { humvee: portrait });
  } else {
    assert.fail('Expected the exported campaign to be recognized as a portable bundle.');
  }

  const invalid = parseCampaignFile(JSON.stringify({
    ...bundle,
    state: { ...bundle.state, bestiaryPortraits: { giant_rat: 'https://example.com/image.png' } },
  }));
  assert.equal(invalid.ok, false);
});

test('portable campaigns preserve spawned NPC snapshots alongside edited and removed Bestiary entries', async () => {
  const editedSource = BUILT_IN_BESTIARY.find(template => template.id === 'deathclaw')!;
  const removedSource = BUILT_IN_BESTIARY.find(template => template.id === 'giant_rat')!;
  const edited = {
    ...editedSource,
    name: 'Edited premade NPC',
    race: 'robot' as const,
    maxHp: editedSource.maxHp + 100,
    portrait: 'data:image/png;base64,BAUG',
  };
  const spawned = {
    ...spawnBestiaryTemplate(editedSource, BUILT_IN_WEAPONS, 'Existing NPC', 'existing-bestiary-npc'),
    race: 'human' as const,
    portrait: 'data:image/jpeg;base64,AQID',
    maxHp: 47,
    currentHp: 13,
    currentAP: 2,
    tempAC: 6,
    position: 'prone' as const,
    conditions: ['poisoned'],
  };
  const removedSpawn = {
    ...spawnBestiaryTemplate(removedSource, BUILT_IN_WEAPONS, 'Surviving NPC', 'removed-bestiary-npc'),
    currentHp: 4,
    currentAP: 1,
  };
  const asset = portraitAsset(spawned.id, 'image/jpeg', 'AQID');
  assert.ok(asset);
  const bundle = createCampaignBundle({
    ...state,
    characters: [spawned, removedSpawn],
    builtInBestiaryOverrides: [edited],
    removedBuiltInBestiaryTemplateIds: [removedSource.id],
  }, [asset]);

  const parsed = parseCampaignFile(JSON.stringify(bundle));
  assert.equal(parsed.ok, true);
  if (!parsed.ok || parsed.source !== 'portable') {
    assert.fail('Expected the exported campaign to be recognized as a portable bundle.');
  }
  assert.equal(parsed.bundle.state.builtInBestiaryOverrides?.[0]?.name, 'Edited premade NPC');
  assert.deepEqual(parsed.bundle.state.removedBuiltInBestiaryTemplateIds, [removedSource.id]);
  const [importedEdited, importedRemoved] = parsed.bundle.state.characters;
  assert.equal(importedEdited.race, spawned.race);
  assert.equal(importedEdited.maxHp, spawned.maxHp);
  assert.equal(importedEdited.currentHp, spawned.currentHp);
  assert.equal(importedEdited.currentAP, spawned.currentAP);
  assert.equal(importedEdited.tempAC, spawned.tempAC);
  assert.equal(importedEdited.position, spawned.position);
  assert.deepEqual(importedEdited.conditions, spawned.conditions);
  assert.equal(importedRemoved.id, removedSpawn.id, 'NPC remains after its Bestiary source is removed');
  assert.equal(importedRemoved.currentHp, removedSpawn.currentHp);
  assert.equal(importedRemoved.currentAP, removedSpawn.currentAP);

  const restored = await restoreCampaignPortraits(parsed.bundle, async image =>
    `restored://${portraitOwnerId(image)}/${image.mimeType}`);
  assert.equal(restored.state.characters[0].portrait, 'restored://existing-bestiary-npc/image/jpeg');
});
