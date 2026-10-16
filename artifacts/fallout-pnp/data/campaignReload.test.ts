import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import test from 'node:test';
import { URL } from 'node:url';
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import ts from 'typescript';
import type { BestiaryTemplate, Character, InitiativeEntry } from '../context/types.ts';
import { MANUAL_BESTIARY, spawnBestiaryTemplate } from './bestiary.ts';
import { BUILT_IN_ARMOR } from './armor.ts';
import { BUILT_IN_WEAPONS } from './weapons.ts';
import { resolveArmorAwareSheet } from './armorEffects.ts';

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
  const printedNpc = spawnBestiaryTemplate(brahmin, BUILT_IN_WEAPONS, 'Printed Brahmin', 'printed-npc');
  delete printedNpc.usesDerivedArmorClass;
  const fixture = {
    characters: [legacyNpc, printedNpc],
    customBestiaryTemplates: [legacyTemplate],
    customWeapons: [],
    customArmor: [],
    customAmmo: [],
    initiativeEntries: [],
  };
  const raw = JSON.stringify(fixture);
  assert.equal(raw.includes('usesDerivedArmorClass'), false, 'fixture must predate the AC policy');
  assert.equal(legacyNpc.bestiaryTemplateId, legacyTemplate.id);
  assert.equal(legacyNpc.manualDerivedStats?.armorClass, 36);

  // Only the native boundaries are substituted. React effects, JSON parsing,
  // AppProvider normalization, context consumers and save-back all run normally.
  const storage = new Map([[STORAGE_KEY, raw]]);
  const reads: string[] = [];
  const writes: string[] = [];
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
            compilerOptions: { module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.React },
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
      storage.set(key, value);
    },
  };
  let renderer: ReactTestRenderer | undefined;
  try {
    const { AppProvider, useApp } = await import('../context/AppContext.tsx');
    let campaign: ReturnType<typeof useApp> | undefined;
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
      const template = restored.customBestiaryTemplates[0];
      assert.equal(template.usesDerivedArmorClass, true, `${reload}: template repaired`);
      const npc = restored.characters.find(character => character.id === legacyNpc.id)!;
      assert.ok(npc, `${reload}: linked NPC restored`);
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
      await act(async () => renderer!.unmount());
      renderer = undefined;
    }
    assert.deepEqual(reads, [STORAGE_KEY, STORAGE_KEY]);
    assert.deepEqual(writes, [STORAGE_KEY, STORAGE_KEY]);
    const saved = JSON.parse(storage.get(STORAGE_KEY)!);
    assert.equal(saved.customBestiaryTemplates[0].usesDerivedArmorClass, true);
    assert.equal(saved.characters[0].usesDerivedArmorClass, true);

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
          assert.equal(empty.importCampaign(raw), true, 'legacy campaign import accepted');
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
          assert.equal(state.characters.length, 2, stage);
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
  } finally {
    if (renderer) await act(async () => renderer!.unmount());
    hooks.deregister();
    delete globals.__campaignReloadStorage;
    if (previousActEnvironment === undefined) delete globals.IS_REACT_ACT_ENVIRONMENT;
    else globals.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
  }
});
