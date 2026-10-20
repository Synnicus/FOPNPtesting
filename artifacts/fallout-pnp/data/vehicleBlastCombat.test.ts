import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import test from 'node:test';
import { URL } from 'node:url';
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import ts from 'typescript';
import type { AreaAttack } from './areaEffects.ts';
import { BUILT_IN_VEHICLES, spawnVehicleCharacter } from './vehicles.ts';

const combatSource = readFileSync(new URL('../app/(tabs)/index.tsx', import.meta.url), 'utf8');

test('combat area selection passes its zone and multiple vehicle systems to AppContext', () => {
  const modal = combatSource.slice(
    combatSource.indexOf('function AreaAttackModal'),
    combatSource.indexOf('function CombatSkillModal'),
  );

  assert.match(modal, /onPress=\{\(\) => setTargetZones\(previous => \(\{ \.\.\.previous, \[c\.id\]: zone\.id \}\)\)\}/);
  assert.match(modal, /current\.includes\(system\.id\)\s*\?\s*current\.filter\(id => id !== system\.id\)\s*:\s*\[\.\.\.current, system\.id\]/);
  assert.match(modal, /targetZones,/);
  assert.match(modal, /vehicleSystemTargets,/);
  assert.match(modal, /onApply\(\{\s*\.\.\.attackToApply,\s*\}, applyTargetIds\)/);
});

test('AppContext applies a selected vehicle blast once to Structure and both chosen systems, preserving EMP rules', async () => {
  const storageUrl = 'test:vehicle-blast-storage';
  const hooks = registerHooks({
    resolve(specifier, context, nextResolve) {
      if (specifier === '@react-native-async-storage/async-storage') {
        return { url: storageUrl, shortCircuit: true };
      }
      if (specifier === 'react-native' || specifier === 'expo-file-system') {
        return { url: `test:${specifier}`, shortCircuit: true };
      }
      if (specifier.startsWith('@/')) {
        return nextResolve(new URL(`../${specifier.slice(2)}.ts`, import.meta.url).href, context);
      }
      if (specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier)) {
        return nextResolve(`${specifier}.ts`, context);
      }
      return nextResolve(specifier, context);
    },
    load(url, context, nextLoad) {
      if (url === storageUrl) {
        return {
          format: 'module',
          shortCircuit: true,
          source: 'export default globalThis.__vehicleBlastStorage;',
        };
      }
      if (url === 'test:react-native') {
        return { format: 'module', shortCircuit: true, source: "export const Platform = { OS: 'web' };" };
      }
      if (url === 'test:expo-file-system') {
        return { format: 'module', shortCircuit: true, source: 'export class Directory {} export const Paths = {};' };
      }
      if (url.startsWith(new URL('../', import.meta.url).href) && /\.tsx?$/.test(url)) {
        return {
          format: 'module',
          shortCircuit: true,
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
    __vehicleBlastStorage?: {
      getItem(key: string): Promise<string | null>;
      setItem(key: string, value: string): Promise<void>;
    };
  };
  const previousActEnvironment = globals.IS_REACT_ACT_ENVIRONMENT;
  globals.IS_REACT_ACT_ENVIRONMENT = true;
  globals.__vehicleBlastStorage = {
    async getItem() {
      return null;
    },
    async setItem() {},
  };

  let renderer: ReactTestRenderer | undefined;
  try {
    const { AppProvider, useApp } = await import('../context/AppContext.tsx');
    let app: ReturnType<typeof useApp> | undefined;
    const current = () => app as ReturnType<typeof useApp>;
    function Consumer() {
      app = useApp();
      return null;
    }

    await act(async () => {
      renderer = create(React.createElement(AppProvider, null, React.createElement(Consumer)));
    });
    assert.ok(app);

    const humvee = BUILT_IN_VEHICLES.find(vehicle => vehicle.id === 'humvee');
    assert.ok(humvee);
    const vehicle = spawnVehicleCharacter(humvee, 'blast-target');
    const structure = vehicle.vehicle!.systems.find(system => system.kind === 'structure')!;
    const engine = vehicle.vehicle!.systems.find(system => system.kind === 'engine')!;
    const tire = vehicle.vehicle!.systems.find(system => system.kind === 'tire')!;
    const drive = vehicle.vehicle!.systems.find(system => system.kind === 'drive')!;
    const blastZone = {
      id: 'near-zone',
      label: 'Near zone',
      minDistance: 0,
      maxDistance: 2,
      rangeUnit: 'hex' as const,
      effects: [{
        id: 'blast',
        label: 'Blast',
        kind: 'explosion' as const,
        damageType: 'explosion' as const,
        damageDieCount: 0,
        damageDie: 0,
        damageBonus: 0,
        rawDamage: 20,
      }],
    };
    const assignedBlast: AreaAttack = {
      kind: 'explosion',
      rawDamage: 20,
      damageType: 'explosion',
      profileId: 'vehicle-blast-test',
      zones: [blastZone],
      targetZones: { [vehicle.id]: blastZone.id },
      vehicleSystemTargets: { [vehicle.id]: [engine.id, tire.id] },
    };

    await act(async () => current().addCharacter(vehicle));
    await act(async () => {
      current().applyAreaAttack(assignedBlast, [vehicle.id]);
    });

    let updated = current().characters.find(character => character.id === vehicle.id)!;
    let receipt = current().areaAttackReceipt!;
    const blastDamage = receipt.results.find(result => result.targetId === vehicle.id)!.damage;
    assert.ok(blastDamage > 0, 'the selected blast zone should resolve positive damage');
    assert.equal(receipt.results.find(result => result.targetId === vehicle.id)?.zoneId, blastZone.id);
    assert.equal(updated.vehicle?.systems.find(system => system.id === structure.id)?.currentHp, structure.currentHp - blastDamage);
    assert.equal(updated.vehicle?.systems.find(system => system.id === engine.id)?.currentHp, engine.currentHp - blastDamage);
    assert.equal(updated.vehicle?.systems.find(system => system.id === tire.id)?.currentHp, tire.currentHp - blastDamage);
    assert.equal(updated.vehicle?.systems.find(system => system.id === drive.id)?.currentHp, drive.currentHp);
    assert.equal(updated.currentHp, structure.currentHp - blastDamage, 'combatant HP follows Structure without applying the blast twice');

    const beforeEmp = updated.vehicle!;
    const empAttack: AreaAttack = {
      ...assignedBlast,
      emp: true,
      vehicleSystemTargets: { [vehicle.id]: engine.id },
    };
    await act(async () => {
      current().applyAreaAttack(empAttack, [vehicle.id]);
    });

    updated = current().characters.find(character => character.id === vehicle.id)!;
    receipt = current().areaAttackReceipt!;
    const empDamage = receipt.results.find(result => result.targetId === vehicle.id)!.damage;
    assert.ok(empDamage > 0);
    assert.equal(updated.vehicle?.systems.find(system => system.id === engine.id)?.currentHp, beforeEmp.systems.find(system => system.id === engine.id)!.currentHp - empDamage);
    assert.equal(updated.vehicle?.systems.find(system => system.id === structure.id)?.currentHp, beforeEmp.systems.find(system => system.id === structure.id)!.currentHp);
    assert.equal(updated.vehicle?.systems.find(system => system.id === tire.id)?.currentHp, beforeEmp.systems.find(system => system.id === tire.id)!.currentHp);

    const beforeBlockedEmp = updated.vehicle!;
    await act(async () => {
      current().applyAreaAttack({
        ...empAttack,
        vehicleSystemTargets: { [vehicle.id]: tire.id },
      }, [vehicle.id]);
    });

    updated = current().characters.find(character => character.id === vehicle.id)!;
    receipt = current().areaAttackReceipt!;
    assert.equal(receipt.results.find(result => result.targetId === vehicle.id)?.damage, 0);
    assert.deepEqual(updated.vehicle?.systems, beforeBlockedEmp.systems, 'EMP must not damage a non-electronic system or Structure');
  } finally {
    if (renderer) await act(async () => renderer!.unmount());
    hooks.deregister();
    delete globals.__vehicleBlastStorage;
    if (previousActEnvironment === undefined) delete globals.IS_REACT_ACT_ENVIRONMENT;
    else globals.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
  }
});
