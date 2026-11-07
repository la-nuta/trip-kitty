import { DOCUMENT, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { AuthService, Profile } from '../auth/auth.service';
import { resolveTheme } from './resolve-theme';
import { DEFAULT_THEME, THEMES } from './themes';

const STORAGE_KEY = 'tripkitty.theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly auth = inject(AuthService);
  private readonly root = inject(DOCUMENT).documentElement;

  private readonly themeState = signal(resolveTheme(null, this.readLocalCopy(), THEMES, false));
  private wasSignedIn = false;

  readonly theme = this.themeState.asReadonly();

  constructor() {
    this.apply(this.theme());
    effect(() => {
      const userId = this.auth.user()?.id ?? null;
      const profile = this.auth.profile();
      untracked(() => this.reconcile(userId, profile));
    });
  }

  /** Takes effect at once, without navigation, so open forms keep their values. */
  async setTheme(code: string): Promise<void> {
    if (!THEMES.includes(code)) {
      return;
    }
    this.apply(code);
    this.writeLocalCopy(code);
    if (this.auth.user() !== null) {
      try {
        await this.auth.updateProfile({ theme: code });
      } catch (error) {
        console.error(error);
      }
    }
  }

  private reconcile(userId: string | null, profile: Profile | null): void {
    if (userId === null) {
      if (this.wasSignedIn) {
        this.wasSignedIn = false;
        this.clearLocalCopy();
        this.apply(DEFAULT_THEME);
      }
      return;
    }

    this.wasSignedIn = true;
    if (profile?.id !== userId) {
      return;
    }

    const theme = resolveTheme(profile.theme, this.readLocalCopy(), THEMES, true);
    this.apply(theme);
    if (theme === profile.theme) {
      this.writeLocalCopy(theme);
    } else {
      this.clearLocalCopy();
    }
  }

  private apply(theme: string): void {
    this.themeState.set(theme);
    this.root.setAttribute('data-theme', theme);
  }

  // Storage can throw in private windows or with blocked site data. It is only a cache for the
  // first paint, so the app works the same without it.
  private readLocalCopy(): string | null {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  }

  private writeLocalCopy(theme: string): void {
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // See above.
    }
  }

  private clearLocalCopy(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // See above.
    }
  }
}
