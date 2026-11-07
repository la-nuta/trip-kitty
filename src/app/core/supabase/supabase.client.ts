import { InjectionToken, Provider } from '@angular/core';
import type { SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';
import type { Database } from './database.types';

export type TripKittyClient = SupabaseClient<Database>;

/** A promise: Supabase is more than half of the code, so the app shell does not wait for it. */
export const SUPABASE_CLIENT = new InjectionToken<Promise<TripKittyClient>>('SUPABASE_CLIENT');

async function loadClient(): Promise<TripKittyClient> {
  const { createClient } = await import('@supabase/supabase-js');
  return createClient<Database>(environment.supabaseUrl, environment.supabaseAnonKey, {
    // The one-time link must work when the email is opened in another browser (FR-017).
    // The PKCE flow needs a verifier stored in the browser that requested the link.
    auth: { flowType: 'implicit' },
  });
}

export function provideSupabaseClient(): Provider {
  return { provide: SUPABASE_CLIENT, useFactory: loadClient };
}
