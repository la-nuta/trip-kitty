const DEFAULT_RETURN_URL = '/trips';

// One leading slash, no backslash right after it, and no whitespace or control characters:
// browsers drop tabs and newlines from URLs, so `/<tab>/evil.example` would become `//evil.example`.
const INTERNAL_PATH = /^\/(?![/\\])[^\s\p{Cc}]*$/u;

/** Returns the URL when it is an internal path, otherwise the default page. */
export function safeReturnUrl(url: string | null | undefined): string {
  return url && INTERNAL_PATH.test(url) ? url : DEFAULT_RETURN_URL;
}
