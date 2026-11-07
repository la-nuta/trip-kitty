import { TestBed } from '@angular/core/testing';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { provideSupabaseClient, SUPABASE_CLIENT } from './supabase.client';

describe('SUPABASE_CLIENT', () => {
  it('gives a promise of a working client', async () => {
    TestBed.configureTestingModule({ providers: [provideSupabaseClient()] });

    const client = await TestBed.inject(SUPABASE_CLIENT);

    expect(typeof client.from).toBe('function');
    await client.auth.stopAutoRefresh();
  });

  it('creates one client for the whole app', () => {
    TestBed.configureTestingModule({ providers: [provideSupabaseClient()] });

    expect(TestBed.inject(SUPABASE_CLIENT)).toBe(TestBed.inject(SUPABASE_CLIENT));
  });

  // Supabase is more than half of the code, so it stays out of the initial bundle.
  it('is imported only dynamically by the app', () => {
    const offenders = readdirSync(join(process.cwd(), 'src'), {
      recursive: true,
      withFileTypes: true,
    })
      .filter((entry) => entry.isFile() && entry.name.endsWith('.ts'))
      .map((entry) => join(entry.parentPath, entry.name))
      .filter((path) => !path.endsWith('.spec.ts') && !path.includes('/src/testing/'))
      .filter((path) => /^import (?!type\b).*from '@supabase\//m.test(readFileSync(path, 'utf8')));

    expect(offenders).toEqual([]);
  });
});
