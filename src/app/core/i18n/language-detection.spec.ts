import { detectLanguage } from './language-detection';

const AVAILABLE = ['en', 'ru'];

describe('detectLanguage', () => {
  it.each([
    [['ru-RU'], 'ru'],
    [['ru-UA', 'en'], 'ru'],
    [['en-GB'], 'en'],
    [['de-DE', 'ru'], 'ru'],
    [['de-DE'], 'en'],
    [[], 'en'],
    [['RU-ru'], 'ru'],
  ])('picks the first available browser language from %j', (browser, expected) => {
    expect(detectLanguage(browser, AVAILABLE, null)).toBe(expected);
  });

  it('prefers the profile language over the browser language', () => {
    expect(detectLanguage(['ru'], AVAILABLE, 'en')).toBe('en');
  });

  it('ignores a profile language that is not available', () => {
    expect(detectLanguage(['ru'], AVAILABLE, 'de')).toBe('ru');
  });
});
