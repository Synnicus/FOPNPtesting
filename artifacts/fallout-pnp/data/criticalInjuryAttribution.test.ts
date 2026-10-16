import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import { createCombatInjury } from './injuries.ts';

const combatSource = readFileSync(new URL('../app/(tabs)/index.tsx', import.meta.url), 'utf8');
const characterSource = readFileSync(new URL('../app/(tabs)/characters.tsx', import.meta.url), 'utf8');

test('aimed critical injuries record the selected attacker and weapon', () => {
  const injury = createCombatInjury(
    'aimed-injury',
    { location: 'eyes', description: 'Blindness' },
    'Ranger',
    'Hunting Rifle',
  );

  assert.equal(injury.description, 'Blindness');
  assert.equal(injury.source, 'Ranger with Hunting Rifle');
  assert.match(combatSource, /if \(fx\.blinds\) \{\s*addInjury\(defender\.id, makeInjury\('eyes', 'Blindness'\)\)/);
  assert.match(combatSource, /createCombatInjury\(genId\(\), \{ location, description \}, attacker\?\.name, weapon\?\.name\)/);
});

test('critical-table injuries use the same attacker-and-weapon attribution factory', () => {
  const injury = createCombatInjury(
    'table-injury',
    { location: 'rightArm', description: 'Crippled arm' },
    'Ranger',
    'Hunting Rifle',
  );

  assert.equal(injury.description, 'Crippled arm');
  assert.equal(injury.source, 'Ranger with Hunting Rifle');
  const criticalTableHandler = combatSource.slice(
    combatSource.indexOf('const applyCritEntry = useCallback'),
    combatSource.indexOf('// Roll on the non-aimed critical-hit table'),
  );
  assert.match(criticalTableHandler, /addInjury\(defender\.id, makeInjury\(loc, 'Crippled arm'\)\)/);
  assert.match(criticalTableHandler, /addInjury\(defender\.id, makeInjury\('eyes', 'Blindness'\)\)/);
});

test('manual injury descriptions remain as entered and do not display combat attribution', () => {
  assert.match(characterSource, /description: injDesc \|\| `crippled \$\{injLocation\}`/);
  assert.match(characterSource, /isActive: true, source: 'manual'/);
  assert.match(characterSource, /\{inj\.description\}/);
  assert.match(characterSource, /inj\.source && inj\.source !== 'manual'/);

  const manualInjury = {
    description: 'Old fracture',
    source: 'manual',
  };
  assert.equal(manualInjury.description, 'Old fracture');
  assert.equal(manualInjury.source, 'manual');
});
