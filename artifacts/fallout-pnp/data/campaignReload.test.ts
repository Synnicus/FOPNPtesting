import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import test from 'node:test';
import { URL } from 'node:url';
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import ts from 'typescript';
import type {
  BestiaryTemplate,
  CampaignRuleTag,
  Character,
  CustomPerkDefinition,
  CustomWeaponMod,
  InitiativeEntry,
  Weapon,
} from '../context/types.ts';
import type { AmmoType } from './ammo.ts';
import { BUILT_IN_BESTIARY, MANUAL_BESTIARY, resolveBestiaryTemplates, spawnBestiaryTemplate } from './bestiary.ts';
import { BUILT_IN_ARMOR } from './armor.ts';
import { BUILT_IN_WEAPONS } from './weapons.ts';
import {
  applyVehicleSystemDamage,
  BUILT_IN_VEHICLES,
  resolveVehicleRepairAttempt,
  spawnVehicleCharacter,
} from './vehicles.ts';
import { resolveArmorAwareSheet } from './armorEffects.ts';
import {
  areaProfileRange,
  buildAreaDamageZones,
  createCustomAmmoAreaDamageProfiles,
  EXPLOSIVE_AMMO_AREA_PROFILES,
} from './areaEffects.ts';

const STORAGE_KEY = '@fallout_pnp_v4';

test('AppProvider campaign storage lifecycle', async (t) => {
  const brahmin = MANUAL_BESTIARY.find(template => template.id === 'brahmin')!;
  const legacyTemplate: BestiaryTemplate = {
    ...brahmin,
    id: 'legacy-custom-armored',
    name: 'Legacy Armored NPC',
    isCustom: true,
    usesDerivedArmorClass: undefined,
    special: { ...brahmin.special, agility: 5 },
    armorClass: 36,
    equippedBodyArmorId: 'greater_banding',
    equippedHelmetId: 'metal_helmet',
  };
  // Spawning now sets the policy, so explicitly remove it to represent an old save.
  const legacyNpc = spawnBestiaryTemplate(legacyTemplate, BUILT_IN_WEAPONS, legacyTemplate.name, 'legacy-npc');
  delete legacyNpc.usesDerivedArmorClass;
  const customPerk: CustomPerkDefinition = {
    id: 'saved-custom-perk',
    name: 'Saved Training',
    description: 'A campaign custom perk.',
    category: 'utility',
    minLevel: 1,
    maxRanks: 2,
    conditions: {
      weaponTags: ['campaign-ranged'],
      armorTags: ['campaign-insulated'],
    },
    programmatic: true,
    effects: [
      { id: 'repair-training', kind: 'skillBonus', skill: 'repair', value: 5, application: 'oneTime' },
    ],
  };
  const campaignRuleTags: CampaignRuleTag[] = [
    { id: 'campaign-ranged', label: 'Campaign Ranged', appliesTo: 'weapon' },
    { id: 'campaign-insulated', label: 'Campaign Insulated', appliesTo: 'armor' },
  ];
  const customWeaponMod: CustomWeaponMod = {
    id: 'saved-custom-mod',
    name: 'Campaign Scope',
    description: 'A campaign-specific scope.',
    programmatic: false,
    appliesToTags: ['campaign-ranged'],
    effects: [],
  };
  legacyNpc.perks = [{
    perkId: customPerk.id,
    rank: 2,
    appliedCustomPerkGrants: [
      { effectId: 'repair-training', rank: 1, kind: 'skillBonus', skill: 'repair', amount: 5 },
      { effectId: 'repair-training', rank: 2, kind: 'skillBonus', skill: 'repair', amount: 5 },
    ],
  }];
  const printedNpc = spawnBestiaryTemplate(brahmin, BUILT_IN_WEAPONS, 'Printed Brahmin', 'printed-npc');
  delete printedNpc.usesDerivedArmorClass;
  const vehicleSpawn = spawnVehicleCharacter(BUILT_IN_VEHICLES[0], 'persistent-vehicle');
  const damagedVehicle = applyVehicleSystemDamage(vehicleSpawn.vehicle!, 'engine', 20);
  const repairAttempt = resolveVehicleRepairAttempt(damagedVehicle, {
    id: 'persistent-repair',
    systemId: 'engine',
    mechanicCharacterId: legacyNpc.id,
    mechanicName: legacyNpc.name,
    repairSkill: 75,
    checkRoll: 42,
    repairDice: [4, 5, 6],
    createdAt: '2026-10-19T12:00:00.000Z',
  });
  assert.ok(repairAttempt);
  const vehicleSlots = [
    { id: 'main-gun', name: 'Main gun', weaponId: 'rheinmetall_120mm_gun', quantity: 1 },
    { id: 'coax', name: 'Coaxial M2HB', weaponId: 'm2hb', quantity: 2 },
  ];
  const persistentVehicle = {
    ...vehicleSpawn,
    vehicleCrew: { pilotCharacterId: legacyNpc.id, gunnerCharacterId: printedNpc.id },
    vehicle: {
      ...repairAttempt.vehicle,
      weaponSlots: vehicleSlots,
      mountedWeapons: ['Rheinmetall 120mm Gun', 'M2HB ×2'],
    },
  };
  const fixture = {
    characters: [legacyNpc, printedNpc, persistentVehicle],
    customBestiaryTemplates: [legacyTemplate],
    customPerks: [customPerk],
    customWeaponMods: [customWeaponMod],
    campaignRuleTags,
    customWeapons: [],
    customArmor: [],
    customAmmo: [],
    initiativeEntries: [],
    areaProfileRangeOverrides: {
      'ammo:rocket_explosive': { main: 38 },
      'ammo:51mm_explosive_mortar': { main: 999 },
    },
  };
  const customEmpAmmo: AmmoType = {
    id: 'campaign-emp-ammo',
    name: 'Campaign Pulse Charge',
    value: 0,
    acMod: 0,
    drMod: 0,
    dmgDieCount: 1,
    dmgDie: 6,
    dmgBonus: 0,
    volume: 0,
    components: [{ id: 'damage', label: 'Damage', type: 'explosion', dmgDieCount: 1, dmgDie: 6, dmgBonus: 0 }],
    areaEffects: [{
      id: 'blast', label: 'Blast', kind: 'explosion', damageType: 'explosion',
      damageDieCount: 1, damageDie: 6, damageBonus: 0, radius: 5, minDistance: 1,
    }, {
      id: 'concussion', label: 'Concussion', kind: 'concussion', damageType: 'normal',
      damageDieCount: 0, damageDie: 0, damageBonus: 0, radius: 2,
    }],
    areaRangeUnit: 'm',
    hasBlastRadius: true,
    emp: true,
    isCustom: true,
  };
  const campaignEmpMine: Weapon = {
    id: 'campaign-emp-mine',
    name: 'Campaign Pulse Mine',
    category: 'minesTraps',
    damageType: 'explosion',
    damageDieCount: 1,
    damageDie: 6,
    damageBonus: 0,
    skill: 'traps',
    burstLimit: 1,
    isDoubleShot: false,
    magazineSize: 0,
    weight: 0,
    minStr: 0,
    rangeNormal: 0,
    knockdownChance: 0,
    mods: [],
    isCustom: true,
    customAreaEffects: [{
      id: 'blast', label: 'Blast', kind: 'explosion', damageType: 'explosion',
      damageDieCount: 1, damageDie: 6, damageBonus: 0,
    }],
    emp: true,
  };
  const raw = JSON.stringify(fixture);
  const persistedRaw = JSON.stringify({
    ...fixture,
    areaProfileRangeOverrides: {
      ...fixture.areaProfileRangeOverrides,
      'ammo:rocket_explosive': { main: 38, invalid: -1 },
    },
  });
  assert.equal(raw.includes('usesDerivedArmorClass'), false, 'fixture must predate the AC policy');
  assert.equal(legacyNpc.bestiaryTemplateId, legacyTemplate.id);
  assert.equal(legacyNpc.manualDerivedStats?.armorClass, 36);

  // Only the native boundaries are substituted. React effects, JSON parsing,
  // AppProvider normalization, context consumers and save-back all run normally.
  const storage = new Map([[STORAGE_KEY, persistedRaw]]);
  const reads: string[] = [];
  const writes: string[] = [];
  let rejectNextWrite = false;
  const storageUrl = 'test:campaign-storage';
  const hooks = registerHooks({
    resolve(specifier, context, nextResolve) {
      if (specifier === '@react-native-async-storage/async-storage') {
        return { url: storageUrl, shortCircuit: true };
      }
      if (specifier === 'react-native' || specifier === 'expo-file-system') {
        return { url: `test:${specifier}`, shortCircuit: true };
      }
      if (specifier.startsWith('@/')) {
        const url = new URL(`../${specifier.slice(2)}.ts`, import.meta.url).href;
        return nextResolve(url, context);
      }
      if (specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier)) {
        return nextResolve(`${specifier}.ts`, context);
      }
      return nextResolve(specifier, context);
    },
    load(url, context, nextLoad) {
      if (url === storageUrl) {
        return {
          format: 'module', shortCircuit: true,
          source: 'export default globalThis.__campaignReloadStorage;',
        };
      }
      if (url === 'test:react-native') {
        return { format: 'module', shortCircuit: true, source: "export const Platform = { OS: 'web' };" };
      }
      if (url === 'test:expo-file-system') {
        return { format: 'module', shortCircuit: true, source: 'export class Directory {} export const Paths = {};' };
      }
      // Match Metro's removal of type-only imports in legacy .ts modules too.
      if (url.startsWith(new URL('../', import.meta.url).href) && /\.tsx?$/.test(url)) {
        return {
          format: 'module', shortCircuit: true,
          source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), {
            compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.React },
          }).outputText,
        };
      }
      return nextLoad(url, context);
    },
  });
  const globals = globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT?: boolean;
    __campaignReloadStorage?: {
      getItem(key: string): Promise<string | null>;
      setItem(key: string, value: string): Promise<void>;
    };
  };
  const previousActEnvironment = globals.IS_REACT_ACT_ENVIRONMENT;
  globals.IS_REACT_ACT_ENVIRONMENT = true;
  globals.__campaignReloadStorage = {
    async getItem(key) {
      reads.push(key);
      return storage.get(key) ?? null;
    },
    async setItem(key, value) {
      writes.push(key);
      if (rejectNextWrite) {
        rejectNextWrite = false;
        throw new Error('simulated storage write failure');
      }
      storage.set(key, value);
    },
  };
  let renderer: ReactTestRenderer | undefined;
  try {
    const { AppProvider, useApp } = await import('../context/AppContext.tsx');
    let campaign: ReturnType<typeof useApp> | undefined;
    const currentCampaign = () => campaign as ReturnType<typeof useApp>;
    function Consumer() {
      campaign = useApp();
      return null;
    }
    const mount = async () => {
      await act(async () => {
        renderer = create(React.createElement(AppProvider, null, React.createElement(Consumer)));
      });
      assert.ok(campaign);
      return campaign;
    };
    const sheet = (character: Character) => resolveArmorAwareSheet({
      special: character.special,
      skills: character.skills,
      manualDerivedStats: character.manualDerivedStats,
      usesDerivedArmorClass: character.usesDerivedArmorClass,
      naturalArmorClass: character.naturalProtection?.armorClass,
      equippedBodyArmorId: character.equippedBodyArmorId,
      equippedHelmetId: character.equippedHelmetId,
      allArmor: BUILT_IN_ARMOR,
    });
    // Prove the fixture would reproduce the reported inflated total without repair.
    assert.equal(sheet(legacyNpc).armorClass, 67);

    for (const reload of ['legacy load', 'repaired save reload']) {
      const restored = await mount();
      assert.equal(restored.customBestiaryTemplates.length, 1, reload);
      assert.deepEqual(restored.areaProfileRangeOverrides, {
        'ammo:rocket_explosive': { main: 38 },
        'ammo:51mm_explosive_mortar': { main: 999 },
      }, `${reload}: saved blast ranges are restored and malformed entries removed`);
      const mortarProfile = EXPLOSIVE_AMMO_AREA_PROFILES.find(profile => profile.id === 'ammo:51mm_explosive_mortar')!;
      assert.equal(
        areaProfileRange(mortarProfile, mortarProfile.effects[0], restored.areaProfileRangeOverrides),
        20,
        `${reload}: a custom range does not replace the printed mortar radius`,
      );
      assert.deepEqual(restored.campaignRuleTags, campaignRuleTags, `${reload}: custom tag definitions retained`);
      assert.deepEqual(restored.customWeaponMods[0]?.appliesToTags, customWeaponMod.appliesToTags, `${reload}: mod tag references retained`);
      assert.deepEqual(restored.customPerks[0]?.conditions, customPerk.conditions, `${reload}: perk weapon and armor conditions retained`);
      const template = restored.customBestiaryTemplates[0];
      assert.equal(template.usesDerivedArmorClass, true, `${reload}: template repaired`);
      const npc = restored.characters.find(character => character.id === legacyNpc.id)!;
      assert.ok(npc, `${reload}: linked NPC restored`);
      assert.deepEqual(
        npc.perks[0].appliedCustomPerkGrants,
        legacyNpc.perks[0].appliedCustomPerkGrants,
        `${reload}: custom perk source grants restored`,
      );
      assert.equal(npc.bestiaryTemplateId, template.id);
      assert.equal(npc.usesDerivedArmorClass, true, `${reload}: NPC repaired`);
      const resolved = sheet(npc);
      assert.equal(resolved.armorClass, 36, reload);
      assert.equal(resolved.armorClassBreakdown.agility, 5);
      assert.equal(resolved.armorClassBreakdown.bodyArmor, 25);
      assert.equal(resolved.armorClassBreakdown.helmet, 6);
      assert.equal(resolved.armorClassBreakdown.manual, 0);
      const freshSpawn = spawnBestiaryTemplate(template, BUILT_IN_WEAPONS, 'After reload', 'fresh-npc');
      assert.equal(sheet(freshSpawn).armorClass, 36, `${reload}: repaired template spawns correctly`);

      const printed = restored.characters.find(character => character.id === printedNpc.id)!;
      assert.ok(printed, `${reload}: printed creature restored`);
      assert.notEqual(printed.usesDerivedArmorClass, true);
      assert.equal(printed.manualDerivedStats?.armorClass, brahmin.armorClass);
      assert.equal(sheet(printed).armorClass, brahmin.armorClass, `${reload}: printed AC unchanged`);
      const savedVehicle = restored.characters.find(character => character.id === persistentVehicle.id)!;
      assert.equal(savedVehicle.vehicle?.systems.find(system => system.id === 'engine')?.currentHp, 45, `${reload}: repaired engine HP restored`);
      assert.deepEqual(savedVehicle.vehicle?.repairHistory, repairAttempt.record ? [repairAttempt.record] : [], `${reload}: repair history restored`);
      assert.deepEqual(savedVehicle.vehicle?.weaponSlots, vehicleSlots, `${reload}: vehicle weapon slots restored`);
      assert.deepEqual(savedVehicle.vehicle?.mountedWeapons, ['Rheinmetall 120mm Gun', 'M2HB ×2'], `${reload}: mounted weapon names restored`);
      assert.deepEqual(savedVehicle.vehicleCrew, { pilotCharacterId: legacyNpc.id, gunnerCharacterId: printedNpc.id }, `${reload}: crew IDs restored`);
      await act(async () => renderer!.unmount());
      renderer = undefined;
    }
    assert.deepEqual(reads, [STORAGE_KEY, STORAGE_KEY]);
    assert.deepEqual(writes, [STORAGE_KEY, STORAGE_KEY]);
    const saved = JSON.parse(storage.get(STORAGE_KEY)!);
    assert.deepEqual(saved.areaProfileRangeOverrides, {
      'ammo:rocket_explosive': { main: 38 },
      'ammo:51mm_explosive_mortar': { main: 999 },
    });
    assert.equal(saved.customBestiaryTemplates[0].usesDerivedArmorClass, true);
    assert.equal(saved.characters[0].usesDerivedArmorClass, true);
    assert.deepEqual(saved.characters[0].perks[0].appliedCustomPerkGrants, legacyNpc.perks[0].appliedCustomPerkGrants);
    assert.equal(saved.customPerks[0].effects[0].application, 'oneTime');
    assert.deepEqual(saved.campaignRuleTags, campaignRuleTags);
    assert.deepEqual(saved.customWeaponMods[0].appliesToTags, customWeaponMod.appliesToTags);
    assert.deepEqual(saved.customPerks[0].conditions, customPerk.conditions);
    assert.equal(saved.characters[2].vehicle.systems.find((system: { id: string }) => system.id === 'engine').currentHp, 45);
    assert.equal(saved.characters[2].vehicle.repairHistory[0].restoredHp, 15);
    assert.deepEqual(saved.characters[2].vehicle.weaponSlots, vehicleSlots);
    assert.deepEqual(saved.characters[2].vehicle.mountedWeapons, ['Rheinmetall 120mm Gun', 'M2HB ×2']);
    assert.deepEqual(saved.characters[2].vehicleCrew, { pilotCharacterId: legacyNpc.id, gunnerCharacterId: printedNpc.id });

    await t.test('automatic inventory use keeps reusable bags and commits item, AP, and chem effects together', async () => {
      storage.clear();
      campaign = undefined;
      try {
        await mount();
        await act(async () => {
          assert.equal(await currentCampaign().importCampaign(JSON.stringify({
            ...fixture,
            automaticInventoryTrackingEnabled: true,
            characters: [{
              ...legacyNpc,
              id: 'inventory-use-test',
              type: 'pc',
              currentAP: 10,
              currentHp: 1,
              inventoryItems: [
                { category: 'tool', itemId: 'doctors_bag', quantity: 1 },
                { category: 'tool', itemId: 'medical_kit', quantity: 1 },
                { category: 'consumable', itemId: 'jet', quantity: 1 },
              ],
            }],
            initiativeEntries: [],
          })), true);
        });
        const character = () => currentCampaign().characters.find(c => c.id === 'inventory-use-test')!;
        const quantity = (itemId: string) => character().inventoryItems?.find(item => item.itemId === itemId)?.quantity ?? 0;
        assert.equal(quantity('doctors_bag'), 1, 'import retains the carried bag');
        let used = false;
        await act(async () => { used = currentCampaign().useInventoryItem(character().id, 'tool', 'doctors_bag', 1); });
        assert.equal(used, true, 'successful use is reported to the combat UI');
        await act(async () => { currentCampaign().useInventoryItem(character().id, 'tool', 'doctors_bag', 1); });
        assert.equal(quantity('doctors_bag'), 1);
        assert.equal(character().currentAP, 8);
        await act(async () => { used = currentCampaign().useInventoryItem(character().id, 'tool', 'medical_kit', 1); });
        assert.equal(used, true);
        assert.equal(quantity('medical_kit'), 0);
        assert.equal(character().currentAP, 7);
        await act(async () => { used = currentCampaign().useInventoryItem(character().id, 'tool', 'medical_kit', 1); });
        assert.equal(used, false);
        assert.equal(character().currentAP, 7, 'missing items cannot charge AP');
        await act(async () => {
          currentCampaign().useInventoryItem(character().id, 'consumable', 'jet', 1, {
            id: 'inventory-chem-effect', kind: 'chem', chemId: 'jet', name: 'Test chem',
            hpMod: 2, isActive: true,
          });
        });
        assert.equal(quantity('jet'), 0);
        assert.equal(character().currentHp, 3);
        assert.equal(character().currentAP, 6);
        assert.equal(character().effects?.filter(effect => effect.id === 'inventory-chem-effect').length, 1);
        await act(async () => {
          assert.equal(currentCampaign().useInventoryItem(character().id, 'tool', 'doctors_bag', 1), true);
          assert.equal(currentCampaign().useInventoryItem(character().id, 'tool', 'doctors_bag', 1), true);
        });
        assert.equal(character().currentAP, 4, 'batched uses see the latest queued AP');
        assert.equal(quantity('doctors_bag'), 1);
        await act(async () => { currentCampaign().setAutomaticInventoryTrackingEnabled(false); });
        await act(async () => { currentCampaign().useInventoryItem(character().id, 'consumable', 'jet', 1); });
        assert.equal(character().currentAP, 3);
        assert.equal(quantity('jet'), 0, 'tracking off leaves inventory unchanged');
        await act(async () => {
          assert.equal(currentCampaign().useInventoryItem(character().id, 'tool', 'doctors_bag', 4), false);
        });
        assert.equal(character().currentAP, 3, 'insufficient AP rejects use without changing inventory');
      } finally {
        if (renderer) await act(async () => renderer!.unmount());
        renderer = undefined;
      }
    });

    await t.test('campaign import and reload preserve custom EMP ammunition and mine settings', async () => {
      storage.clear();
      campaign = undefined;
      try {
        const empty = await mount();
        let imported = false;
        await act(async () => {
          imported = await empty.importCampaign(JSON.stringify({
            ...fixture,
            customAmmo: [customEmpAmmo],
            customWeapons: [campaignEmpMine],
          }));
        });
        assert.equal(imported, true, 'campaign with custom EMP data imports');
        assert.equal(currentCampaign().customAmmo[0]?.emp, true);
        assert.equal(currentCampaign().customAmmo[0]?.hasBlastRadius, true);
        assert.equal(currentCampaign().customWeapons[0]?.emp, true);
        const exported = JSON.parse(currentCampaign().exportCampaign());
        assert.deepEqual(exported.customAmmo, [customEmpAmmo]);
        const expectedZones = buildAreaDamageZones(
          createCustomAmmoAreaDamageProfiles([customEmpAmmo])[0],
          {},
          { blast: 8, concussion: 0 },
        );
        assert.deepEqual(
          buildAreaDamageZones(
            createCustomAmmoAreaDamageProfiles(exported.customAmmo)[0],
            {},
            { blast: 8, concussion: 0 },
          ),
          expectedZones,
        );

        await act(async () => renderer!.unmount());
        renderer = undefined;
        campaign = undefined;

        const restored = await mount();
        assert.equal(restored.customAmmo[0]?.emp, true, 'custom ammunition EMP flag survives reload');
        assert.equal(restored.customAmmo[0]?.hasBlastRadius, true, 'custom ammunition Blast Radius toggle survives reload');
        assert.deepEqual(restored.customAmmo[0]?.areaEffects, customEmpAmmo.areaEffects);
        assert.equal(restored.customWeapons[0]?.emp, true, 'custom mine EMP flag survives reload');
        assert.deepEqual(restored.customWeapons[0]?.customAreaEffects?.[0].id, 'blast');
      } finally {
        if (renderer) await act(async () => renderer!.unmount());
        renderer = undefined;
      }
    });

    await t.test('older campaigns without custom ammunition import with an empty catalog', async () => {
      storage.clear();
      campaign = undefined;
      try {
        const empty = await mount();
        const { customAmmo: _omitted, ...olderCampaign } = fixture;
        let imported = false;
        await act(async () => {
          imported = await empty.importCampaign(JSON.stringify(olderCampaign));
        });
        assert.equal(imported, true);
        assert.deepEqual(currentCampaign().customAmmo, []);
        assert.deepEqual(JSON.parse(currentCampaign().exportCampaign()).customAmmo, []);
      } finally {
        if (renderer) await act(async () => renderer!.unmount());
        renderer = undefined;
        campaign = undefined;
      }
    });

    await t.test('spawned built-in NPCs remain snapshots after catalog edits and removals', async () => {
      storage.clear();
      campaign = undefined;
      const sourceTemplate = MANUAL_BESTIARY.find(template => template.id === 'deathclaw')!;
      const removedTemplate = MANUAL_BESTIARY.find(template => template.id === 'giant_rat')!;
      const editedTemplate: BestiaryTemplate = {
        ...sourceTemplate,
        name: 'Edited Deathclaw',
        race: 'robot',
        maxHp: sourceTemplate.maxHp + 100,
        portrait: 'data:image/png;base64,AQID',
      };
      const editedNpc = {
        ...spawnBestiaryTemplate(sourceTemplate, BUILT_IN_WEAPONS, 'Wounded Deathclaw', 'edited-source-npc'),
        race: 'human' as const,
        portrait: 'file:///current-npc-portrait.png',
        special: { ...sourceTemplate.special, strength: 3 },
        maxHp: 47,
        currentHp: 13,
        currentAP: 2,
        tempAC: 6,
        position: 'prone' as const,
        conditions: ['poisoned'],
        skills: { ...sourceTemplate.skills, repair: 42 },
      };
      const removedNpc = {
        ...spawnBestiaryTemplate(removedTemplate, BUILT_IN_WEAPONS, 'Surviving Giant Rat', 'removed-source-npc'),
        currentHp: 4,
        currentAP: 1,
      };
      const assertSnapshot = (
        state: Pick<ReturnType<typeof useApp>, 'characters' | 'builtInBestiaryOverrides' | 'removedBuiltInBestiaryTemplateIds'>,
        stage: string,
      ) => {
        const edited = state.characters.find(character => character.id === editedNpc.id);
        assert.ok(edited, `${stage}: NPC remains in Characters`);
        assert.equal(edited.race, editedNpc.race, `${stage}: edited NPC race preserved`);
        assert.equal(edited.portrait, editedNpc.portrait, `${stage}: current portrait preserved`);
        assert.deepEqual(edited.special, editedNpc.special, `${stage}: SPECIAL preserved`);
        assert.equal(edited.maxHp, editedNpc.maxHp, `${stage}: max HP preserved`);
        assert.equal(edited.currentHp, editedNpc.currentHp, `${stage}: current HP preserved`);
        assert.equal(edited.currentAP, editedNpc.currentAP, `${stage}: current AP preserved`);
        assert.equal(edited.tempAC, editedNpc.tempAC, `${stage}: temporary AC preserved`);
        assert.equal(edited.position, editedNpc.position, `${stage}: combat position preserved`);
        assert.deepEqual(edited.conditions, editedNpc.conditions, `${stage}: combat conditions preserved`);
        assert.deepEqual(edited.skills, editedNpc.skills, `${stage}: skills preserved`);

        const removed = state.characters.find(character => character.id === removedNpc.id);
        assert.ok(removed, `${stage}: NPC remains after its source entry is removed`);
        assert.equal(removed.currentHp, removedNpc.currentHp, `${stage}: removed-source NPC HP preserved`);
        assert.equal(removed.currentAP, removedNpc.currentAP, `${stage}: removed-source NPC AP preserved`);
        assert.equal(state.builtInBestiaryOverrides[0]?.name, editedTemplate.name, `${stage}: edited catalog entry retained`);
        assert.deepEqual(state.removedBuiltInBestiaryTemplateIds, [removedTemplate.id], `${stage}: removed catalog entry retained`);

        const catalog = resolveBestiaryTemplates(
          MANUAL_BESTIARY,
          state.builtInBestiaryOverrides,
          state.removedBuiltInBestiaryTemplateIds,
          [],
        );
        assert.equal(catalog.some(template => template.id === removedTemplate.id), false, `${stage}: removed entry hidden`);
        const currentTemplate = catalog.find(template => template.id === sourceTemplate.id)!;
        const futureSpawn = spawnBestiaryTemplate(currentTemplate, BUILT_IN_WEAPONS, 'Future Spawn', `${stage}-future-spawn`);
        assert.equal(futureSpawn.name, 'Future Spawn');
        assert.equal(futureSpawn.race, editedTemplate.race, `${stage}: future spawn uses the edited template`);
        assert.equal(futureSpawn.maxHp, editedTemplate.maxHp, `${stage}: future spawn uses edited stats`);
      };

      try {
        const empty = await mount();
        let imported = false;
        await act(async () => {
          imported = await empty.importCampaign(JSON.stringify({
            characters: [editedNpc, removedNpc],
            builtInBestiaryOverrides: [editedTemplate],
            removedBuiltInBestiaryTemplateIds: [removedTemplate.id],
          }));
        });
        assert.equal(imported, true, 'campaign with edited and removed built-in entries imports');
        assert.ok(campaign);
        assertSnapshot(campaign, 'imported state');
        assertSnapshot(JSON.parse(storage.get(STORAGE_KEY)!), 'saved campaign');

        await act(async () => renderer!.unmount());
        renderer = undefined;
        campaign = undefined;
        assertSnapshot(await mount(), 'reloaded campaign');
      } finally {
        if (renderer) await act(async () => renderer!.unmount());
        renderer = undefined;
      }
    });

    await t.test('reload repairs legacy NPC armor after its custom template is deleted', async () => {
      const orphanNpc: Character = {
        ...legacyNpc,
        id: 'orphan-custom-npc',
        bestiaryTemplateId: 'deleted-custom-template',
        manualDerivedStats: {
          armorClass: 36,
          maxAP: 9,
          sequence: 17,
          criticalChance: 11,
          baseMaxHp: 83,
        },
      };
      assert.equal(orphanNpc.usesDerivedArmorClass, undefined, 'legacy NPC has no AC policy');
      assert.equal(
        BUILT_IN_BESTIARY.some(template => template.id === orphanNpc.bestiaryTemplateId),
        false,
        'deleted template identity is not a built-in',
      );
      assert.equal(sheet(orphanNpc).armorClass, 67, 'legacy armor is double-counted before reload');
      const orphanRaw = JSON.stringify({
        ...fixture,
        characters: [orphanNpc],
        customBestiaryTemplates: [],
      });
      storage.clear();
      storage.set(STORAGE_KEY, orphanRaw);
      campaign = undefined;
      const assertRepaired = (
        state: Pick<ReturnType<typeof useApp>, 'characters' | 'customBestiaryTemplates'>,
        stage: string,
      ) => {
        assert.deepEqual(state.customBestiaryTemplates, [], `${stage}: deleted template stays absent`);
        assert.equal(state.characters.length, 1, stage);
        const npc = state.characters[0];
        assert.equal(npc.id, orphanNpc.id, stage);
        assert.equal(npc.bestiaryTemplateId, orphanNpc.bestiaryTemplateId, `${stage}: provenance retained`);
        assert.equal(npc.usesDerivedArmorClass, true, `${stage}: orphan NPC policy repaired`);
        assert.equal(npc.equippedBodyArmorId, 'greater_banding', `${stage}: body armor retained`);
        assert.equal(npc.equippedHelmetId, 'metal_helmet', `${stage}: helmet retained`);
        for (const key of ['equippedWeaponId', 'rightHandWeaponId', 'leftHandWeaponId', 'inventoryWeaponIds'] as const) {
          assert.deepEqual(npc[key], orphanNpc[key], `${stage}: ${key} retained`);
        }
        assert.deepEqual(npc.manualDerivedStats, orphanNpc.manualDerivedStats, `${stage}: manual stats retained`);
        const resolved = sheet(npc);
        assert.equal(resolved.armorClass, 36, `${stage}: armor counted only once`);
        assert.equal(resolved.armorClassBreakdown.agility, 5, stage);
        assert.equal(resolved.armorClassBreakdown.bodyArmor, 25, stage);
        assert.equal(resolved.armorClassBreakdown.helmet, 6, stage);
        assert.equal(resolved.armorClassBreakdown.manual, 0, stage);
        assert.equal(resolved.maxAP, 9, `${stage}: manual AP still applied`);
        assert.equal(resolved.sequence, 17, `${stage}: manual Sequence still applied`);
        assert.equal(resolved.criticalChance, 11, `${stage}: manual critical chance still applied`);
      };
      try {
        for (const stage of ['legacy orphan load', 'repaired orphan save reload']) {
          const readsBefore = reads.length;
          const writesBefore = writes.length;
          assertRepaired(await mount(), stage);
          assert.deepEqual(reads.slice(readsBefore), [STORAGE_KEY], `${stage}: provider reads saved campaign`);
          assert.deepEqual(writes.slice(writesBefore), [STORAGE_KEY], `${stage}: provider saves normalized campaign`);
          assertRepaired(JSON.parse(storage.get(STORAGE_KEY)!), `${stage}: saved state`);
          await act(async () => renderer!.unmount());
          renderer = undefined;
          campaign = undefined;
        }
      } finally {
        if (renderer) await act(async () => renderer!.unmount());
        renderer = undefined;
      }
    });

    await t.test('importCampaign repairs legacy custom armor and saves the imported repair', async () => {
      storage.clear();
      campaign = undefined;
      try {
        const empty = await mount();
        assert.equal(empty.loaded, true);
        assert.deepEqual(empty.characters, []);
        assert.deepEqual(empty.customBestiaryTemplates, []);
        const writesBeforeImport = writes.length;
        await act(async () => {
          assert.equal(await empty.importCampaign(raw), true, 'legacy campaign import accepted');
        });
        assert.ok(campaign);
        const assertRepaired = (
          state: Pick<ReturnType<typeof useApp>, 'characters' | 'customBestiaryTemplates'>,
          stage: string,
        ) => {
          assert.equal(state.customBestiaryTemplates.length, 1, stage);
          const template = state.customBestiaryTemplates[0];
          assert.equal(template.id, legacyTemplate.id, stage);
          assert.equal(template.usesDerivedArmorClass, true, `${stage}: custom template repaired`);
           assert.equal(state.characters.length, 3, stage);
          const npc = state.characters.find(character => character.id === legacyNpc.id)!;
          assert.ok(npc, `${stage}: linked NPC present`);
          assert.equal(npc.bestiaryTemplateId, template.id, stage);
          assert.equal(npc.usesDerivedArmorClass, true, `${stage}: linked NPC repaired`);
          assert.equal(npc.equippedBodyArmorId, 'greater_banding', stage);
          assert.equal(npc.equippedHelmetId, 'metal_helmet', stage);
          const resolved = sheet(npc);
          assert.equal(resolved.armorClass, 36, stage);
          assert.equal(resolved.armorClassBreakdown.agility, 5, stage);
          assert.equal(resolved.armorClassBreakdown.bodyArmor, 25, stage);
          assert.equal(resolved.armorClassBreakdown.helmet, 6, stage);
          assert.equal(resolved.armorClassBreakdown.manual, 0, stage);
          const freshSpawn = spawnBestiaryTemplate(template, BUILT_IN_WEAPONS, 'After import', 'import-spawn');
          assert.equal(sheet(freshSpawn).armorClass, 36, `${stage}: repaired template spawns correctly`);
          const printed = state.characters.find(character => character.id === printedNpc.id)!;
          assert.ok(printed, `${stage}: printed creature present`);
          assert.notEqual(printed.usesDerivedArmorClass, true, stage);
          assert.equal(printed.manualDerivedStats?.armorClass, brahmin.armorClass, stage);
          assert.equal(sheet(printed).armorClass, brahmin.armorClass, `${stage}: printed AC unchanged`);
           const savedVehicle = state.characters.find(character => character.id === persistentVehicle.id)!;
           assert.equal(savedVehicle.vehicle?.systems.find(system => system.id === 'engine')?.currentHp, 45, `${stage}: repaired engine HP`);
           assert.deepEqual(savedVehicle.vehicle?.repairHistory, [repairAttempt.record], `${stage}: repair log`);
            assert.deepEqual(savedVehicle.vehicle?.weaponSlots, vehicleSlots, `${stage}: weapon slots`);
            assert.deepEqual(savedVehicle.vehicle?.mountedWeapons, ['Rheinmetall 120mm Gun', 'M2HB ×2'], `${stage}: mounted weapons`);
            assert.deepEqual(savedVehicle.vehicleCrew, { pilotCharacterId: legacyNpc.id, gunnerCharacterId: printedNpc.id }, `${stage}: crew IDs`);
        };
        assertRepaired(campaign, 'imported state');
        assert.deepEqual(writes.slice(writesBeforeImport), [STORAGE_KEY], 'import triggers save-back');
        assertRepaired(JSON.parse(storage.get(STORAGE_KEY)!), 'saved import');

        await act(async () => renderer!.unmount());
        renderer = undefined;
        campaign = undefined;
        const readsBeforeReload = reads.length;
        assertRepaired(await mount(), 'imported save reload');
        assert.deepEqual(reads.slice(readsBeforeReload), [STORAGE_KEY], 'fresh provider reads imported save');
      } finally {
        if (renderer) await act(async () => renderer!.unmount());
        renderer = undefined;
      }
    });

    await t.test('importCampaign preserves template AC policy and existing NPC policy independently', async () => {
      storage.clear();
      campaign = undefined;
      const fixedTemplate: BestiaryTemplate = {
        ...legacyTemplate,
        id: 'fixed-custom-armored',
        name: 'Fixed Custom Armored NPC',
        usesDerivedArmorClass: false,
      };
      const fixedNpc = {
        ...spawnBestiaryTemplate(fixedTemplate, BUILT_IN_WEAPONS, fixedTemplate.name, 'fixed-custom-npc'),
        usesDerivedArmorClass: false,
      };
      const existingDerivedNpc = {
        ...spawnBestiaryTemplate(fixedTemplate, BUILT_IN_WEAPONS, 'Existing Derived NPC', 'existing-derived-npc'),
        usesDerivedArmorClass: true,
      };
      const fixedCampaign = {
        characters: [fixedNpc, existingDerivedNpc],
        customBestiaryTemplates: [fixedTemplate],
        customWeapons: [],
        customArmor: [],
        customAmmo: [],
        initiativeEntries: [],
      };
      const fixedRaw = JSON.stringify(fixedCampaign);
      assert.equal(fixedNpc.usesDerivedArmorClass, false);
      assert.equal(fixedNpc.bestiaryTemplateId, fixedTemplate.id);
      assert.equal(fixedNpc.manualDerivedStats?.armorClass, 36);

      try {
        const empty = await mount();
        assert.equal(empty.loaded, true);
        const writesBeforeImport = writes.length;
        await act(async () => {
          assert.equal(await empty.importCampaign(fixedRaw), true, 'fixed-AC campaign import accepted');
        });
        assert.ok(campaign);
        const assertFixedArmor = (
          state: Pick<ReturnType<typeof useApp>, 'characters' | 'customBestiaryTemplates'>,
          stage: string,
        ) => {
          assert.equal(state.customBestiaryTemplates.length, 1, stage);
          const template = state.customBestiaryTemplates[0];
          assert.equal(template.id, fixedTemplate.id, stage);
          assert.equal(template.usesDerivedArmorClass, false, `${stage}: fixed-AC template retained`);
          assert.equal(state.characters.length, 2, stage);
          const npc = state.characters.find(character => character.id === fixedNpc.id)!;
          assert.equal(npc.bestiaryTemplateId, template.id, stage);
          assert.equal(npc.usesDerivedArmorClass, false, `${stage}: explicit fixed-AC policy preserved`);
          assert.equal(npc.manualDerivedStats?.armorClass, 36, `${stage}: manual AC preserved`);
          assert.equal(npc.equippedBodyArmorId, 'greater_banding', `${stage}: body armor preserved`);
          assert.equal(npc.equippedHelmetId, 'metal_helmet', `${stage}: helmet preserved`);
          const resolved = sheet(npc);
          assert.equal(resolved.armorClass, 67, `${stage}: manual AC and equipment both contribute`);
          assert.equal(resolved.armorClassBreakdown.agility, 5, stage);
          assert.equal(resolved.armorClassBreakdown.manual, 31, stage);
          assert.equal(resolved.armorClassBreakdown.bodyArmor, 25, stage);
          assert.equal(resolved.armorClassBreakdown.helmet, 6, stage);

          const derivedNpc = state.characters.find(character => character.id === existingDerivedNpc.id)!;
          assert.ok(derivedNpc, `${stage}: existing derived NPC present`);
          assert.equal(derivedNpc.usesDerivedArmorClass, true, `${stage}: existing NPC policy is not replaced by template policy`);
          assert.equal(sheet(derivedNpc).armorClass, 36, `${stage}: existing derived NPC still resolves from Agility and armor`);

          const freshSpawn = spawnBestiaryTemplate(template, BUILT_IN_WEAPONS, 'New fixed NPC', `${stage}-new-fixed-npc`);
          assert.equal(freshSpawn.usesDerivedArmorClass, false, `${stage}: new NPC inherits fixed template policy`);
        };

        assertFixedArmor(campaign, 'imported state');
        assert.deepEqual(writes.slice(writesBeforeImport), [STORAGE_KEY], 'import triggers save-back');
        assertFixedArmor(JSON.parse(storage.get(STORAGE_KEY)!), 'saved import');

        await act(async () => renderer!.unmount());
        renderer = undefined;
        campaign = undefined;
        const readsBeforeReload = reads.length;
        assertFixedArmor(await mount(), 'imported save reload');
        assert.deepEqual(reads.slice(readsBeforeReload), [STORAGE_KEY], 'fresh provider reads imported save');
      } finally {
        if (renderer) await act(async () => renderer!.unmount());
        renderer = undefined;
      }
    });

    await t.test('importCampaign rejects malformed records and collection shapes without replacing a populated campaign', async () => {
      storage.clear();
      campaign = undefined;

      try {
        const empty = await mount();
        assert.equal(empty.loaded, true);
        await act(async () => {
          assert.equal(await empty.importCampaign(raw), true, 'populated campaign import accepted');
        });
        const current = () => {
          assert.ok(campaign);
          return campaign;
        };
        assert.equal(current().characters.length, 3);
        assert.equal(current().customBestiaryTemplates.length, 1);

        const liveBefore = current().exportCampaign();
        const storedBefore = storage.get(STORAGE_KEY);
        assert.ok(storedBefore, 'populated campaign saved');
        const writesBefore = writes.length;

        const malformedCharacter = { ...legacyNpc, conditions: {} };
        const incompleteCharacter = { id: 'incomplete-character', name: 'Incomplete Character' };
        for (const [label, invalidJson] of [
          ['malformed JSON', '{'],
          ['missing characters array', JSON.stringify({
            customBestiaryTemplates: [],
            customWeapons: [],
            customArmor: [],
            customAmmo: [],
            initiativeEntries: [],
          })],
          ['null character record', JSON.stringify({ ...fixture, characters: [null] })],
          ['incomplete character record', JSON.stringify({ ...fixture, characters: [incompleteCharacter] })],
          ['malformed character collection', JSON.stringify({ ...fixture, characters: [malformedCharacter] })],
          ['malformed top-level collection', JSON.stringify({ ...fixture, customWeapons: {} })],
          ['non-record collection entry', JSON.stringify({ ...fixture, customArmor: [null] })],
        ] as const) {
          await act(async () => {
            assert.equal(await current().importCampaign(invalidJson), false, `${label} rejected`);
          });
          assert.equal(current().exportCampaign(), liveBefore, `${label} leaves live campaign unchanged`);
          assert.equal(storage.get(STORAGE_KEY), storedBefore, `${label} leaves saved campaign unchanged`);
          assert.equal(writes.length, writesBefore, `${label} does not trigger a replacement save`);
        }
      } finally {
        if (renderer) await act(async () => renderer!.unmount());
        renderer = undefined;
      }
    });

    await t.test('importCampaign keeps the current and saved campaign when its write fails', async () => {
      storage.clear();
      campaign = undefined;

      try {
        const empty = await mount();
        assert.equal(empty.loaded, true);
        const existingCampaign = JSON.stringify({ ...fixture, characters: [legacyNpc] });
        await act(async () => {
          assert.equal(await empty.importCampaign(existingCampaign), true, 'existing campaign accepted');
        });
        const current = () => {
          assert.ok(campaign);
          return campaign;
        };

        const liveBefore = current().exportCampaign();
        const storedBefore = storage.get(STORAGE_KEY);
        assert.ok(storedBefore, 'existing campaign persisted before replacement');
        const writesBefore = writes.length;
        const replacementCampaign = JSON.stringify({ ...fixture, characters: [printedNpc] });
        rejectNextWrite = true;

        await act(async () => {
          assert.equal(
            await current().importCampaign(replacementCampaign),
            false,
            'failed storage write rejects the import',
          );
        });

        assert.equal(current().exportCampaign(), liveBefore, 'failed import leaves live campaign unchanged');
        assert.equal(storage.get(STORAGE_KEY), storedBefore, 'failed import leaves saved campaign unchanged');
        assert.equal(writes.length, writesBefore + 1, 'the import attempts one write and does not schedule another');

        await act(async () => renderer!.unmount());
        renderer = undefined;
        campaign = undefined;
        const reloaded = await mount();
        assert.equal(reloaded.exportCampaign(), liveBefore, 'the prior saved campaign still reloads');
      } finally {
        if (renderer) await act(async () => renderer!.unmount());
        renderer = undefined;
      }
    });

    for (const hasStat of [false, true]) {
      for (const outcome of [
        'success', 'failure', 'cancel',
        'healer unconscious', 'target conscious', 'healer removed', 'target removed',
      ] as const) {
        for (const roundAdvance of ['nextTurn', 'nextRound'] as const) {
          const invalidOutcome = !['success', 'failure', 'cancel'].includes(outcome);
          const invalidateBeforeReady = invalidOutcome && roundAdvance === 'nextTurn';
          await t.test(`${hasStat ? 'Stat!' : 'ordinary'} delayed healer: reload, ${roundAdvance}, reload, ${outcome}${invalidOutcome ? (invalidateBeforeReady ? ' before ready' : ' after ready') : ''}`, async () => {
            storage.clear();
            campaign = undefined;
            await mount();
            const current = () => {
              assert.ok(campaign);
              return campaign;
            };
            const healer: Character = {
              ...spawnBestiaryTemplate(legacyTemplate, BUILT_IN_WEAPONS, 'Healer', 'healer'),
              race: 'human',
              bestiaryTemplateId: undefined,
              naturalProtection: undefined,
              manualDerivedStats: undefined,
              special: {
                strength: 5, perception: 5, endurance: 5, charisma: 5,
                intelligence: 5, agility: 5, luck: 5,
              },
              skills: { ...legacyTemplate.skills, firstAid: 50 },
              perks: hasStat ? [{ perkId: 'stat', rank: 1 }] : [],
              currentHp: 20, maxHp: 20, currentAP: 7, maxAP: 7,
              tempAC: 0, isKnockedOut: false, knockOutRoundsLeft: 0,
            };
            const other: Character = { ...healer, id: 'other', name: 'Other', perks: [] };
            const target: Character = {
              ...other, id: 'target', name: 'Fallen', currentHp: 0,
              currentAP: 0, position: 'prone', isKnockedOut: true, knockOutRoundsLeft: 10,
            };
            const characters = [other, healer, target];
            const entries: InitiativeEntry[] = characters.map((character, index) => ({
              id: `entry-${character.id}`, characterId: character.id, name: character.name,
              initiative: 30 - index * 10, sequence: 10,
              currentAP: character.currentAP, maxAP: 7,
              currentHp: character.currentHp, maxHp: character.maxHp,
              armorClass: 36, tempAC: 0, position: character.position,
              hasActed: false, isActive: false,
            }));
            const change = async (operation: () => unknown) => {
              await act(async () => { operation(); });
            };
            const actor = () => current().characters.find(c => c.id === healer.id)!;
            const fallen = () => current().characters.find(c => c.id === target.id)!;
            const actorEntry = () => current().initiativeEntries.find(e => e.characterId === healer.id)!;
            const targetEntry = () => current().initiativeEntries.find(e => e.characterId === target.id)!;
            const stored = () => JSON.parse(storage.get(STORAGE_KEY)!);
            const reload = async () => {
              const before = JSON.parse(current().exportCampaign());
              const readsBefore = reads.length;
              await change(() => renderer!.unmount());
              renderer = undefined;
              campaign = undefined;
              await mount();
              assert.equal(reads.length, readsBefore + 1);
              assert.deepEqual(current().pendingCombatSkillActions, before.pendingCombatSkillActions);
              assert.equal(current().currentRound, before.currentRound);
              assert.equal(current().activeEntryId, before.activeEntryId);
              assert.equal(current().combatActive, true);
            };
            const assertActor = (ap: number, suppressed: boolean) => {
              assert.equal(actor().currentAP, ap, 'character AP');
              assert.equal(actorEntry().currentAP, ap, 'initiative AP');
              assert.equal(!!actor().combatDefenseSuppressed, suppressed);
              assert.equal(actorEntry().armorClass, suppressed ? 31 : 36, 'armor-only vs Agility + armor');
              assert.equal(stored().characters.find((c: Character) => c.id === healer.id).currentAP, ap);
              assert.equal(stored().initiativeEntries.find((e: InitiativeEntry) => e.characterId === healer.id).currentAP, ap);
            };
            const assertUnconscious = () => {
              assert.equal(fallen().isKnockedOut, true);
              assert.equal(fallen().currentHp, 0);
              assert.equal(fallen().currentAP, 0);
              assert.equal(fallen().position, 'prone');
              assert.equal(fallen().revivedNoAPUntilRound, undefined);
              assert.equal(targetEntry().currentHp, 0);
              assert.equal(targetEntry().currentAP, 0);
            };
            const verifyInvalidation = async (actionId: string) => {
              const apBefore = actor().currentAP;
              const removedId = outcome === 'healer removed' ? healer.id
                : outcome === 'target removed' ? target.id : undefined;
              await change(() => {
                if (removedId) current().removeInitiativeEntry(`entry-${removedId}`);
                else if (outcome === 'healer unconscious') current().setKnockedOut(healer.id, 10);
                else {
                  // Independent recovery, not the pending Heal Fallen outcome.
                  current().healCharacter(target.id, 4);
                  current().setKnockedOut(target.id, 0);
                }
              });
              const expectedAP = outcome === 'healer unconscious' ? 0 : apBefore;
              const assertAP = (ap: number) => {
                assert.equal(actor().currentAP, ap, 'invalidation never refunds or charges AP');
                const entry = current().initiativeEntries.find(e => e.characterId === healer.id);
                if (entry) assert.equal(entry.currentAP, ap, 'initiative AP matches');
                assert.equal(stored().characters.find((c: Character) => c.id === healer.id).currentAP, ap);
              };
              const assertTarget = () => {
                assert.equal(fallen().currentHp, outcome === 'target conscious' ? 4 : 0);
                assert.equal(fallen().isKnockedOut, outcome !== 'target conscious');
                assert.equal(fallen().revivedNoAPUntilRound, undefined, 'invalid healing never applies a revival lock');
                assert.equal(fallen().position, 'prone');
                assert.equal(fallen().currentAP, 0);
              };
              assertAP(expectedAP);
              assertTarget();
              if (removedId) {
                assert.ok(current().characters.some(c => c.id === removedId), 'combat removal retains character');
                assert.equal(current().initiativeEntries.some(e => e.characterId === removedId), false);
                assert.deepEqual(current().pendingCombatSkillActions, []);
                assert.equal(actor().combatDefenseSuppressed, false);
              } else {
                assert.equal(current().pendingCombatSkillActions.length, 1);
              }
              // Compare persisted values: JSON intentionally drops undefined optional fields.
              const characterSnapshot = () => JSON.parse(JSON.stringify(current().characters));
              const invalidatedCharacters = characterSnapshot();
              const invalidatedEntries = structuredClone(current().initiativeEntries);
              await reload();
              assert.deepEqual(characterSnapshot(), invalidatedCharacters);
              assert.deepEqual(current().initiativeEntries, invalidatedEntries);
              assertAP(expectedAP);
              assertTarget();

              if (invalidateBeforeReady && !removedId) {
                await change(() => current().completeHealFallen({
                  actionId, resolution: { method: 'automaticSuccess' },
                }));
                assert.equal(current().combatSkillReceipt?.status, 'rejected');
                assert.equal(current().combatSkillReceipt?.spentAP, 0);
                assertAP(expectedAP);
                assertTarget();
                await change(() => current().nextRound());
                assertAP(expectedAP); // Other combatant's turn must not refund AP.
                await change(() => current().nextTurn());
                assert.equal(current().activeEntryId, 'entry-healer');
                assertAP(outcome === 'healer unconscious' ? 0 : 7); // Normal own-turn refill only.
                assert.equal(current().combatSkillReceipt?.success, false);
                assert.match(current().combatSkillReceipt?.reason ?? '', /unconscious healer|already conscious/);
                assert.deepEqual(current().pendingCombatSkillActions, []);
                assertTarget();
              }

              const charactersBeforeCompletion = characterSnapshot();
              const entriesBeforeCompletion = structuredClone(current().initiativeEntries);
              await change(() => current().completeHealFallen({
                actionId, resolution: { method: 'automaticSuccess' },
              }));
              assert.equal(current().combatSkillReceipt?.status,
                !invalidateBeforeReady && !removedId ? 'completed' : 'rejected');
              if (!invalidateBeforeReady && !removedId) {
                assert.equal(current().combatSkillReceipt?.success, false);
                assert.match(current().combatSkillReceipt?.reason ?? '', /unconscious or absent|missing or conscious/);
              }
              assert.equal(current().combatSkillReceipt?.spentAP, 0);
              assert.deepEqual(current().pendingCombatSkillActions, []);
              assert.deepEqual(stored().pendingCombatSkillActions, []);
              assert.deepEqual(characterSnapshot(), charactersBeforeCompletion);
              assert.deepEqual(current().initiativeEntries, entriesBeforeCompletion);
              await reload();
              await change(() => current().completeHealFallen({
                actionId, resolution: { method: 'automaticSuccess' },
              }));
              assert.equal(current().combatSkillReceipt?.status, 'rejected');
              assert.equal(current().combatSkillReceipt?.spentAP, 0);
              assert.deepEqual(current().pendingCombatSkillActions, []);
              assert.deepEqual(characterSnapshot(), charactersBeforeCompletion, 'stale action cannot revive or change AP after reload');
              assert.deepEqual(current().initiativeEntries, entriesBeforeCompletion);
              assert.deepEqual(stored().characters, charactersBeforeCompletion);
              assert.deepEqual(stored().initiativeEntries, entriesBeforeCompletion);
            };
            try {
              await change(() => characters.forEach(c => current().addCharacter(c)));
              await change(() => current().startCombat(entries));
              await change(() => current().nextTurn());
              assert.equal(current().activeEntryId, 'entry-healer');
              await change(() => current().spendAP(healer.id, 4));
              assert.equal(actor().currentAP, 3);
              let actionId = '';
              await change(() => {
                actionId = current().resolveHealFallen({
                  actorId: healer.id, targetId: target.id, skill: 'firstAid',
                  confirmSpendAllRemaining: true,
                });
              });
              const expectedAction = {
                id: actionId, kind: 'healFallen', actorId: healer.id, targetId: target.id,
                skill: 'firstAid', label: 'Heal Fallen', startedRound: 1, completesOnRound: 2,
                apCost: hasStat ? 5 : 10, spentAP: 3, armorOnlyAC: true,
              };
              assert.deepEqual(stored().pendingCombatSkillActions, [expectedAction]);
              assert.equal(current().combatSkillReceipt?.status, 'pending');
              assert.equal(current().combatSkillReceipt?.spentAP, 3);
              assertActor(0, true);
              assertUnconscious();

              // This is a fresh provider reading its predecessor's saved JSON,
              // not an import into an already-running provider.
              await reload();
              assertActor(0, true);
              assertUnconscious();
              if (invalidateBeforeReady) {
                await verifyInvalidation(actionId);
                return;
              }
              await change(() => current().completeHealFallen({
                actionId, resolution: { method: 'automaticSuccess' },
              }));
              assert.equal(current().combatSkillReceipt?.status, 'rejected');
              assert.equal(current().pendingCombatSkillActions.length, 1);
              assertActor(0, true);
              assertUnconscious();

              await change(() => current().nextTurn()); // target, same round
              assertActor(0, true);
              await change(() => current()[roundAdvance]()); // other, new round
              assert.equal(current().currentRound, 2);
              assert.equal(current().activeEntryId, 'entry-other');
              assertActor(0, true);
              assert.equal(current().pendingCombatSkillActions[0].readyToResolve, undefined);
              await reload(); // Round rollover must not count as the healer's turn.
              assertActor(0, true);
              await change(() => current().nextTurn());
              assert.equal(current().activeEntryId, 'entry-healer');
              assertActor(7, false); // Normal own-turn refill, no carried AP debt.
              assert.equal(actor().tempAC, 0);
              assert.equal(actorEntry().tempAC, 0);
              assert.deepEqual(stored().pendingCombatSkillActions, [{ ...expectedAction, readyToResolve: true }]);
              assertUnconscious();
              // Spend some newly refreshed AP to make refunds or resets visible.
              await change(() => current().spendAP(healer.id, 2));
              await reload();
              assertActor(5, false);
              assertUnconscious();
              assert.equal(current().pendingCombatSkillActions[0].readyToResolve, true);

              if (invalidOutcome) {
                await verifyInvalidation(actionId);
                return;
              }

              await change(() => outcome === 'cancel'
                ? current().cancelCombatSkillAction(actionId)
                : current().completeHealFallen({
                  actionId, resolution: { method: 'roll', roll: outcome === 'success' ? 1 : 100 },
                }));
              assert.equal(current().combatSkillReceipt?.status, 'completed');
              assert.equal(current().combatSkillReceipt?.spentAP, 0, 'completion/cancellation never charges again');
              assert.equal(current().combatSkillReceipt?.success, outcome === 'success');
              assert.deepEqual(current().pendingCombatSkillActions, []);
              assert.deepEqual(stored().pendingCombatSkillActions, []);
              assertActor(5, false);
              await reload();
              assertActor(5, false);
              assert.deepEqual(current().pendingCombatSkillActions, []);
              if (outcome === 'success') {
                assert.equal(fallen().isKnockedOut, false);
                assert.equal(fallen().knockOutRoundsLeft, 0);
                assert.equal(fallen().currentHp, 1);
                assert.equal(fallen().revivedNoAPUntilRound, 2);
                assert.equal(fallen().position, 'prone');
                assert.equal(targetEntry().currentHp, 1);
                await change(() => current().nextTurn());
                assert.equal(fallen().currentAP, 0, 'revived target gets no AP in the healing round');
                assert.equal(targetEntry().currentAP, 0);
              } else {
                assertUnconscious();
              }
              const targetBeforeRetry = { ...fallen() };
              const apBeforeRetry = actor().currentAP;
              await change(() => current().completeHealFallen({
                actionId, resolution: { method: 'automaticSuccess' },
              }));
              assert.equal(current().combatSkillReceipt?.status, 'rejected');
              assert.equal(actor().currentAP, apBeforeRetry, 'replaying a finished action does not charge AP');
              assert.deepEqual(fallen(), targetBeforeRetry, 'replaying a finished action cannot revive again');
            } finally {
              if (renderer) await change(() => renderer!.unmount());
              renderer = undefined;
            }
          });
        }
      }
    }

    await t.test('Tight Nuts halves only Repair-based HP recovery in combat', async () => {
      for (const hasTightNuts of [false, true]) {
        storage.clear();
        campaign = undefined;
        await mount();
        const current = () => {
          assert.ok(campaign);
          return campaign;
        };
        const change = async (operation: () => unknown) => {
          await act(async () => { operation(); });
        };
        const healer: Character = {
          ...legacyNpc,
          id: `repair-healer-${hasTightNuts}`,
          name: 'Robot Mechanic',
          race: 'human',
          traits: [],
          skills: { ...legacyNpc.skills, repair: 100 },
          currentHp: 20,
          currentAP: 10,
          isKnockedOut: false,
          knockOutRoundsLeft: 0,
        };
        const target: Character = {
          ...legacyNpc,
          id: `repair-target-${hasTightNuts}`,
          name: 'Robot Target',
          race: 'robot',
          traits: hasTightNuts ? ['tight_nuts'] : [],
          currentHp: 0,
          maxHp: 20,
          currentAP: 0,
          position: 'prone',
          isKnockedOut: true,
          knockOutRoundsLeft: 2,
        };
        const characters = [healer, target];
        const entries: InitiativeEntry[] = characters.map((character, index) => ({
          id: `entry-${character.id}`,
          characterId: character.id,
          name: character.name,
          initiative: 20 - index * 10,
          sequence: 10,
          currentAP: character.currentAP,
          maxAP: 10,
          currentHp: character.currentHp,
          maxHp: character.maxHp,
          armorClass: 10,
          tempAC: 0,
          position: character.position,
          hasActed: false,
          isActive: false,
        }));
        try {
          await change(() => characters.forEach(character => current().addCharacter(character)));
          await change(() => current().startCombat(entries));
          await change(() => current().resolveHealFallen({
            actorId: healer.id,
            targetId: target.id,
            skill: 'repair',
            resolution: { method: 'automaticSuccess' },
          }));
          const revived = current().characters.find(character => character.id === target.id)!;
          assert.equal(revived.currentHp, hasTightNuts ? 0.5 : 1);
          assert.equal(revived.isKnockedOut, false);

          await change(() => current().healCharacter(target.id, 4));
          const healed = current().characters.find(character => character.id === target.id)!;
          assert.equal(healed.currentHp, (hasTightNuts ? 0.5 : 1) + 4,
            'ordinary healing is not reduced by Tight Nuts');
        } finally {
          if (renderer) await change(() => renderer!.unmount());
          renderer = undefined;
        }
      }
    });
  } finally {
    if (renderer) await act(async () => renderer!.unmount());
    hooks.deregister();
    delete globals.__campaignReloadStorage;
    if (previousActEnvironment === undefined) delete globals.IS_REACT_ACT_ENVIRONMENT;
    else globals.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
  }
});
