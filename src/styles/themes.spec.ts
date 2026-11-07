import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const CONTRACT = readFileSync(
  join(ROOT, 'specs/001-trip-invitations/contracts/theme-tokens.md'),
  'utf8',
);
const THEMES_SCSS = readFileSync(join(ROOT, 'src/styles/themes.scss'), 'utf8');

function tokensIn(block: string): Map<string, string> {
  return new Map(
    [...block.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)].map((match) => [
      match[1] as string,
      (match[2] as string).trim(),
    ]),
  );
}

function themeBlock(selector: string): Map<string, string> {
  const start = THEMES_SCSS.indexOf(`${selector} {`);
  expect(start, `block ${selector}`).toBeGreaterThanOrEqual(0);
  return tokensIn(THEMES_SCSS.slice(start, THEMES_SCSS.indexOf('}', start)));
}

const THEME_BLOCKS: Record<string, Map<string, string>> = {
  light: themeBlock(':root'),
  dark: themeBlock("[data-theme='dark']"),
};

const CONTRACT_COLORS = [
  ...CONTRACT.matchAll(
    /^\| `(--color-[a-z0-9-]+)` \| [^|]+ \| `(#[0-9A-F]{6})` \| `(#[0-9A-F]{6})` \|$/gm,
  ),
].map((match) => ({
  token: match[1] as string,
  light: match[2] as string,
  dark: match[3] as string,
}));

const CONTRACT_PAIRS = [
  ...CONTRACT.matchAll(/^\| `(--color-[a-z0-9-]+)` on `(--color-[a-z0-9-]+)` \|/gm),
].map((match) => ({ text: match[1] as string, background: match[2] as string }));

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((start) => {
    const value = parseInt(hex.slice(start, start + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return (
    0.2126 * (channels[0] as number) +
    0.7152 * (channels[1] as number) +
    0.0722 * (channels[2] as number)
  );
}

function contrast(first: string, second: string): number {
  const [lighter, darker] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return ((lighter as number) + 0.05) / ((darker as number) + 0.05);
}

function value(theme: string, token: string): string {
  const color = THEME_BLOCKS[theme]?.get(token);
  expect(color, `${token} in ${theme}`).toBeDefined();
  return color as string;
}

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name))
    .filter((path) => /\.(scss|html|ts)$/.test(path))
    .filter((path) => !path.endsWith('.spec.ts') && !path.endsWith('themes.scss'));
}

const FORBIDDEN_COLOR =
  /(?<![\w&-])#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})\b|\b(?:rgba?|hsla?)\(/i;

describe('theme tokens', () => {
  it('reads the tables from the contract', () => {
    expect(CONTRACT_COLORS.length).toBeGreaterThanOrEqual(13);
    expect(CONTRACT_PAIRS.length).toBeGreaterThanOrEqual(8);
  });

  it.each(['light', 'dark'] as const)('%s defines every color with the agreed value', (theme) => {
    for (const color of CONTRACT_COLORS) {
      expect(value(theme, color.token).toUpperCase(), color.token).toBe(color[theme]);
    }
  });

  it('defines the font tokens', () => {
    expect(value('light', '--font-heading')).toContain('Unbounded');
    expect(value('light', '--font-body')).toContain('Rubik');
  });

  it.each(['light', 'dark'])('%s reaches 4.5:1 on every text pair', (theme) => {
    for (const { text, background } of CONTRACT_PAIRS) {
      expect(
        contrast(value(theme, text), value(theme, background)),
        `${text} on ${background}`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it.each(['light', 'dark'])('%s reaches 3:1 for the focus outline', (theme) => {
    expect(
      contrast(value(theme, '--color-focus'), value(theme, '--color-bg')),
    ).toBeGreaterThanOrEqual(3);
  });
});

describe('use of tokens in the sources', () => {
  it.each([
    'a { color: #FBF3E6; }',
    'fill="#abc"',
    'rgb(0, 0, 0)',
    'rgba(0,0,0,.5)',
    'hsl(10 10% 10%)',
  ])('detects the raw color in %s', (sample) => {
    expect(FORBIDDEN_COLOR.test(sample)).toBe(true);
  });

  it('does not treat a template reference as a color', () => {
    expect(FORBIDDEN_COLOR.test('<input #emailInput>')).toBe(false);
  });

  it('finds no raw color outside themes.scss', () => {
    const offenders = sourceFiles(join(ROOT, 'src')).filter((path) =>
      FORBIDDEN_COLOR.test(readFileSync(path, 'utf8')),
    );
    expect(offenders).toEqual([]);
  });

  it('finds no font-family other than a font token', () => {
    const offenders = sourceFiles(join(ROOT, 'src')).filter((path) =>
      [...readFileSync(path, 'utf8').matchAll(/font-family\s*:\s*([^;}"]+)/g)].some(
        (match) => !/^var\(--font-[a-z-]+\)\s*$/.test(match[1] as string),
      ),
    );
    expect(offenders).toEqual([]);
  });
});
