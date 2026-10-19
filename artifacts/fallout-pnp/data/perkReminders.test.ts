import assert from 'node:assert/strict';
import test from 'node:test';
import { getCharacterPerkReminderCount, getCharacterPerkReminders } from './perkReminders.ts';

test('perk reminder list and count share the same active-reminder filter', () => {
  const perks = [
    { perkId: 'fear_the_reaper', rank: 1 },
    { perkId: 'divine_favor', rank: 1 },
    { perkId: 'awareness', rank: 0 },
    { perkId: 'unknown_legacy_perk', rank: 1 },
  ];

  const reminders = getCharacterPerkReminders(perks);

  assert.deepEqual(reminders, [
    'Track elapsed days manually in Effects; check the Reaper trigger at the printed interval.',
    'Once per 24 hours, a failed roll may be rerolled. Mark the use in Effects.',
  ]);
  assert.equal(getCharacterPerkReminderCount(perks), reminders.length);
});
