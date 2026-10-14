import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { URL } from 'node:url';

const characterSource = readFileSync(new URL('../app/(tabs)/characters.tsx', import.meta.url), 'utf8');
const trackerSource = readFileSync(new URL('../components/KarmaTracker.tsx', import.meta.url), 'utf8');

test('character editor exposes the Karma tab and connects it to the editable character', () => {
  assert.match(characterSource, /const TABS = \[[^\]]*'Effects', 'Karma'\]/);
  assert.match(characterSource, /activeTab === 7 && \([\s\S]*?<KarmaTracker character=\{char\} onChange=\{updated => setChar\(updated\)\} \/>/);
});

test('Karma tab exposes an accessible adjustment form, derived title, and chronological history', () => {
  assert.match(trackerSource, /accessibilityLabel=\{`Karma \$\{karma\}, \$\{group\}\. Title: \$\{title\}\.`\}/);
  assert.match(trackerSource, /karmaTitleFor\(character\.level, karma\)/);
  assert.match(trackerSource, /testID="karma-change-input"/);
  assert.match(trackerSource, /testID="karma-reason-input"/);
  assert.match(trackerSource, /testID="karma-record-change"/);
  assert.match(trackerSource, /karmaLog: \[[\s\S]*?change: preview\.appliedChange,[\s\S]*?reason: trimmedReason,[\s\S]*?createdAt,/);
  assert.match(trackerSource, /karmaLog\.map\(entry =>/);
  assert.match(trackerSource, /accessibilityLabel="Explanation for Karma change"/);
});
