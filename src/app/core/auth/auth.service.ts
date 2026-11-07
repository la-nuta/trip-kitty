import { computed, DestroyRef, DOCUMENT, inject, Injectable, signal } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import type { Session } from '@supabase/supabase-js';
import type { Tables } from '../supabase/database.types';
import { SUPABASE_CLIENT } from '../supabase/supabase.client';

export type Profile = Tables<'users'>;
export type ProfileChanges = Partial<Pick<Profile, 'display_name' | 'language' | 'theme'>>;

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly clientLoad = inject(SUPABASE_CLIENT);
  private readonly transloco = inject(TranslocoService);
  private readonly location = inject(DOCUMENT).location;

  private readonly sessionState = signal<Session | null>(null);
  private readonly profileState = signal<Profile | null>(null);
  private profileLoad: { userId: string; done: Promise<void> } | null = null;
  private readonly ready: Promise<void>;

  readonly session = this.sessionState.asReadonly();
  readonly user = computed(() => this.session()?.user ?? null);
  readonly isGuest = computed(() => this.user()?.is_anonymous === true);
  readonly profile = this.profileState.asReadonly();

  constructor() {
    const destroyRef = inject(DestroyRef);
    this.ready = new Promise((resolve) => {
      this.clientLoad
        .then((client) => {
          const { data } = client.auth.onAuthStateChange((_event, session) => {
            // Supabase keeps its auth lock during this callback, so a query here would deadlock.
            setTimeout(() => void this.applySession(session).finally(resolve));
          });
          destroyRef.onDestroy(() => data.subscription.unsubscribe());
        })
        .catch((error: unknown) => {
          // Without the client there is no session; the guards must not wait forever.
          console.error(error);
          resolve();
        });
    });
  }

  /** Resolves when the initial session and its profile are known. */
  whenReady(): Promise<void> {
    return this.ready;
  }

  async signInWithEmail(email: string, returnUrl: string): Promise<void> {
    const client = await this.clientLoad;
    const callback = `${this.location.origin}/auth/callback`;
    const { error } = await client.auth.signInWithOtp({
      email,
      options: {
        data: { language: this.transloco.getActiveLang() },
        emailRedirectTo: `${callback}?returnUrl=${encodeURIComponent(returnUrl)}`,
      },
    });
    if (error) {
      throw error;
    }
  }

  async verifyEmailCode(email: string, code: string): Promise<void> {
    const client = await this.clientLoad;
    const { data, error } = await client.auth.verifyOtp({ email, token: code, type: 'email' });
    if (error) {
      throw error;
    }
    await this.applySession(data.session);
  }

  async signInAsGuest(displayName: string): Promise<void> {
    const client = await this.clientLoad;
    const { data, error } = await client.auth.signInAnonymously({
      options: {
        data: { display_name: displayName, language: this.transloco.getActiveLang() },
      },
    });
    if (error) {
      throw error;
    }
    await this.applySession(data.session);
  }

  async signOut(): Promise<void> {
    const client = await this.clientLoad;
    const { error } = await client.auth.signOut();
    if (error) {
      throw error;
    }
    await this.applySession(null);
  }

  async updateProfile(changes: ProfileChanges): Promise<void> {
    const userId = this.user()?.id;
    if (userId === undefined) {
      return;
    }
    const client = await this.clientLoad;
    const { data, error } = await client
      .from('users')
      .update(changes)
      .eq('id', userId)
      .select()
      .single();
    if (error) {
      throw error;
    }
    this.profileState.set(data);
  }

  private applySession(session: Session | null): Promise<void> {
    this.sessionState.set(session);

    const userId = session?.user.id;
    if (userId === undefined) {
      this.profileLoad = null;
      this.profileState.set(null);
      return Promise.resolve();
    }
    if (this.profileLoad?.userId === userId) {
      return this.profileLoad.done;
    }

    this.profileState.set(null);
    const done = this.loadProfile(userId);
    this.profileLoad = { userId, done };
    return done;
  }

  private async loadProfile(userId: string): Promise<void> {
    const client = await this.clientLoad;
    const { data, error } = await client.from('users').select('*').eq('id', userId).maybeSingle();

    if (this.user()?.id !== userId) {
      return;
    }
    if (error) {
      // Forget the attempt, so the next auth event tries again.
      this.profileLoad = null;
      console.error(error);
      return;
    }
    this.profileState.set(data);
  }
}
