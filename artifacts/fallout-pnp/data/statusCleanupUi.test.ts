import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import test from 'node:test';

const charactersScreen = readFileSync(
  new URL('../app/(tabs)/characters.tsx', import.meta.url),
  'utf8',
);

test('confirmation dialogs isolate screen-reader focus and start at the translated heading', () => {
  const confirmModal = charactersScreen.slice(
    charactersScreen.indexOf('function ConfirmModal'),
    charactersScreen.indexOf('// ─── Character Form Modal'),
  );

  assert.match(confirmModal, /accessibilityViewIsModal/);
  assert.match(confirmModal, /importantForAccessibility="yes"/);
  assert.match(confirmModal, /AccessibilityInfo\.setAccessibilityFocus\(headingNode\)/);
  assert.match(confirmModal, /accessibilityRole="header"/);
  assert.match(confirmModal, /accessibilityLabel=\{translateText\(title\)\}/);
  assert.match(confirmModal, /accessibilityRole="button" accessibilityLabel=\{cancelLabel \?\? 'CANCEL'\}/);
  assert.match(confirmModal, /accessibilityRole="button" accessibilityLabel=\{confirmLabel \?\? 'DELETE'\}/);
});

test('status-cleanup paths keep the injury choice distinct and allow cancelling the final warning', () => {
  assert.match(charactersScreen, /onCancel=\{\(\) => chooseStatusCleanupInjuries\(false\)\}/);
  assert.match(charactersScreen, /onConfirm=\{\(\) => chooseStatusCleanupInjuries\(true\)\}/);
  assert.match(charactersScreen, /statusCleanupHealsInjuries\s*\? 'This clears temporary effects and marks all injuries inactive/);
  assert.match(charactersScreen, /onCancel=\{\(\) => setStatusCleanupPrompt\(null\)\}/);
  assert.match(charactersScreen, /onConfirm=\{removeAllStatusEffects\}/);
});
