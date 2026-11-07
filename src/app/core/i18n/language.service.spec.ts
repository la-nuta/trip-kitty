import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import { FakeAuth, fakeProfile } from '../../../testing/fake-auth';
import { provideTestTransloco } from '../../../testing/test-transloco';
import { AuthService } from '../auth/auth.service';
import { LanguageService } from './language.service';

describe('LanguageService', () => {
  let auth: FakeAuth;
  let transloco: TranslocoService;
  let service: LanguageService;

  beforeEach(() => {
    auth = new FakeAuth();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideTestTransloco('ru'),
        { provide: AuthService, useValue: auth },
      ],
    });
    transloco = TestBed.inject(TranslocoService);
    service = TestBed.inject(LanguageService);
    TestBed.tick();
  });

  it('starts from the active language and marks the document', () => {
    expect(service.language()).toBe('ru');
    expect(document.documentElement.lang).toBe('ru');
  });

  it('lists the available languages', () => {
    expect(service.available).toEqual(['en', 'ru']);
  });

  it('switches Transloco and the document language without navigation', async () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl');

    await service.setLanguage('en');

    expect(transloco.getActiveLang()).toBe('en');
    expect(service.language()).toBe('en');
    expect(document.documentElement.lang).toBe('en');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('does not write a profile without a session', async () => {
    await service.setLanguage('en');

    expect(auth.profileWrites).toEqual([]);
  });

  it('updates the profile when signed in', async () => {
    auth.signIn(fakeProfile({ language: 'ru' }));
    TestBed.tick();

    await service.setLanguage('en');

    expect(auth.profileWrites).toEqual([{ language: 'en' }]);
  });

  it('keeps the chosen language when the profile cannot be saved', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    auth.signIn(fakeProfile({ language: 'ru' }));
    TestBed.tick();
    vi.spyOn(auth, 'updateProfile').mockRejectedValue(new Error('down'));

    await service.setLanguage('en');

    expect(service.language()).toBe('en');
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it('ignores a language that is not available', async () => {
    await service.setLanguage('de');

    expect(service.language()).toBe('ru');
  });

  it('applies a saved profile language on sign-in, over the browser language', () => {
    auth.signIn(fakeProfile({ language: 'en' }));
    TestBed.tick();

    expect(service.language()).toBe('en');
    expect(transloco.getActiveLang()).toBe('en');
    expect(auth.profileWrites).toEqual([]);
  });

  it('writes the current language to a profile without one', () => {
    auth.signIn(fakeProfile({ language: null }));
    TestBed.tick();

    expect(service.language()).toBe('ru');
    expect(auth.profileWrites).toEqual([{ language: 'ru' }]);
  });

  it('leaves a saved language that is not available', () => {
    auth.signIn(fakeProfile({ language: 'de' }));
    TestBed.tick();

    expect(service.language()).toBe('ru');
    expect(auth.profileWrites).toEqual([]);
  });

  it('does not reapply the saved language on later profile changes', async () => {
    auth.signIn(fakeProfile({ language: 'en' }));
    TestBed.tick();
    auth.profile.update((profile) => (profile ? { ...profile, display_name: 'Maria' } : profile));
    await service.setLanguage('ru');
    TestBed.tick();

    expect(service.language()).toBe('ru');
  });

  it('applies the profile again after signing out and in', () => {
    auth.signIn(fakeProfile({ language: 'en' }));
    TestBed.tick();
    auth.signOutNow();
    TestBed.tick();
    transloco.setActiveLang('ru');

    auth.signIn(fakeProfile({ language: 'en' }));
    TestBed.tick();

    expect(service.language()).toBe('en');
  });
});
