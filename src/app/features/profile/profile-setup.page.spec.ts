import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { FakeAuth, fakeProfile } from '../../../testing/fake-auth';
import { provideTestTransloco } from '../../../testing/test-transloco';
import { AuthService } from '../../core/auth/auth.service';
import { LanguageService } from '../../core/i18n/language.service';
import { ProfileSetupPage } from './profile-setup.page';

describe('ProfileSetupPage', () => {
  let auth: FakeAuth;
  let fixture: ComponentFixture<ProfileSetupPage>;
  let navigate: ReturnType<typeof vi.spyOn>;

  async function render(returnUrl: string | null = null): Promise<HTMLElement> {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideTestTransloco('en'),
        { provide: AuthService, useValue: auth },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { queryParamMap: convertToParamMap(returnUrl ? { returnUrl } : {}) },
          },
        },
      ],
    });
    navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    fixture = TestBed.createComponent(ProfileSetupPage);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  function name(element: HTMLElement): HTMLInputElement {
    return element.querySelector('#display-name') as HTMLInputElement;
  }

  function language(element: HTMLElement): HTMLSelectElement {
    return element.querySelector('#language') as HTMLSelectElement;
  }

  function fillName(element: HTMLElement, value: string): void {
    name(element).value = value;
    name(element).dispatchEvent(new Event('input'));
  }

  // The submit handlers are async and Angular does not track them, so let them finish first.
  async function settle(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  }

  async function submit(element: HTMLElement): Promise<void> {
    element.querySelector('form')?.dispatchEvent(new Event('submit', { cancelable: true }));
    await settle();
  }

  beforeEach(() => {
    auth = new FakeAuth();
    auth.signIn(fakeProfile({ display_name: null, language: 'en' }));
  });

  it('starts with the name from the profile', async () => {
    auth.signIn(fakeProfile({ display_name: 'Anna', language: 'en' }));

    expect(name(await render()).value).toBe('Anna');
  });

  it.each(['', '   ', 'x'.repeat(51)])('refuses the name %j', async (value) => {
    const element = await render();

    fillName(element, value);
    await submit(element);

    expect(element.querySelector('[role=alert]')?.textContent).toContain('from 1 to 50');
    expect(auth.profileWrites).toEqual([]);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('accepts 50 characters after trimming, counted like the database', async () => {
    const element = await render();

    fillName(element, ` ${'😀'.repeat(50)} `);
    await submit(element);

    expect(auth.profileWrites).toEqual([{ display_name: '😀'.repeat(50) }]);
  });

  it('saves the trimmed name and continues to returnUrl', async () => {
    const element = await render('/join/abc');

    fillName(element, '  Anna  ');
    await submit(element);

    expect(auth.profileWrites).toEqual([{ display_name: 'Anna' }]);
    expect(navigate).toHaveBeenCalledWith('/join/abc');
  });

  it('continues to /trips instead of an external returnUrl', async () => {
    const element = await render('//evil.example');

    fillName(element, 'Anna');
    await submit(element);

    expect(navigate).toHaveBeenCalledWith('/trips');
  });

  it('shows a translated error and stays when saving fails', async () => {
    const element = await render();
    vi.spyOn(auth, 'updateProfile').mockRejectedValue({ code: '23514' });

    fillName(element, 'Anna');
    await submit(element);

    expect(element.querySelector('[role=alert]')?.textContent).toContain(
      'check the entered values',
    );
    expect(navigate).not.toHaveBeenCalled();
  });

  it('changes the language from the select, at once and in the profile', async () => {
    const element = await render();

    language(element).value = 'ru';
    language(element).dispatchEvent(new Event('change'));
    await fixture.whenStable();

    expect(TestBed.inject(LanguageService).language()).toBe('ru');
    expect(auth.profileWrites).toContainEqual({ language: 'ru' });
    expect(element.textContent).toContain('Ваше имя');
  });

  describe('language switch (SC-006)', () => {
    it('keeps the typed name when the language changes in the select', async () => {
      const element = await render();
      fillName(element, 'Anna');

      language(element).value = 'ru';
      language(element).dispatchEvent(new Event('change'));
      await fixture.whenStable();

      expect(name(element).value).toBe('Anna');
    });

    it('keeps the typed name and follows a language change from the header', async () => {
      const element = await render();
      fillName(element, 'Anna');

      await TestBed.inject(LanguageService).setLanguage('ru');
      await fixture.whenStable();

      expect(name(element).value).toBe('Anna');
      expect(language(element).value).toBe('ru');
    });
  });
});
