import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FakeAuth, fakeProfile } from '../testing/fake-auth';
import { provideTestTransloco } from '../testing/test-transloco';
import { routes } from './app.routes';
import { AuthService } from './core/auth/auth.service';

const CONTRACT = readFileSync(
  join(process.cwd(), 'specs/001-trip-invitations/contracts/routes.md'),
  'utf8',
);

describe('routes', () => {
  let auth: FakeAuth;

  beforeEach(() => {
    auth = new FakeAuth();
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        provideTestTransloco('en'),
        { provide: AuthService, useValue: auth },
      ],
    });
  });

  async function open(url: string): Promise<{ url: string; text: string }> {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url).catch(() => undefined);
    return {
      url: TestBed.inject(Router).url,
      text: (harness.routeNativeElement as HTMLElement | null)?.textContent ?? '',
    };
  }

  it('has every route from the contract', () => {
    const contract = [...CONTRACT.matchAll(/^\| `\/([^`]*)` \|/gm)].map((match) => match[1]);
    const configured = routes.map((route) => route.path);

    expect(contract).toHaveLength(10);
    expect(configured).toEqual(expect.arrayContaining(contract));
  });

  it('lazy-loads every screen', () => {
    const screens = routes.filter((route) => route.path !== '');

    expect(screens.every((route) => route.loadComponent !== undefined)).toBe(true);
  });

  it('sends a visitor from / to sign-in', async () => {
    expect((await open('/')).url).toBe('/sign-in');
  });

  it('sends a signed-in user from / to /trips', async () => {
    auth.signIn();

    expect((await open('/')).url).toBe('/trips');
  });

  it.each(['/trips', '/trips/new', '/trips/1', '/trips/1/edit', '/profile', '/profile/setup'])(
    'sends a visitor from %s to sign-in with the target',
    async (url) => {
      expect((await open(url)).url).toBe(`/sign-in?returnUrl=${encodeURIComponent(url)}`);
    },
  );

  it.each(['/trips', '/trips/new', '/trips/1', '/trips/1/edit'])(
    'asks for a name before %s',
    async (url) => {
      auth.signIn(fakeProfile({ display_name: null }));

      expect((await open(url)).url).toBe(`/profile/setup?returnUrl=${encodeURIComponent(url)}`);
    },
  );

  it('keeps a guest out of /trips/new', async () => {
    auth.signIn(fakeProfile(), true);

    expect((await open('/trips/new')).url).toBe('/trips');
  });

  it('keeps an account holder out of /sign-in', async () => {
    auth.signIn();

    expect((await open('/sign-in')).url).toBe('/trips');
  });

  it('lets a guest open /sign-in', async () => {
    auth.signIn(fakeProfile(), true);

    expect((await open('/sign-in')).url).toBe('/sign-in');
  });

  it('opens the invitation page without a session', async () => {
    expect((await open('/join/abc')).url).toBe('/join/abc');
  });

  it('shows the empty shell at /trips', async () => {
    auth.signIn();

    expect((await open('/trips')).text).toContain('Nothing here yet');
  });

  it('shows the not-found page for an unknown address', async () => {
    expect((await open('/no/such/page')).text).toContain('Not found or no access');
  });
});
