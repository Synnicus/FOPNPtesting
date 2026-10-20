import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { URL } from 'node:url';

const locales = [
  'fr', 'it', 'de', 'es-ES', 'es-MX', 'ja', 'pl', 'pt-BR', 'ru', 'zh-Hans', 'zh-Hant',
];
const translations = JSON.parse(
  readFileSync(new URL('./locales/automatic-inventory.json', import.meta.url), 'utf8'),
) as Record<string, Record<string, string>>;
const requiredKeys = [
  'Automatic Inventory Tracking',
  'Track reserve ammo and subtract one carried chem, medical kit, or other consumable each time it is used. Existing magazines stay loaded; player characters start with 0 reserve rounds, while NPCs receive about 10 turns of ammo per ranged weapon.',
  'One carried item is consumed on selection.',
  'No carried item remains.',
];

test('automatic inventory UI strings are translated in every supported non-English locale', () => {
  for (const locale of locales) {
    for (const key of requiredKeys) {
      assert.equal(typeof translations[locale]?.[key], 'string', `${locale} is missing ${key}`);
      assert.ok(translations[locale]?.[key]?.trim(), `${locale} has an empty translation for ${key}`);
    }
  }
});
