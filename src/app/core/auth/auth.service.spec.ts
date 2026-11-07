import { TestBed } from '@angular/core/testing';
import { provideTransloco, TranslocoService } from '@jsverse/transloco';
import type { Session } from '@supabase/supabase-js';
import { fakeProfile, fakeSession, USER_ID } from '../../../testing/fake-auth';
import { SUPABASE_CLIENT } from '../supabase/supabase.client';
import { AuthService } from './auth.service';

type Listener = (event: string, session: Session | null) => void;

function createClient() {
  let listener: Listener = () => undefined;
  const maybeSingle = vi.fn().mockResolvedValue({ data: fakeProfile(), error: null });
  const single = vi.fn();
  const eq = vi.fn(() => ({ maybeSingle, select: () => ({ single }) }));
  const update = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select: () => ({ eq }), update }));
  const auth = {
    onAuthStateChange: vi.fn((callback: Listener) => {
      listener = callback;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    }),
    signInWithOtp: vi.fn().mockResolvedValue({ data: {}, error: null }),
    verifyOtp: vi.fn().mockResolvedValue({ data: { session: fakeSession() }, error: null }),
    signInAnonymously: vi
      .fn()
      .mockResolvedValue({ data: { session: fakeSession(true) }, error: null }),
    signOut: vi.fn().mockResolvedValue({ error: null }),
  };
  return {
    client: { auth, from },
    auth,
    from,
    update,
    eq,
    maybeSingle,
    single,
    emit: (event: string, session: Session | null) => listener(event, session),
  };
}

describe('AuthService', () => {
  let fake: ReturnType<typeof createClient>;
  let service: AuthService;

  beforeEach(async () => {
    fake = createClient();
    TestBed.configureTestingModule({
      providers: [
        { provide: SUPABASE_CLIENT, useValue: Promise.resolve(fake.client) },
        provideTransloco({ config: { availableLangs: ['en', 'ru'], defaultLang: 'en' } }),
      ],
    });
    TestBed.inject(TranslocoService).setActiveLang('ru');
    service = TestBed.inject(AuthService);
    await new Promise((resolve) => setTimeout(resolve));
  });

  it('is ready after the first auth event, also without a session', async () => {
    fake.emit('INITIAL_SESSION', null);
    await service.whenReady();

    expect(service.session()).toBeNull();
    expect(service.user()).toBeNull();
    expect(service.profile()).toBeNull();
    expect(fake.from).not.toHaveBeenCalled();
  });

  it('does not call the database inside the auth callback', () => {
    fake.emit('SIGNED_IN', fakeSession());

    expect(fake.from).not.toHaveBeenCalled();
  });

  it('loads the profile for the signed-in user before it is ready', async () => {
    fake.emit('INITIAL_SESSION', fakeSession());
    await service.whenReady();

    expect(fake.from).toHaveBeenCalledWith('users');
    expect(fake.eq).toHaveBeenCalledWith('id', USER_ID);
    expect(service.profile()).toEqual(fakeProfile());
    expect(service.isGuest()).toBe(false);
  });

  it('recognizes a guest from user.is_anonymous', async () => {
    fake.emit('INITIAL_SESSION', fakeSession(true));
    await service.whenReady();

    expect(service.isGuest()).toBe(true);
  });

  it('does not reload the profile when the token refreshes', async () => {
    fake.emit('INITIAL_SESSION', fakeSession());
    await service.whenReady();
    fake.emit('TOKEN_REFRESHED', fakeSession());
    await new Promise((resolve) => setTimeout(resolve));

    expect(fake.maybeSingle).toHaveBeenCalledTimes(1);
  });

  it('ignores a profile that arrives after sign-out', async () => {
    let answer: (value: unknown) => void = () => undefined;
    fake.maybeSingle.mockReturnValue(new Promise((resolve) => (answer = resolve)));
    fake.emit('INITIAL_SESSION', fakeSession());
    await new Promise((resolve) => setTimeout(resolve));

    await service.signOut();
    answer({ data: fakeProfile(), error: null });
    await new Promise((resolve) => setTimeout(resolve));

    expect(service.profile()).toBeNull();
  });

  it('becomes ready when the profile cannot be loaded', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    fake.maybeSingle.mockResolvedValue({ data: null, error: { message: 'down' } });
    fake.emit('INITIAL_SESSION', fakeSession());
    await service.whenReady();

    expect(service.profile()).toBeNull();
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it('sends the code with the active language and a callback link that keeps returnUrl', async () => {
    await service.signInWithEmail('a@example.test', '/join/abc?x=1');

    expect(fake.auth.signInWithOtp).toHaveBeenCalledWith({
      email: 'a@example.test',
      options: {
        data: { language: 'ru' },
        emailRedirectTo: `${location.origin}/auth/callback?returnUrl=%2Fjoin%2Fabc%3Fx%3D1`,
      },
    });
  });

  it('throws the error when the code cannot be sent', async () => {
    const error = { code: 'over_email_send_rate_limit' };
    fake.auth.signInWithOtp.mockResolvedValue({ data: {}, error });

    await expect(service.signInWithEmail('a@example.test', '/trips')).rejects.toBe(error);
  });

  it('has the session and profile as soon as the code is verified', async () => {
    await service.verifyEmailCode('a@example.test', '123456');

    expect(fake.auth.verifyOtp).toHaveBeenCalledWith({
      email: 'a@example.test',
      token: '123456',
      type: 'email',
    });
    expect(service.session()).not.toBeNull();
    expect(service.profile()).toEqual(fakeProfile());
  });

  it('throws the error for a wrong code', async () => {
    const error = { code: 'otp_expired' };
    fake.auth.verifyOtp.mockResolvedValue({ data: { session: null }, error });

    await expect(service.verifyEmailCode('a@example.test', '000000')).rejects.toBe(error);
    expect(service.session()).toBeNull();
  });

  it('signs in a guest with the name and the active language', async () => {
    await service.signInAsGuest('Masha');

    expect(fake.auth.signInAnonymously).toHaveBeenCalledWith({
      options: { data: { display_name: 'Masha', language: 'ru' } },
    });
    expect(service.isGuest()).toBe(true);
    expect(service.profile()).toEqual(fakeProfile());
  });

  it('clears the session and profile on sign-out', async () => {
    fake.emit('INITIAL_SESSION', fakeSession());
    await service.whenReady();

    await service.signOut();

    expect(fake.auth.signOut).toHaveBeenCalled();
    expect(service.session()).toBeNull();
    expect(service.profile()).toBeNull();
  });

  it('loads the profile again when the same user signs in after sign-out', async () => {
    fake.emit('INITIAL_SESSION', fakeSession());
    await service.whenReady();
    await service.signOut();

    await service.verifyEmailCode('a@example.test', '123456');

    expect(fake.maybeSingle).toHaveBeenCalledTimes(2);
  });

  it('writes own profile changes and keeps the returned row', async () => {
    fake.emit('INITIAL_SESSION', fakeSession());
    await service.whenReady();
    const updated = fakeProfile({ display_name: 'Maria' });
    fake.single.mockResolvedValue({ data: updated, error: null });

    await service.updateProfile({ display_name: 'Maria' });

    expect(fake.update).toHaveBeenCalledWith({ display_name: 'Maria' });
    expect(fake.eq).toHaveBeenLastCalledWith('id', USER_ID);
    expect(service.profile()).toEqual(updated);
  });

  it('throws a failed profile write and keeps the old profile', async () => {
    fake.emit('INITIAL_SESSION', fakeSession());
    await service.whenReady();
    const error = { code: '23514' };
    fake.single.mockResolvedValue({ data: null, error });

    await expect(service.updateProfile({ display_name: '   ' })).rejects.toBe(error);
    expect(service.profile()).toEqual(fakeProfile());
  });
});

describe('AuthService without a loaded client', () => {
  const failure = new Error('the chunk did not load');
  let consoleError: ReturnType<typeof vi.spyOn>;
  let service: AuthService;

  beforeEach(() => {
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    TestBed.configureTestingModule({
      providers: [
        { provide: SUPABASE_CLIENT, useValue: Promise.reject(failure) },
        provideTransloco({ config: { availableLangs: ['en', 'ru'], defaultLang: 'en' } }),
      ],
    });
    service = TestBed.inject(AuthService);
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  it('becomes ready without a session, so the guards do not hang', async () => {
    await service.whenReady();

    expect(service.session()).toBeNull();
    expect(consoleError).toHaveBeenCalledWith(failure);
  });

  it('reports the failure to a sign-in attempt', async () => {
    await expect(service.signInWithEmail('a@example.test', '/trips')).rejects.toBe(failure);
  });
});
