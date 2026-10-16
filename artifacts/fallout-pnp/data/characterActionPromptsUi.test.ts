import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { URL } from 'node:url';

const characterSource = readFileSync(new URL('../app/(tabs)/characters.tsx', import.meta.url), 'utf8');
const nativeFlowSource = readFileSync(new URL('../e2e/character-actions-native.yaml', import.meta.url), 'utf8');

test('character action confirmation uses the same visible modal and buttons on web and native', () => {
  const modalSource = characterSource.slice(
    characterSource.indexOf('function ConfirmModal'),
    characterSource.indexOf('// ─── Character Form Modal'),
  );

  assert.match(modalSource, /<Modal visible=\{visible\}[^>]*onRequestClose=\{onCancel\}/);
  assert.match(modalSource, /testID=\{testIDPrefix \? `\$\{testIDPrefix\}-cancel` : undefined\}[^>]*onPress=\{onCancel\}/);
  assert.match(modalSource, /testID=\{testIDPrefix \? `\$\{testIDPrefix\}-confirm` : undefined\}[^>]*onPress=\{onConfirm\}/);
  assert.match(modalSource, /if \(!visible \|\| Platform\.OS === 'web'\) return/);
  assert.doesNotMatch(modalSource, /Alert\.alert/);
});

test('each character list action has an accessible control and a clear confirmation prompt', () => {
  const promptSource = characterSource.slice(
    characterSource.indexOf('const pendingActionDetails'),
    characterSource.indexOf('const confirmCharacterAction'),
  );

  for (const [action, prompt] of [
    ['heal', 'Restore ${name} to full HP and clear unconsciousness?'],
    ['storage', 'Find ${name} in the storage chest below.'],
    ['storage', 'Move ${name} from the storage chest back to the active character list?'],
    ['copy', 'Create a copy of ${name} with the same stats and equipment?'],
    ['moveUp', 'Move ${name} one position up in the list?'],
    ['moveDown', 'Move ${name} one position down in the list?'],
  ]) {
    assert.ok(promptSource.includes(prompt), `${action} prompt explains its effect`);
  }

  for (const action of ['heal', 'backstory', 'storage', 'copy', 'move-up', 'move-down', 'delete']) {
    assert.ok(characterSource.includes(`testID={\`character-action-${action}-\${character.id}\`}`), `${action} has a stable control id`);
  }
  assert.match(characterSource, /accessibilityLabel=\{character\.inStorage \? `Return \$\{character\.name\} from storage` : `Store \$\{character\.name\}`\}/);
  assert.match(characterSource, /title="Delete Character\?"[\s\S]*?Permanently remove \$\{deleteTarget\?\.name[\s\S]*?This cannot be undone\./);
});

test('cancel does not dispatch character mutations, while confirmation dispatches only its selected action', () => {
  assert.match(characterSource, /testIDPrefix="character-action-confirmation"[\s\S]*?onCancel=\{\(\) => setPendingCharacterAction\(null\)\}[\s\S]*?onConfirm=\{confirmCharacterAction\}/);
  assert.match(characterSource, /switch \(pendingCharacterAction\.action\) \{[\s\S]*?case 'heal':\s*resetHp\(character\);[\s\S]*?case 'storage':\s*toggleStorage\(character\);[\s\S]*?case 'copy':\s*cloneCharacter\(character\.id\);[\s\S]*?case 'moveUp':\s*case 'moveDown':[\s\S]*?moveCharacter\(character\.id, neighbor\.id\)/);
  assert.match(characterSource, /testIDPrefix="character-delete-confirmation"[\s\S]*?onCancel=\{\(\) => setDeleteTarget\(null\)\}[\s\S]*?deleteCharacter\(deleteTarget\.id\)/);
  assert.match(characterSource, /onBio=\{\(\) => setBioChar\(item\)\}/);
  assert.match(characterSource, /testID=\{`character-action-backstory-\$\{character\.id\}`\}[^>]*onPress=\{onBio\}/);
});

test('native action flow covers cancellation and confirmation for every prompted action and direct backstory opening', () => {
  for (const prompt of [
    'Heal Character?', 'Store Character?', 'Return Character?', 'Copy Character?',
    'Move Character Up?', 'Move Character Down?', 'Delete Character?',
  ]) {
    assert.ok(nativeFlowSource.includes(prompt), `native test covers ${prompt}`);
  }
  assert.match(nativeFlowSource, /character-action-confirmation-cancel/);
  assert.match(nativeFlowSource, /character-action-confirmation-confirm/);
  assert.match(nativeFlowSource, /character-delete-confirmation-cancel/);
  assert.match(nativeFlowSource, /character-delete-confirmation-confirm/);
  assert.match(nativeFlowSource, /Edit \$\{TEST_NAME\}-Alpha backstory[\s\S]*?assertNotVisible: "Heal Character\?"/);
  assert.match(characterSource, /testID="character-backstory-close"/);
});
