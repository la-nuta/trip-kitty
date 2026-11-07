import type { TripDetails, TripSummary } from '../app/features/trips/trips.service';
import { USER_ID } from './fake-auth';

export function fakeSummary(overrides: Partial<TripSummary> = {}): TripSummary {
  return {
    id: 'trip-1',
    name: 'Lisbon',
    start_date: '2099-05-10',
    end_date: '2099-05-17',
    base_currency: 'EUR',
    created_at: '2027-01-01T00:00:00Z',
    memberCount: 1,
    role: 'organizer',
    ...overrides,
  };
}

export function fakeDetails(overrides: Partial<TripDetails> = {}): TripDetails {
  return {
    id: 'trip-1',
    name: 'Lisbon',
    start_date: '2099-05-10',
    end_date: '2099-05-17',
    base_currency: 'EUR',
    viewerRole: 'organizer',
    members: [
      { userId: USER_ID, displayName: 'Anna', role: 'organizer' },
      { userId: 'other', displayName: 'Boris', role: 'participant' },
    ],
    ...overrides,
  };
}
