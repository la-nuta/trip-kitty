import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { IntlNumberPipe } from './intl-number.pipe';
import { LanguageService } from './language.service';

describe('IntlNumberPipe', () => {
  const language = signal('en');
  let pipe: IntlNumberPipe;

  beforeEach(() => {
    language.set('en');
    TestBed.configureTestingModule({
      providers: [{ provide: LanguageService, useValue: { language } }],
    });
    pipe = TestBed.runInInjectionContext(() => new IntlNumberPipe());
  });

  it('formats a number for the active language', () => {
    expect(pipe.transform(1234.5)).toBe('1,234.5');
  });

  it('follows the language signal', () => {
    language.set('ru');

    expect(pipe.transform(1234.5)).toBe('1 234,5');
  });

  it('accepts formatting options', () => {
    expect(pipe.transform(0.25, { style: 'percent' })).toBe('25%');
  });

  it.each([[null], [undefined]])('gives an empty string for %j', (value) => {
    expect(pipe.transform(value)).toBe('');
  });

  it('caches one formatter per language', () => {
    const constructor = vi.spyOn(Intl, 'NumberFormat');

    pipe.transform(1);
    pipe.transform(2);
    language.set('ru');
    pipe.transform(1);

    expect(constructor).toHaveBeenCalledTimes(2);
    constructor.mockRestore();
  });
});
