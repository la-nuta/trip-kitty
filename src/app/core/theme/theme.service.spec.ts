import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FakeAuth, fakeProfile } from '../../../testing/fake-auth';
import { AuthService } from '../auth/auth.service';
import { ThemeService } from './theme.service';

const STORAGE_KEY = 'tripkitty.theme';
const root = document.documentElement;

describe('ThemeService', () => {
  let auth: FakeAuth;

  function create(): ThemeService {
    const service = TestBed.inject(ThemeService);
    TestBed.tick();
    return service;
  }

  beforeEach(() => {
    localStorage.clear();
    root.removeAttribute('data-theme');
    auth = new FakeAuth();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: AuthService, useValue: auth }],
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('starts from the local copy', () => {
    localStorage.setItem(STORAGE_KEY, 'dark');

    expect(create().theme()).toBe('dark');
    expect(root.getAttribute('data-theme')).toBe('dark');
  });

  it('starts light without a local copy', () => {
    expect(create().theme()).toBe('light');
  });

  it('never reads the device color scheme', () => {
    const matchMedia = vi.fn();
    vi.stubGlobal('matchMedia', matchMedia);

    create();

    expect(matchMedia).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('sets the attribute and the local copy without navigation', async () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl');
    const service = create();

    await service.setTheme('dark');

    expect(service.theme()).toBe('dark');
    expect(root.getAttribute('data-theme')).toBe('dark');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('dark');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('does not write a profile without a session', async () => {
    await create().setTheme('dark');

    expect(auth.profileWrites).toEqual([]);
  });

  it('updates the profile when signed in', async () => {
    const service = create();
    auth.signIn();
    TestBed.tick();

    await service.setTheme('dark');

    expect(auth.profileWrites).toEqual([{ theme: 'dark' }]);
  });

  it('keeps the chosen theme when the profile cannot be saved', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const service = create();
    auth.signIn();
    TestBed.tick();
    vi.spyOn(auth, 'updateProfile').mockRejectedValue(new Error('down'));

    await service.setTheme('dark');

    expect(service.theme()).toBe('dark');
  });

  it('ignores a theme that is not available', async () => {
    const service = create();

    await service.setTheme('neon');

    expect(service.theme()).toBe('light');
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('replaces the local copy with a loaded profile theme', () => {
    localStorage.setItem(STORAGE_KEY, 'light');
    const service = create();

    auth.signIn(fakeProfile({ theme: 'dark' }));
    TestBed.tick();

    expect(service.theme()).toBe('dark');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('dark');
  });

  it('keeps the local copy while the profile is still loading', () => {
    localStorage.setItem(STORAGE_KEY, 'dark');
    const service = create();

    auth.signIn();
    auth.profile.set(null);
    TestBed.tick();

    expect(service.theme()).toBe('dark');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('dark');
  });

  it('gives light for a loaded null theme, clears the copy, and writes nothing', () => {
    localStorage.setItem(STORAGE_KEY, 'dark');
    const service = create();

    auth.signIn(fakeProfile({ theme: null }));
    TestBed.tick();

    expect(service.theme()).toBe('light');
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(auth.profileWrites).toEqual([]);
  });

  it('gives light for an unknown profile theme and leaves the profile unchanged', () => {
    localStorage.setItem(STORAGE_KEY, 'dark');
    const service = create();

    auth.signIn(fakeProfile({ theme: 'neon' }));
    TestBed.tick();

    expect(service.theme()).toBe('light');
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(auth.profileWrites).toEqual([]);
  });

  it('clears the copy and returns to light on sign-out', () => {
    const service = create();
    auth.signIn(fakeProfile({ theme: 'dark' }));
    TestBed.tick();

    auth.signOutNow();
    TestBed.tick();

    expect(service.theme()).toBe('light');
    expect(root.getAttribute('data-theme')).toBe('light');
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('survives a throwing localStorage', async () => {
    const denied = () => {
      throw new Error('denied');
    };
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(denied);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(denied);
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(denied);

    const service = create();
    await service.setTheme('dark');
    auth.signIn(fakeProfile({ theme: null }));
    TestBed.tick();

    expect(service.theme()).toBe('light');
  });
});

describe('index.html theme script', () => {
  const html = readFileSync(join(process.cwd(), 'src/index.html'), 'utf8');
  const script = /<script>([\s\S]*?)<\/script>/.exec(html)?.[1] ?? '';

  beforeEach(() => {
    localStorage.clear();
    root.removeAttribute('data-theme');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('runs in the head, before first paint', () => {
    expect(html.indexOf('<script>')).toBeGreaterThan(-1);
    expect(html.indexOf('<script>')).toBeLessThan(html.indexOf('</head>'));
  });

  it('applies a well-formed stored theme', () => {
    localStorage.setItem(STORAGE_KEY, 'dark');

    new Function(script)();

    expect(root.getAttribute('data-theme')).toBe('dark');
  });

  it.each(['Dark Mode', '<b>', ''])('ignores the malformed value %j', (value) => {
    localStorage.setItem(STORAGE_KEY, value);

    new Function(script)();

    expect(root.hasAttribute('data-theme')).toBe(false);
  });

  it('survives a throwing localStorage', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });

    expect(() => new Function(script)()).not.toThrow();
  });

  it('does not use the device color scheme', () => {
    expect(html).not.toContain('prefers-color-scheme');
  });
});
