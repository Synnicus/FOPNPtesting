import assert from 'node:assert/strict';
import test from 'node:test';
import { BUILT_IN_BESTIARY, spawnBestiaryTemplate } from './bestiary.ts';
import { BUILT_IN_WEAPONS } from './weapons.ts';

test('every bestiary primary weapon spawns equipped, carried, and loaded', () => {
  for (const template of BUILT_IN_BESTIARY) {
    const character = spawnBestiaryTemplate(template, BUILT_IN_WEAPONS, template.name, template.id);
    const primary = BUILT_IN_WEAPONS.find(w => w.id === template.equippedWeaponId);
    if (!primary) continue;
    assert.equal(character.equippedWeaponId, primary.id, template.name);
    assert.equal(character.rightHandWeaponId, primary.id, template.name);
    assert.equal(character.leftHandWeaponId, primary.hands === 2 ? primary.id : undefined, template.name);
    assert.ok(character.inventoryWeaponIds?.includes(primary.id), template.name);
    for (const weaponId of template.inventoryWeaponIds ?? []) {
      assert.ok(character.inventoryWeaponIds?.includes(weaponId), `${template.name}: ${weaponId}`);
    }
    for (const weaponId of character.inventoryWeaponIds ?? []) {
      const weapon = BUILT_IN_WEAPONS.find(w => w.id === weaponId)!;
      if (weapon.magazineSize > 0) {
        assert.equal(character.weaponAmmoStates.find(w => w.weaponId === weaponId)?.currentAmmo, weapon.magazineSize);
      }
    }
    const restored = JSON.parse(JSON.stringify(character));
    assert.equal(restored.equippedWeaponId, primary.id);
    assert.equal(restored.rightHandWeaponId, primary.id);
  }
});

test('missing loadout weapons fail explicitly rather than spawning unarmed', () => {
  const template = BUILT_IN_BESTIARY.find(t => t.equippedWeaponId)!;
  assert.throws(() => spawnBestiaryTemplate(template, [], template.name, 'missing'), /missing weapon/);
});

test('restored bestiary categories retain unique templates alongside manual creatures', () => {
  for (const category of ['human', 'robot', 'ghoul', 'mutant']) {
    assert.ok(BUILT_IN_BESTIARY.some(t => t.category === category && !t.naturalAttacks?.length), category);
  }
  assert.equal(new Set(BUILT_IN_BESTIARY.map(t => t.id)).size, BUILT_IN_BESTIARY.length);
});