const RPC_ERROR_CODES: ReadonlySet<string> = new Set([
  'not_authenticated',
  'profile_incomplete',
  'guest_not_allowed',
  'not_found',
  'not_organizer',
  'invalid_invitation',
  'trip_full',
  'removed_from_trip',
  'cannot_remove_self',
  'organizer_cannot_leave',
  'validation_failed',
  'account_exists',
]);

const PERMISSION_DENIED = '42501';
const INTEGRITY_CONSTRAINT_CLASS = '23';
const STRING_TOO_LONG = '22001';

const AUTH_ERROR_KEYS: Readonly<Record<string, string>> = {
  otp_expired: 'errors.invalid_code',
  over_email_send_rate_limit: 'errors.rate_limited',
  over_request_rate_limit: 'errors.rate_limited',
};

function stringField(error: object, field: 'message' | 'code'): string | undefined {
  const value = (error as Record<string, unknown>)[field];
  return typeof value === 'string' ? value : undefined;
}

/** Maps a PostgREST or Supabase Auth error to a translation key. */
export function toErrorKey(error: unknown): string {
  if (typeof error !== 'object' || error === null) {
    return 'errors.unknown';
  }

  const message = stringField(error, 'message');
  if (message !== undefined && RPC_ERROR_CODES.has(message)) {
    return `errors.${message}`;
  }

  const code = stringField(error, 'code');
  if (code === undefined) {
    return 'errors.unknown';
  }
  if (code === PERMISSION_DENIED) {
    return 'errors.not_authenticated';
  }
  if (code.startsWith(INTEGRITY_CONSTRAINT_CLASS) || code === STRING_TOO_LONG) {
    return 'errors.validation_failed';
  }
  return AUTH_ERROR_KEYS[code] ?? 'errors.unknown';
}
