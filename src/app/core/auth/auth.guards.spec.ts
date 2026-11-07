import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  provideRouter,
  Router,
  RouterStateSnapshot,
} from '@angular/router';
import { FakeAuth, fakeProfile } from '../../../testing/fake-auth';
import {
  redirectAccountHolder,
  redirectHome,
  requireAccount,
  requireProfile,
  requireSession,
} from './auth.guards';
import { AuthService } from './auth.service';

type Guard = typeof requireSession;

describe('auth guards', () => {
  let auth: FakeAuth;

  beforeEach(() => {
    auth = new FakeAuth();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: AuthService, useValue: auth }],
    });
  });

  async function run(guard: Guard, url = '/join/abc'): Promise<string | boolean> {
    const result = await TestBed.runInInjectionContext(() =>
      guard({} as ActivatedRouteSnapshot, { url } as RouterStateSnapshot),
    );
    return typeof result === 'boolean'
      ? result
      : TestBed.inject(Router).serializeUrl(result as never);
  }

  describe('requireSession', () => {
    it('waits for the session and passes with one', async () => {
      auth.signIn();

      expect(await run(requireSession)).toBe(true);
      expect(auth.whenReadyCalls).toBe(1);
    });

    it('sends a visitor to sign-in and keeps the target', async () => {
      expect(await run(requireSession)).toBe('/sign-in?returnUrl=%2Fjoin%2Fabc');
    });
  });

  describe('requireProfile', () => {
    it('passes with a display name', async () => {
      auth.signIn();

      expect(await run(requireProfile)).toBe(true);
    });

    it('sends a user without a name to profile setup and keeps the target', async () => {
      auth.signIn(fakeProfile({ display_name: null }));

      expect(await run(requireProfile, '/trips/new')).toBe(
        '/profile/setup?returnUrl=%2Ftrips%2Fnew',
      );
    });
  });

  describe('requireAccount', () => {
    it('passes an account holder', async () => {
      auth.signIn();

      expect(await run(requireAccount)).toBe(true);
    });

    it('sends a guest to /trips', async () => {
      auth.signIn(fakeProfile(), true);

      expect(await run(requireAccount)).toBe('/trips');
    });
  });

  describe('redirectAccountHolder', () => {
    it('sends an account holder to /trips', async () => {
      auth.signIn();

      expect(await run(redirectAccountHolder)).toBe('/trips');
    });

    it('passes a guest', async () => {
      auth.signIn(fakeProfile(), true);

      expect(await run(redirectAccountHolder)).toBe(true);
    });

    it('passes a visitor without a session', async () => {
      expect(await run(redirectAccountHolder)).toBe(true);
    });
  });

  describe('redirectHome', () => {
    it('sends a signed-in user to /trips', async () => {
      auth.signIn();

      expect(await run(redirectHome)).toBe('/trips');
    });

    it('sends a visitor to /sign-in', async () => {
      expect(await run(redirectHome)).toBe('/sign-in');
    });
  });
});
