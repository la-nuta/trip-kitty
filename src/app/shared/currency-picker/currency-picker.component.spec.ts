import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { LanguageService } from '../../core/i18n/language.service';
import { CurrencyPickerComponent } from './currency-picker.component';

@Component({
  imports: [CurrencyPickerComponent, ReactiveFormsModule],
  template: `<app-currency-picker inputId="currency" [formControl]="control" />`,
})
class Host {
  readonly control = new FormControl('', { nonNullable: true });
}

describe('CurrencyPickerComponent', () => {
  const language = signal('en');
  let fixture: ComponentFixture<Host>;
  let element: HTMLElement;
  let input: HTMLInputElement;

  async function settle(): Promise<void> {
    await fixture.whenStable();
  }

  async function focus(): Promise<void> {
    input.dispatchEvent(new Event('focus'));
    await settle();
  }

  async function search(text: string): Promise<void> {
    await focus();
    input.value = text;
    input.dispatchEvent(new Event('input'));
    await settle();
  }

  async function press(key: string): Promise<KeyboardEvent> {
    const event = new KeyboardEvent('keydown', { key, cancelable: true });
    input.dispatchEvent(event);
    await settle();
    return event;
  }

  function options(): string[] {
    return [...element.querySelectorAll('[role=option]')].map(
      (option) => option.textContent?.trim() ?? '',
    );
  }

  beforeEach(async () => {
    language.set('en');
    TestBed.configureTestingModule({
      providers: [{ provide: LanguageService, useValue: { language } }],
    });
    fixture = TestBed.createComponent(Host);
    await settle();
    element = fixture.nativeElement as HTMLElement;
    input = element.querySelector('#currency') as HTMLInputElement;
  });

  it('is a labelled combobox, closed at first', () => {
    expect(input.getAttribute('role')).toBe('combobox');
    expect(input.getAttribute('aria-expanded')).toBe('false');
    expect(options()).toEqual([]);
  });

  it('offers the standard currencies on focus', async () => {
    await focus();

    expect(input.getAttribute('aria-expanded')).toBe('true');
    expect(options().length).toBe(Intl.supportedValuesOf('currency').length);
    expect(options()).toContain('EUR — Euro');
  });

  it('finds a currency by code, in any case', async () => {
    await search('eur');

    expect(options()).toContain('EUR — Euro');
    expect(options().every((option) => /eur/i.test(option))).toBe(true);
  });

  it('finds a currency by its name in the active language', async () => {
    language.set('ru');
    await search('евро');

    expect(options()).toContain('EUR — евро');
  });

  it('shows nothing for a search without matches', async () => {
    await search('zzzz');

    expect(options()).toEqual([]);
  });

  it('sets the code when an option is chosen with the pointer', async () => {
    await search('eur');
    const option = [...element.querySelectorAll('[role=option]')].find((item) =>
      item.textContent?.includes('EUR —'),
    );

    option?.dispatchEvent(new MouseEvent('mousedown', { cancelable: true }));
    await settle();

    expect(fixture.componentInstance.control.value).toBe('EUR');
    expect(input.value).toBe('EUR — Euro');
    expect(options()).toEqual([]);
  });

  it('chooses with the keyboard and does not submit the form', async () => {
    await search('eur');
    await press('ArrowDown');
    expect(input.getAttribute('aria-activedescendant')).toBeTruthy();

    const event = await press('Enter');

    expect(event.defaultPrevented).toBe(true);
    expect(fixture.componentInstance.control.value).not.toBe('');
  });

  it('wraps around with the arrow keys', async () => {
    await search('eur');
    await press('ArrowUp');

    const last = options().length - 1;
    expect(input.getAttribute('aria-activedescendant')).toBe(`currency-option-${last}`);
  });

  it('lets Enter submit the form while the list is closed', async () => {
    expect((await press('Enter')).defaultPrevented).toBe(false);
  });

  it('closes with Escape and keeps the value', async () => {
    fixture.componentInstance.control.setValue('USD');
    await search('eur');

    await press('Escape');

    expect(options()).toEqual([]);
    expect(fixture.componentInstance.control.value).toBe('USD');
  });

  it('shows the value set from the form', async () => {
    fixture.componentInstance.control.setValue('USD');
    await settle();

    expect(input.value).toBe('USD — US Dollar');
  });

  it('keeps the code and relabels it when the language changes', async () => {
    fixture.componentInstance.control.setValue('EUR');
    await settle();

    language.set('ru');
    await settle();

    expect(input.value).toBe('EUR — евро');
    expect(fixture.componentInstance.control.value).toBe('EUR');
  });

  it('accepts an exact code typed before leaving the field', async () => {
    await search('gbp');

    input.dispatchEvent(new Event('blur'));
    await settle();

    expect(fixture.componentInstance.control.value).toBe('GBP');
  });

  it('keeps the old value when the typed text is not a code', async () => {
    fixture.componentInstance.control.setValue('USD');
    await search('dollar');

    input.dispatchEvent(new Event('blur'));
    await settle();

    expect(fixture.componentInstance.control.value).toBe('USD');
    expect(input.value).toBe('USD — US Dollar');
    expect(fixture.componentInstance.control.touched).toBe(true);
  });

  it('follows the disabled state of the form', async () => {
    fixture.componentInstance.control.disable();
    await settle();

    expect(input.disabled).toBe(true);
  });
});
