import { safeReturnUrl } from './return-url';

describe('safeReturnUrl', () => {
  it.each(['/trips', '/join/abc?x=1', '/trips/1#part'])('keeps the internal path %s', (url) => {
    expect(safeReturnUrl(url)).toBe(url);
  });

  it.each([
    '//evil.example',
    '/\\evil.example',
    'https://evil.example',
    'javascript:alert(1)',
    'trips',
    '',
    '/\t/evil.example',
    '/\n/evil.example',
    ' /trips',
  ])('replaces %j with /trips', (url) => {
    expect(safeReturnUrl(url)).toBe('/trips');
  });

  it.each([[null], [undefined]])('replaces %j with /trips', (url) => {
    expect(safeReturnUrl(url)).toBe('/trips');
  });
});
