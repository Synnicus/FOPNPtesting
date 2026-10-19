import assert from 'node:assert/strict';
import test from 'node:test';
import { BUILT_IN_BESTIARY, resolveBestiaryTemplates } from './bestiary.ts';
import type { BestiaryTemplate } from '../context/types.ts';

test('campaign Bestiary edits override built-ins and remove only selected entries', () => {
  const original = BUILT_IN_BESTIARY[0];
  const hidden = BUILT_IN_BESTIARY[1];
  const custom: BestiaryTemplate = {
    ...original,
    id: 'campaign-custom-npc',
    name: 'Campaign Custom NPC',
    isCustom: true,
  };
  const edited = { ...original, name: 'Edited Default', maxHp: original.maxHp + 10 };

  const visible = resolveBestiaryTemplates(
    BUILT_IN_BESTIARY,
    [edited],
    [hidden.id],
    [custom],
  );

  assert.equal(visible.find(template => template.id === original.id)?.name, 'Edited Default');
  assert.equal(visible.some(template => template.id === hidden.id), false);
  assert.equal(visible.find(template => template.id === custom.id)?.name, 'Campaign Custom NPC');
  assert.equal(visible.length, BUILT_IN_BESTIARY.length);
});

test('clearing campaign edits restores the current built-in roster, including newly added defaults', () => {
  const futureDefault: BestiaryTemplate = {
    ...BUILT_IN_BESTIARY[0],
    id: 'future-built-in',
    name: 'Future Default NPC',
  };
  const currentDefaults = [...BUILT_IN_BESTIARY, futureDefault];

  const restored = resolveBestiaryTemplates(currentDefaults, [], [], []);

  assert.equal(restored.length, currentDefaults.length);
  assert.equal(restored.at(-1)?.id, futureDefault.id);
  assert.deepEqual(restored, currentDefaults);
});
