import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { IntlDatePipe } from './intl-date.pipe';
import { LanguageService } from './language.service';

describe('IntlDatePipe', () => {
  const language = signal('en');
  let pipe: IntlDatePipe;

  beforeEach(() => {
    language.set('en');
    TestBed.configureTestingModule({
      providers: [{ provide: LanguageService, useValue: { language } }],
    });
    pipe = TestBed.runInInjectionContext(() => new IntlDatePipe());
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('formats a date for the active language', () => {
    expect(pipe.transform('2027-05-10')).toBe('May 10, 2027');
  });

  it('follows the language signal', () => {
    language.set('ru');

    expect(pipe.transform('2027-05-10')).toContain('10 мая 2027');
  });

  it.each(['America/Los_Angeles', 'Pacific/Auckland'])(
    'does not shift a date-only value in %s',
    (timeZone) => {
      vi.stubEnv('TZ', timeZone);

      expect(pipe.transform('2027-05-10')).toBe('May 10, 2027');
    },
  );

  it('formats a timestamp in the local time zone', () => {
    vi.stubEnv('TZ', 'Pacific/Auckland');

    expect(pipe.transform('2027-05-10T20:00:00Z', { dateStyle: 'medium' })).toBe('May 11, 2027');
  });

  it('accepts formatting options', () => {
    expect(pipe.transform('2027-05-10', { month: 'long' })).toBe('May');
  });

  it.each([[null], [undefined], ['not a date']])('gives an empty string for %j', (value) => {
    expect(pipe.transform(value)).toBe('');
  });

  it('caches one formatter per language', () => {
    const constructor = vi.spyOn(Intl, 'DateTimeFormat');

    pipe.transform('2027-05-10');
    pipe.transform('2027-05-11');
    language.set('ru');
    pipe.transform('2027-05-10');

    expect(constructor).toHaveBeenCalledTimes(2);
    constructor.mockRestore();
  });
});
