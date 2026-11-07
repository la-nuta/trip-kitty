const DEFAULT_LANGUAGE = 'en';

/** Profile language if available; else the first available browser language; else English. */
export function detectLanguage(
  browserLanguages: readonly string[],
  available: readonly string[],
  profileLanguage: string | null,
): string {
  if (profileLanguage !== null && available.includes(profileLanguage)) {
    return profileLanguage;
  }

  for (const browserLanguage of browserLanguages) {
    const primarySubtag = browserLanguage.split('-')[0]?.toLowerCase();
    if (primarySubtag !== undefined && available.includes(primarySubtag)) {
      return primarySubtag;
    }
  }

  return DEFAULT_LANGUAGE;
}
