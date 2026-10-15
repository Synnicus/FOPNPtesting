import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { URL } from 'node:url';

const characterSource = readFileSync(new URL('../app/(tabs)/characters.tsx', import.meta.url), 'utf8');
const trackerSource = readFileSync(new URL('../components/KarmaTracker.tsx', import.meta.url), 'utf8');
const nativeFlowSource = readFileSync(new URL('../e2e/karma-native.yaml', import.meta.url), 'utf8');

test('character editor exposes the Karma tab and connects it to the editable character', () => {
  assert.match(characterSource, /const TABS = \[[^\]]*'Effects', 'Karma'\]/);
  assert.match(characterSource, /activeTab === 7 && \([\s\S]*?<KarmaTracker character=\{char\} onChange=\{updated => setChar\(updated\)\} \/>/);
  assert.match(characterSource, /testID="character-level-increase"/);
});

test('Karma tab exposes an accessible adjustment form, derived title, and chronological history', () => {
  assert.match(trackerSource, /accessibilityLabel=\{`Karma \$\{karma\}, \$\{group\}\. Title: \$\{title\}\.`\}/);
  assert.match(trackerSource, /karmaTitleFor\(character\.level, karma\)/);
  assert.match(trackerSource, /testID="karma-change-input"/);
  assert.match(trackerSource, /testID="karma-reason-input"/);
  assert.match(trackerSource, /testID="karma-record-change"/);
  assert.match(trackerSource, /parsedChange !== 0/);
  assert.match(trackerSource, /disabled=\{!canRecord\}/);
  assert.match(trackerSource, /karmaLog: \[[\s\S]*?change: preview\.appliedChange,[\s\S]*?reason: trimmedReason,[\s\S]*?createdAt,/);
  assert.match(trackerSource, /karmaLog\.map\(entry =>/);
  assert.match(trackerSource, /accessibilityLabel="Explanation for Karma change"/);
  assert.match(trackerSource, /Zero does not create a Karma history entry/);
  assert.match(trackerSource, /testID=\{`karma-delete-entry-\$\{entry\.id\}`\}/);
  assert.match(trackerSource, /accessibilityHint="Asks you to confirm before deleting this entry"/);
  assert.match(trackerSource, /localizedConfirm\(title, message\)/);
  assert.match(trackerSource, /Alert\.alert\(title, message, \[/);
  assert.match(trackerSource, /removeKarmaLogEntry\(karmaLog, entryId\)/);
});

test('native Karma regression flow covers restart, capped values, and entry order', () => {
  assert.match(nativeFlowSource, /- stopApp[\s\S]*- launchApp/);
  assert.match(nativeFlowSource, /Only \+750 will be applied/);
  assert.match(nativeFlowSource, /KARMA HISTORY \(3\)/);
  assert.match(nativeFlowSource, /Helped a settlement[\s\S]*Returned stolen supplies[\s\S]*Protected the settlement/);
  assert.match(nativeFlowSource, /character-level-increase/);
  assert.match(nativeFlowSource, /not-a-number[\s\S]*Zero does not create a Karma history entry/);
});
