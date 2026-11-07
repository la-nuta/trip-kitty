import { DEFAULT_THEME } from './themes';

/**
 * Before the profile loads, the copy cached in this browser is used. After that only the profile
 * counts, so a stale cached copy never overrides it.
 */
export function resolveTheme(
  profileTheme: string | null,
  cachedTheme: string | null,
  available: readonly string[],
  profileLoaded: boolean,
): string {
  const candidate = profileLoaded ? profileTheme : cachedTheme;
  return candidate !== null && available.includes(candidate) ? candidate : DEFAULT_THEME;
}
