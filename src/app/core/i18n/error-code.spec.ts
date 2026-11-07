import { toErrorKey } from './error-code';

describe('toErrorKey', () => {
  it.each([
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
  ])('maps the function error %s to its key', (code) => {
    expect(toErrorKey({ message: code, code: 'P0001', details: null, hint: null })).toBe(
      `errors.${code}`,
    );
  });

  it('maps a refused role to not_authenticated', () => {
    expect(toErrorKey({ message: 'permission denied for function x', code: '42501' })).toBe(
      'errors.not_authenticated',
    );
  });

  it.each(['23514', '23505', '23502', '22001'])(
    'maps database error %s to validation_failed',
    (code) => {
      expect(toErrorKey({ message: 'violates something', code })).toBe('errors.validation_failed');
    },
  );

  it('maps a wrong or expired one-time code to invalid_code', () => {
    expect(toErrorKey({ message: 'Token has expired or is invalid', code: 'otp_expired' })).toBe(
      'errors.invalid_code',
    );
  });

  it.each(['over_email_send_rate_limit', 'over_request_rate_limit'])(
    'maps the auth error %s to rate_limited',
    (code) => {
      expect(toErrorKey({ message: 'Too many requests', code })).toBe('errors.rate_limited');
    },
  );

  it.each([
    [new Error('boom')],
    ['text'],
    [null],
    [undefined],
    [{ message: 'unknown_code', code: 'P0001' }],
  ])('maps %j to unknown', (error) => {
    expect(toErrorKey(error)).toBe('errors.unknown');
  });
});
