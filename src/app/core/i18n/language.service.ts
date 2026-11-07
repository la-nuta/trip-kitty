import { DOCUMENT, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { AuthService, Profile } from '../auth/auth.service';

@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly auth = inject(AuthService);
  private readonly transloco = inject(TranslocoService);
  private readonly root = inject(DOCUMENT).documentElement;

  private readonly languageState = signal(this.transloco.getActiveLang());
  private syncedUserId: string | null = null;

  readonly language = this.languageState.asReadonly();
  readonly available = this.transloco.getAvailableLangs() as string[];

  constructor() {
    this.root.lang = this.language();
    effect(() => {
      const profile = this.auth.profile();
      untracked(() => void this.syncWithProfile(profile));
    });
  }

  /** Takes effect at once, without navigation, so open forms keep their values. */
  async setLanguage(code: string): Promise<void> {
    if (!this.available.includes(code)) {
      return;
    }
    this.apply(code);
    if (this.auth.user() !== null) {
      await this.saveToProfile(code);
    }
  }

  private apply(code: string): void {
    this.transloco.setActiveLang(code);
    this.languageState.set(code);
    this.root.lang = code;
  }

  /** The profile decides once per sign-in; after that the user's choices write to it. */
  private async syncWithProfile(profile: Profile | null): Promise<void> {
    if (profile === null) {
      this.syncedUserId = null;
      return;
    }
    if (profile.id === this.syncedUserId) {
      return;
    }
    this.syncedUserId = profile.id;

    if (profile.language === null) {
      await this.saveToProfile(this.language());
    } else if (this.available.includes(profile.language)) {
      this.apply(profile.language);
    }
  }

  private async saveToProfile(language: string): Promise<void> {
    try {
      await this.auth.updateProfile({ language });
    } catch (error) {
      console.error(error);
    }
  }
}
