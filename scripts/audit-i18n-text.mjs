import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const koJsonPath = join(repoRoot, 'packages/shared/src/i18n/locales/ko.json');
const rendererDir = join(repoRoot, 'packages/desktop-app/src/renderer');

const englishTokenPattern = /[A-Za-z][A-Za-z0-9_./&+-]*[A-Za-z0-9]/g;
const hangulPattern = /[가-힣]/;

const visibleAttributeNames = [
  'aria-label',
  'badge',
  'cancelLabel',
  'confirmLabel',
  'content',
  'description',
  'label',
  'message',
  'placeholder',
  'subtitle',
  'title',
  'tooltip',
];

const visibleObjectKeys = [
  'alt',
  'badge',
  'cancelLabel',
  'confirmLabel',
  'content',
  'description',
  'label',
  'message',
  'name',
  'placeholder',
  'subtitle',
  'text',
  'title',
  'tooltip',
];

function flattenStrings(value, prefix = '') {
  if (typeof value === 'string') return [{ key: prefix, value }];
  if (value == null || typeof value !== 'object') return [];

  return Object.entries(value).flatMap(([key, nestedValue]) =>
    flattenStrings(nestedValue, prefix ? `${prefix}.${key}` : key),
  );
}

function listSourceFiles(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    const stat = statSync(path);

    if (stat.isDirectory()) {
      if (entry === '__tests__' || entry === 'assets') return [];
      return listSourceFiles(path);
    }

    return /\.(ts|tsx)$/.test(entry) ? [path] : [];
  });
}

function lineNumberAt(source, index) {
  let line = 1;
  for (let i = 0; i < index; i += 1) {
    if (source.charCodeAt(i) === 10) line += 1;
  }
  return line;
}

function normalizeText(value) {
  return value.replace(/\s+/g, ' ').trim();
}

function hasHumanText(value) {
  return hangulPattern.test(value) || englishTokenPattern.test(value);
}

function collectKoreanLocaleEnglish() {
  const ko = JSON.parse(readFileSync(koJsonPath, 'utf8').replace(/^\uFEFF/, ''));
  return flattenStrings(ko)
    .map(({ key, value }) => ({
      key,
      value,
      tokens: [...value.matchAll(englishTokenPattern)].map((match) => match[0]),
    }))
    .filter((item) => item.tokens.length > 0);
}

function collectHardcodedRendererText() {
  const findings = [];
  const visibleAttributeSet = new Set(visibleAttributeNames);
  const visibleObjectKeySet = new Set(visibleObjectKeys);

  for (const filePath of listSourceFiles(rendererDir)) {
    const source = readFileSync(filePath, 'utf8');
    const relativePath = relative(repoRoot, filePath);
    const sourceFile = ts.createSourceFile(
      filePath,
      source,
      ts.ScriptTarget.Latest,
      true,
      filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );

    function addFinding(node, kind, field, rawValue) {
      const value = normalizeText(rawValue);
      if (!value || !hasHumanText(value)) return;
      findings.push({
        file: relativePath,
        line: sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1,
        kind,
        field,
        value,
      });
    }

    function getPropertyNameText(name) {
      if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
        return name.text;
      }
      return null;
    }

    function visit(node) {
      if (ts.isJsxText(node)) {
        addFinding(node, 'jsx-text', null, node.getText(sourceFile));
      } else if (ts.isJsxAttribute(node)) {
        const field = node.name.getText(sourceFile);
        if (
          visibleAttributeSet.has(field) &&
          node.initializer &&
          ts.isStringLiteral(node.initializer)
        ) {
          addFinding(node, 'jsx-attribute', field, node.initializer.text);
        }
      } else if (ts.isPropertyAssignment(node)) {
        const field = getPropertyNameText(node.name);
        if (
          field &&
          visibleObjectKeySet.has(field) &&
          (ts.isStringLiteral(node.initializer) ||
            ts.isNoSubstitutionTemplateLiteral(node.initializer))
        ) {
          addFinding(node, 'object-property', field, node.initializer.text);
        }
      }

      ts.forEachChild(node, visit);
    }

    visit(sourceFile);
  }

  return findings;
}

function summarize(report) {
  const hardcodedByKind = report.hardcodedRendererText.reduce((acc, finding) => {
    acc[finding.kind] = (acc[finding.kind] ?? 0) + 1;
    return acc;
  }, {});

  return {
    koreanLocaleEnglishCount: report.koreanLocaleEnglish.length,
    hardcodedRendererTextCount: report.hardcodedRendererText.length,
    hardcodedByKind,
  };
}

const report = {
  koreanLocaleEnglish: collectKoreanLocaleEnglish(),
  hardcodedRendererText: collectHardcodedRendererText(),
};

const outputPath = process.argv.includes('--write')
  ? resolve(repoRoot, process.argv[process.argv.indexOf('--write') + 1] ?? '')
  : null;

if (outputPath) {
  const outputDir = dirname(outputPath);
  if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

console.log(JSON.stringify({ ...summarize(report), outputPath }, null, 2));
