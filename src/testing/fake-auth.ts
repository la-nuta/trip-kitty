import { computed, signal } from '@angular/core';
import type { Session } from '@supabase/supabase-js';
import type { Profile, ProfileChanges } from '../app/core/auth/auth.service';

export const USER_ID = '11111111-1111-1111-1111-111111111111';

export function fakeSession(isAnonymous = false, id = USER_ID): Session {
  return { user: { id, is_anonymous: isAnonymous } } as Session;
}

export function fakeProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: USER_ID,
    display_name: 'Anna',
    language: null,
    theme: null,
    created_at: '2026-11-07T00:00:00Z',
    updated_at: '2026-11-07T00:00:00Z',
    ...overrides,
  };
}

/** Stands in for AuthService. Records profile writes and keeps the profile signal up to date. */
export class FakeAuth {
  readonly session = signal<Session | null>(null);
  readonly user = computed(() => this.session()?.user ?? null);
  readonly isGuest = computed(() => this.user()?.is_anonymous === true);
  readonly profile = signal<Profile | null>(null);
  readonly profileWrites: ProfileChanges[] = [];
  whenReadyCalls = 0;

  signIn(profile: Profile = fakeProfile(), isAnonymous = false): void {
    this.session.set(fakeSession(isAnonymous, profile.id));
    this.profile.set(profile);
  }

  signOutNow(): void {
    this.session.set(null);
    this.profile.set(null);
  }

  whenReady(): Promise<void> {
    this.whenReadyCalls += 1;
    return Promise.resolve();
  }

  async updateProfile(changes: ProfileChanges): Promise<void> {
    this.profileWrites.push(changes);
    this.profile.update((profile) => (profile ? { ...profile, ...changes } : profile));
  }
}
