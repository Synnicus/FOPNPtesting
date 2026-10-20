import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const testDirectory = dirname(fileURLToPath(import.meta.url));
const optionsSource = readFileSync(resolve(testDirectory, '../components/CampaignOptionsModal.tsx'), 'utf8');
const optionsScreen = optionsSource.slice(optionsSource.indexOf('export default function CampaignOptionsModal'));

test('gameplay and language settings are separate collapsible sections', () => {
  assert.match(optionsSource, /function CollapsibleSectionButton\(/);
  assert.match(optionsSource, /accessibilityState=\{\{ expanded \}\}/);
  assert.match(optionsSource, /Feather name=\{expanded \? 'chevron-up' : 'chevron-down'\}/);

  assert.match(optionsScreen, /const \[showGameplayOptions, setShowGameplayOptions\] = useState\(false\)/);
  assert.match(optionsScreen, /const \[showLanguageOptions, setShowLanguageOptions\] = useState\(false\)/);
  assert.match(optionsScreen, /title="Gameplay Options"[\s\S]*?testID="campaign-gameplay-options-toggle"/);
  assert.match(optionsScreen, /showGameplayOptions && \(/);
  assert.match(optionsScreen, /title="Language"[\s\S]*?testID="campaign-language-options-toggle"/);
  assert.match(optionsScreen, /showLanguageOptions && \(/);
  assert.match(optionsScreen, /summary=\{selectedLanguageLabel\}/);
  assert.match(optionsScreen, /!hideLanguageOptions/);
});
