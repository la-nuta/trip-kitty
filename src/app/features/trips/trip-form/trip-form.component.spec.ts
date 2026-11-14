import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { FakeAuth } from '../../../../testing/fake-auth';
import { provideTestTransloco } from '../../../../testing/test-transloco';
import { AuthService } from '../../../core/auth/auth.service';
import { LanguageService } from '../../../core/i18n/language.service';
import { TripInput } from '../trips.service';
import { TripFormComponent } from './trip-form.component';

describe('TripFormComponent', () => {
  let fixture: ComponentFixture<TripFormComponent>;
  let element: HTMLElement;
  let saved: TripInput[];

  async function render(initial: TripInput | null = null): Promise<void> {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideTestTransloco('en'),
        { provide: AuthService, useValue: new FakeAuth() },
      ],
    });
    fixture = TestBed.createComponent(TripFormComponent);
    fixture.componentRef.setInput('submitKey', 'trips.create');
    fixture.componentRef.setInput('initial', initial);
    saved = [];
    fixture.componentInstance.save.subscribe((value) => saved.push(value));
    await fixture.whenStable();
    element = fixture.nativeElement as HTMLElement;
  }

  function control(id: string): HTMLInputElement {
    return element.querySelector(`#${id}`) as HTMLInputElement;
  }

  function fill(id: string, value: string): void {
    control(id).value = value;
    control(id).dispatchEvent(new Event('input'));
  }

  async function chooseCurrency(code: string): Promise<void> {
    const currency = control('trip-currency');
    currency.dispatchEvent(new Event('focus'));
    currency.value = code;
    currency.dispatchEvent(new Event('input'));
    currency.dispatchEvent(new Event('blur'));
    await fixture.whenStable();
  }

  async function submit(): Promise<void> {
    element.querySelector('form')?.dispatchEvent(new Event('submit', { cancelable: true }));
    await fixture.whenStable();
  }

  async function fillValid(): Promise<void> {
    fill('trip-name', '  Lisbon 2027  ');
    fill('trip-start', '2027-05-10');
    fill('trip-end', '2027-05-17');
    await chooseCurrency('EUR');
  }

  function errorOf(id: string): string {
    return element.querySelector(`#${id}-error`)?.textContent?.trim() ?? '';
  }

  it('emits trimmed values', async () => {
    await render();
    await fillValid();

    await submit();

    expect(saved).toEqual([
      { name: 'Lisbon 2027', startDate: '2027-05-10', endDate: '2027-05-17', baseCurrency: 'EUR' },
    ]);
  });

  it('allows no dates or only one of them', async () => {
    await render();
    fill('trip-name', 'Lisbon');
    fill('trip-end', '2027-05-17');
    await chooseCurrency('EUR');

    await submit();

    expect(saved).toEqual([
      { name: 'Lisbon', startDate: null, endDate: '2027-05-17', baseCurrency: 'EUR' },
    ]);
  });

  it('allows a one-day trip', async () => {
    await render();
    await fillValid();
    fill('trip-end', '2027-05-10');

    await submit();

    expect(saved).toHaveLength(1);
  });

  it('shows no errors before the first submit', async () => {
    await render();

    expect(element.querySelector('[role=alert]')).toBeNull();
  });

  it.each(['', '   ', 'x'.repeat(101)])('explains the name %j next to the field', async (name) => {
    await render();
    await fillValid();
    fill('trip-name', name);

    await submit();

    expect(saved).toEqual([]);
    expect(errorOf('trip-name')).toContain('from 1 to 100');
    expect(control('trip-name').getAttribute('aria-invalid')).toBe('true');
    expect(control('trip-name').value).toBe(name);
  });

  it('counts 100 characters like the database', async () => {
    await render();
    await fillValid();
    fill('trip-name', '😀'.repeat(100));

    await submit();

    expect(saved).toHaveLength(1);
  });

  it('explains an end date before the start date and keeps the values', async () => {
    await render();
    await fillValid();
    fill('trip-end', '2027-05-01');

    await submit();

    expect(saved).toEqual([]);
    expect(errorOf('trip-end')).toContain('before the start date');
    expect(control('trip-end').getAttribute('aria-invalid')).toBe('true');
    expect(control('trip-end').value).toBe('2027-05-01');
    expect(control('trip-start').value).toBe('2027-05-10');
    expect(control('trip-name').value).toBe('  Lisbon 2027  ');
  });

  it('explains a missing currency', async () => {
    await render();
    fill('trip-name', 'Lisbon');

    await submit();

    expect(saved).toEqual([]);
    expect(errorOf('trip-currency')).toContain('required');
    expect(control('trip-currency').getAttribute('aria-invalid')).toBe('true');
  });

  it.each([
    ['name', 'trip-name', 'from 1 to 100'],
    ['dates', 'trip-end', 'before the start date'],
    ['base_currency', 'trip-currency', 'required'],
  ])('shows a server error for %s next to its field', async (field, id, text) => {
    await render();
    await fillValid();

    fixture.componentRef.setInput('serverError', { key: 'errors.validation_failed', field });
    await fixture.whenStable();

    expect(errorOf(id)).toContain(text);
    expect(control('trip-name').value).toBe('  Lisbon 2027  ');
  });

  it('shows a server error without a field above the button', async () => {
    await render();

    fixture.componentRef.setInput('serverError', { key: 'errors.not_organizer', field: null });
    await fixture.whenStable();

    expect(element.querySelector('.form-error')?.textContent).toContain('Only the organizer');
  });

  it('starts from the given values when editing', async () => {
    await render({
      name: 'Lisbon',
      startDate: '2027-05-10',
      endDate: null,
      baseCurrency: 'EUR',
    });

    expect(control('trip-name').value).toBe('Lisbon');
    expect(control('trip-start').value).toBe('2027-05-10');
    expect(control('trip-end').value).toBe('');
    expect(control('trip-currency').value).toBe('EUR — Euro');
  });

  it('turns cleared dates into null when editing', async () => {
    await render({
      name: 'Lisbon',
      startDate: '2027-05-10',
      endDate: '2027-05-17',
      baseCurrency: 'EUR',
    });
    fill('trip-start', '');
    fill('trip-end', '');

    await submit();

    expect(saved[0]).toMatchObject({ startDate: null, endDate: null });
  });

  it('disables the button while saving', async () => {
    await render();

    fixture.componentRef.setInput('busy', true);
    await fixture.whenStable();

    expect((element.querySelector('button[type=submit]') as HTMLButtonElement).disabled).toBe(true);
  });

  describe('language switch (SC-006)', () => {
    it('keeps every field', async () => {
      await render();
      await fillValid();

      await TestBed.inject(LanguageService).setLanguage('ru');
      await fixture.whenStable();

      expect(control('trip-name').value).toBe('  Lisbon 2027  ');
      expect(control('trip-start').value).toBe('2027-05-10');
      expect(control('trip-end').value).toBe('2027-05-17');
      expect(control('trip-currency').value).toBe('EUR — евро');
      expect(element.textContent).toContain('Название');
    });

    it('keeps the shown error and translates it', async () => {
      await render();
      await submit();

      await TestBed.inject(LanguageService).setLanguage('ru');
      await fixture.whenStable();

      expect(errorOf('trip-name')).toContain('от 1 до 100');
    });
  });
});
