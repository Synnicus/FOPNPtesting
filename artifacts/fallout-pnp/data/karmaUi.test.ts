import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { URL } from 'node:url';

const characterSource = readFileSync(new URL('../app/(tabs)/characters.tsx', import.meta.url), 'utf8');
const trackerSource = readFileSync(new URL('../components/KarmaTracker.tsx', import.meta.url), 'utf8');
const nativeFlowSource = readFileSync(new URL('../e2e/karma-native.yaml', import.meta.url), 'utf8');

test('character editor exposes the Karma tab and connects it to the editable character', () => {
  assert.match(characterSource, /const TABS = \[[^\]]*'Effects', 'Karma & Reputation'\]/);
  assert.match(characterSource, /activeTab === 7 && \([\s\S]*?<KarmaTracker character=\{char\} onChange=\{updated => setChar\(updated\)\} \/>/);
  assert.match(characterSource, /<FactionReputationTracker character=\{char\} onChange=\{updated => setChar\(updated\)\} \/>/);
  assert.match(characterSource, /testID="character-level-increase"/);
  assert.match(characterSource, /<KeyboardAwareScrollViewCompat[\s\S]*?keyboardShouldPersistTaps="handled"[\s\S]*?<KarmaTracker/);
});

test('Karma tab exposes an accessible adjustment form, derived title, and chronological history', () => {
  assert.match(trackerSource, /accessibilityLabel=\{`Current Karma total:.*Standing: \$\{group\}\. Level \$\{character\.level\} title: \$\{title\}\.`\}/);
  assert.match(trackerSource, /karmaTitleFor\(character\.level, karma\)/);
  assert.match(trackerSource, /testID="karma-change-input"/);
  assert.match(trackerSource, /accessibilityHint="Enter a positive or negative whole number\. The amount cannot be zero\."/);
  assert.match(trackerSource, /testID="karma-reason-input"/);
  assert.match(trackerSource, /accessibilityHint=\{`Required\. Explain why the Karma total changed\./);
  assert.match(trackerSource, /testID="karma-record-change"/);
  assert.match(trackerSource, /parsedChange !== 0/);
  assert.match(trackerSource, /disabled=\{!canRecord\}/);
  assert.match(trackerSource, /accessibilityState=\{\{ disabled: !canRecord \}\}/);
  assert.match(trackerSource, /accessibilityLiveRegion="polite"/);
  assert.match(trackerSource, /karmaLog: \[[\s\S]*?change: preview\.appliedChange,[\s\S]*?reason: trimmedReason,[\s\S]*?createdAt,/);
  assert.match(trackerSource, /Karma change: \$\{entry\.change > 0 \? 'plus' : entry\.change < 0 \? 'minus' : 'zero'\} \$\{Math\.abs\(entry\.change\)\}\. Explanation: \$\{entry\.reason\}\. Date: \$\{dateLabel\}\./);
  assert.match(trackerSource, /\[\.\.\.karmaLog\]\.sort\(\(a, b\) => a\.createdAt - b\.createdAt\)/);
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
  assert.match(nativeFlowSource, /Delete Karma log entry: Protected the settlement[\s\S]*Delete this Karma history entry\?[\s\S]*KARMA HISTORY \(2\)/);
  assert.match(nativeFlowSource, /assertNotVisible: "Protected the settlement"[\s\S]*assertVisible: "\+250"[\s\S]*Helped a settlement[\s\S]*Returned stolen supplies/);
  assert.match(nativeFlowSource, /character-save[\s\S]*- stopApp[\s\S]*- launchApp[\s\S]*assertVisible: "\+250"[\s\S]*KARMA HISTORY \(2\)/);
  assert.match(nativeFlowSource, /character-level-increase/);
  assert.match(nativeFlowSource, /not-a-number[\s\S]*Zero does not create a Karma history entry/);
});
