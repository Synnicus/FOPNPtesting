import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { URL } from 'node:url';
import ts from 'typescript';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('radio volume is nested in the enabled-radio section', () => {
  const source = ts.createSourceFile(
    'CampaignOptionsModal.tsx',
    read('../components/CampaignOptionsModal.tsx'),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  let radioVolume: ts.Node | undefined;
  const visit = (node: ts.Node) => {
    if (ts.isJsxSelfClosingElement(node)
      && node.tagName.getText(source) === 'PreferenceSliderRow'
      && node.attributes.getText(source).includes('testID="radio-volume"')) radioVolume = node;
    ts.forEachChild(node, visit);
  };
  visit(source);
  assert.ok(radioVolume, 'volume slider exists');
  let parent: ts.Node | undefined = radioVolume.parent;
  let guarded = false;
  while (parent) {
    if (ts.isBinaryExpression(parent)
      && parent.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken
      && parent.left.getText(source) === 'musicEnabled') guarded = true;
    parent = parent.parent;
  }
  assert.equal(guarded, true, 'volume must disappear when radio is off');
});

test('Campaign Library uses the same notch-safe header minimum as Options', () => {
  const source = read('../components/CampaignLibraryModal.tsx');
  assert.match(source, /Math\.max\(insets\.top, Platform\.OS === 'web' \? 67 : 56\)/);
  assert.match(source, /paddingTop: modalTopInset/);
  assert.match(source, /testID=\{`overwrite-campaign-\$\{record\.id\}`\}/);
});

test('library overwrite and reusable-item text is translated across all supported languages', () => {
  const translations = JSON.parse(read('./locales/inventory-library-ui.json')) as Record<string, Record<string, string>>;
  const locales = ['fr', 'it', 'de', 'es-ES', 'es-MX', 'ja', 'pl', 'pt-BR', 'ru', 'zh-Hans', 'zh-Hant'];
  const keys = Object.keys(translations.fr);
  assert.equal(keys.length, 4);
  for (const locale of locales) {
    for (const key of keys) assert.ok(translations[locale]?.[key]?.trim(), `${locale}: ${key}`);
  }
});
