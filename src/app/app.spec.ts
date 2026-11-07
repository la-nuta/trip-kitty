import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { FakeAuth } from '../testing/fake-auth';
import { provideTestTransloco } from '../testing/test-transloco';
import { App } from './app';
import { AuthService } from './core/auth/auth.service';
import { LanguageService } from './core/i18n/language.service';

describe('App', () => {
  let auth: FakeAuth;

  beforeEach(async () => {
    auth = new FakeAuth();
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter([]),
        provideTestTransloco('en'),
        { provide: AuthService, useValue: auth },
      ],
    }).compileComponents();
  });

  async function render(): Promise<HTMLElement> {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows the app name', async () => {
    expect((await render()).querySelector('header')?.textContent).toContain('TripKitty');
  });

  it('has a router outlet', async () => {
    expect((await render()).querySelector('router-outlet')).not.toBeNull();
  });

  it('names each language in itself', async () => {
    const options = (await render()).querySelectorAll('header select option');

    expect([...options].map((option) => option.textContent?.trim())).toEqual([
      'English',
      'Русский',
    ]);
  });

  it('labels the language switcher', async () => {
    expect((await render()).querySelector('header select')?.getAttribute('aria-label')).toBe(
      'Language',
    );
  });

  it('selects the active language', async () => {
    const select = (await render()).querySelector('header select') as HTMLSelectElement;

    expect(select.value).toBe('en');
  });

  it('switches the language without navigation', async () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl');
    const element = await render();
    const select = element.querySelector('header select') as HTMLSelectElement;

    select.value = 'ru';
    select.dispatchEvent(new Event('change'));

    expect(TestBed.inject(LanguageService).language()).toBe('ru');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('hides the profile link without a session', async () => {
    expect((await render()).querySelector('a[href="/profile"]')).toBeNull();
  });

  it('shows the profile link when signed in', async () => {
    auth.signIn();

    expect((await render()).querySelector('a[href="/profile"]')?.textContent).toContain('Profile');
  });

  it('starts the theme service', async () => {
    document.documentElement.removeAttribute('data-theme');

    await render();

    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });
});
