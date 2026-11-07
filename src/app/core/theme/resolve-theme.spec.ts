import { resolveTheme } from './resolve-theme';
import { DEFAULT_THEME, THEMES } from './themes';

describe('themes', () => {
  it('lists light and dark, with light as the default', () => {
    expect(THEMES).toEqual(['light', 'dark']);
    expect(DEFAULT_THEME).toBe('light');
  });
});

describe('resolveTheme', () => {
  it('uses the cached theme before the profile loads', () => {
    expect(resolveTheme(null, 'dark', THEMES, false)).toBe('dark');
  });

  it('ignores an unknown cached theme before the profile loads', () => {
    expect(resolveTheme(null, 'neon', THEMES, false)).toBe('light');
  });

  it('prefers the loaded profile theme over the cache', () => {
    expect(resolveTheme('dark', 'light', THEMES, true)).toBe('dark');
  });

  it('gives light for a loaded null profile theme, even with a cached one', () => {
    expect(resolveTheme(null, 'dark', THEMES, true)).toBe('light');
  });

  it('gives light when nothing is known', () => {
    expect(resolveTheme(null, null, THEMES, false)).toBe('light');
    expect(resolveTheme(null, null, THEMES, true)).toBe('light');
  });

  it('gives light for an unknown profile theme', () => {
    expect(resolveTheme('neon', 'dark', THEMES, true)).toBe('light');
  });
});
