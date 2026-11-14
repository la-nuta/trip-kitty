import {
  parseTemplate,
  TmplAstBoundText,
  TmplAstElement,
  TmplAstRecursiveVisitor,
  TmplAstTemplate,
  TmplAstText,
  TmplAstTextAttribute,
  tmplAstVisitAll,
  type Interpolation,
} from '@angular/compiler';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const I18N = join(ROOT, 'public/i18n');
const SYMBOLS = new Set(['·', '—', '–', '/', '|', '×']);
const CHECKED_ATTRIBUTES = new Set(['placeholder', 'title', 'aria-label', 'alt']);

type Translations = Record<string, unknown>;

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

function keysOf(value: Translations, prefix = ''): string[] {
  return Object.entries(value).flatMap(([key, child]) =>
    typeof child === 'object' && child !== null
      ? keysOf(child as Translations, `${prefix}${key}.`)
      : [`${prefix}${key}`],
  );
}

function sources(extension: string): string[] {
  return readdirSync(join(ROOT, 'src'), { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name))
    .filter((path) => path.endsWith(extension))
    .filter((path) => !path.endsWith('.spec.ts') && !path.includes('/src/testing/'));
}

function usedKeys(source: string): string[] {
  const patterns = [
    /['"`]([a-zA-Z][\w.]*)['"`]\s*\|\s*transloco/g,
    /\bt\(\s*['"`]([a-zA-Z][\w.]*)['"`]/g,
    /\btranslate(?:<[^>]*>)?\(\s*['"`]([a-zA-Z][\w.]*)['"`]/g,
    /[kK]ey=["']([a-zA-Z][\w.]*\.[\w.]+)["']/g,
    /['"`]((?:common|auth|profile|trips|invitations|members|errors|validation)\.[\w.]+)['"`]/g,
  ];
  return patterns.flatMap((pattern) =>
    [...source.matchAll(pattern)].map((match) => match[1] as string),
  );
}

function isBare(text: string): boolean {
  const trimmed = text.trim();
  return trimmed !== '' && !SYMBOLS.has(trimmed);
}

class BareTextFinder extends TmplAstRecursiveVisitor {
  readonly found: string[] = [];

  override visitText(text: TmplAstText): void {
    if (isBare(text.value)) {
      this.found.push(text.value.trim());
    }
  }

  override visitBoundText(text: TmplAstBoundText): void {
    const expression = text.value as unknown as { ast: Interpolation };
    this.found.push(...expression.ast.strings.filter(isBare).map((value) => value.trim()));
  }

  override visitElement(element: TmplAstElement): void {
    this.checkAttributes(element.attributes);
    super.visitElement(element);
  }

  override visitTemplate(template: TmplAstTemplate): void {
    this.checkAttributes(template.attributes);
    super.visitTemplate(template);
  }

  private checkAttributes(attributes: readonly TmplAstTextAttribute[]): void {
    for (const attribute of attributes) {
      if (CHECKED_ATTRIBUTES.has(attribute.name) && isBare(attribute.value)) {
        this.found.push(`${attribute.name}=${attribute.value}`);
      }
    }
  }
}

function bareTextIn(template: string): string[] {
  const parsed = parseTemplate(template, 'template.html', { preserveWhitespaces: true });
  expect(parsed.errors ?? []).toEqual([]);
  const finder = new BareTextFinder();
  tmplAstVisitAll(finder, parsed.nodes);
  return finder.found;
}

function inlineTemplates(source: string): string[] {
  return [...source.matchAll(/\btemplate:\s*`([\s\S]*?)`/g)].map((match) => match[1] as string);
}

const USER_VISIBLE_LITERAL =
  /\b(?:confirm|alert)\(\s*['"`]|document\.title\s*=\s*['"`]|\bnotifications?\.\w+\(\s*['"`]/;

const languages = readJson<string[]>(join(I18N, 'languages.json'));
const english = keysOf(readJson<Translations>(join(I18N, 'en.json'))).sort();

describe('translation files', () => {
  it('lists English and Russian', () => {
    expect(languages).toEqual(['en', 'ru']);
  });

  it('has the agreed namespaces', () => {
    expect(Object.keys(readJson<Translations>(join(I18N, 'en.json'))).sort()).toEqual(
      [
        'auth',
        'common',
        'errors',
        'invitations',
        'members',
        'profile',
        'trips',
        'validation',
      ].sort(),
    );
  });

  it.each(languages)('%s has the same keys as en.json', (language) => {
    expect(keysOf(readJson<Translations>(join(I18N, `${language}.json`))).sort()).toEqual(english);
  });

  it.each(languages)('%s has no empty values', (language) => {
    const flat = JSON.stringify(readJson<Translations>(join(I18N, `${language}.json`)));
    expect(flat).not.toContain('""');
  });

  it('every key used in the sources exists in en.json', () => {
    const missing = [...sources('.html'), ...sources('.ts')].flatMap((path) =>
      usedKeys(readFileSync(path, 'utf8'))
        .filter((key) => !english.includes(key))
        .map((key) => `${relative(ROOT, path)}: ${key}`),
    );
    expect(missing).toEqual([]);
  });

  it.each(['errors.unknown', 'errors.invalid_code', 'errors.rate_limited'])(
    'has the dynamic key %s',
    (key) => {
      expect(english).toContain(key);
    },
  );
});

describe('hardcoded text in templates', () => {
  it.each([
    ['<p>Hello</p>', 'Hello'],
    ['<p>Hello {{ name }}</p>', 'Hello'],
    ['@if (a) { <p>Hello</p> }', 'Hello'],
    ['<input placeholder="Email">', 'placeholder=Email'],
    ['<a aria-label="Close"></a>', 'aria-label=Close'],
    ['<img alt="Cat">', 'alt=Cat'],
    ['<div title="Hint"></div>', 'title=Hint'],
  ])('finds the text in %s', (template, expected) => {
    expect(bareTextIn(template)).toEqual([expected]);
  });

  it.each(['<p>{{ name }}</p>', '<p>{{ a }} · {{ b }}</p>', '<p>—</p>', '<p>  \n </p>'])(
    'accepts %s',
    (template) => {
      expect(bareTextIn(template)).toEqual([]);
    },
  );

  it('finds none in the component templates', () => {
    const templates = [
      ...sources('.html')
        .filter((path) => !path.endsWith('/src/index.html'))
        .map((path) => ({ path, template: readFileSync(path, 'utf8') })),
      ...sources('.ts').flatMap((path) =>
        inlineTemplates(readFileSync(path, 'utf8')).map((template) => ({ path, template })),
      ),
    ];
    const offenders = templates.flatMap(({ path, template }) =>
      bareTextIn(template).map((text) => `${relative(ROOT, path)}: ${text}`),
    );
    expect(offenders).toEqual([]);
  });
});

describe('hardcoded text in code', () => {
  it.each([
    'confirm("Sure?")',
    "alert('Done')",
    "document.title = 'Trips'",
    "this.notifications.show('Saved')",
  ])('finds the literal in %s', (code) => {
    expect(USER_VISIBLE_LITERAL.test(code)).toBe(true);
  });

  it('accepts translated text', () => {
    expect(USER_VISIBLE_LITERAL.test("alert(translate('common.ok'))")).toBe(false);
  });

  it('finds none in the sources', () => {
    const offenders = sources('.ts')
      .filter((path) => USER_VISIBLE_LITERAL.test(readFileSync(path, 'utf8')))
      .map((path) => relative(ROOT, path));
    expect(offenders).toEqual([]);
  });
});
