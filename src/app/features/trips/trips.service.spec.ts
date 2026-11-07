import { TestBed } from '@angular/core/testing';
import { FakeAuth, fakeProfile, USER_ID } from '../../../testing/fake-auth';
import { AuthService } from '../../core/auth/auth.service';
import { SUPABASE_CLIENT } from '../../core/supabase/supabase.client';
import { TripError, TripsService } from './trips.service';

const OTHER_ID = '22222222-2222-2222-2222-222222222222';

interface Answer {
  data: unknown;
  error: unknown;
}

/** Records the calls of a PostgREST query and answers when awaited. */
function createClient(answer: Answer) {
  const calls: unknown[][] = [];
  const query = {
    select: (...args: unknown[]) => (calls.push(['select', ...args]), query),
    eq: (...args: unknown[]) => (calls.push(['eq', ...args]), query),
    maybeSingle: () => (calls.push(['maybeSingle']), query),
    then: (resolve: (value: Answer) => unknown) => Promise.resolve(answer).then(resolve),
  };
  return {
    calls,
    from: vi.fn(() => query),
    rpc: vi.fn(() => Promise.resolve(answer)),
  };
}

describe('TripsService', () => {
  function create(answer: Answer) {
    const client = createClient(answer);
    const auth = new FakeAuth();
    auth.signIn(fakeProfile());
    TestBed.configureTestingModule({
      providers: [
        { provide: SUPABASE_CLIENT, useValue: Promise.resolve(client) },
        { provide: AuthService, useValue: auth },
      ],
    });
    return { client, service: TestBed.inject(TripsService) };
  }

  const row = {
    id: 'trip-1',
    name: 'Lisbon',
    start_date: '2027-05-10',
    end_date: null,
    base_currency: 'EUR',
    created_at: '2027-01-01T00:00:00Z',
  };

  describe('listMyTrips', () => {
    it('counts only active members and finds the own role', async () => {
      const { client, service } = create({
        data: [
          {
            ...row,
            trip_members: [
              { user_id: USER_ID, role: 'participant' },
              { user_id: OTHER_ID, role: 'organizer' },
            ],
          },
        ],
        error: null,
      });

      await expect(service.listMyTrips()).resolves.toEqual([
        { ...row, memberCount: 2, role: 'participant' },
      ]);
      expect(client.from).toHaveBeenCalledWith('trips');
      expect(client.calls).toContainEqual(['eq', 'trip_members.status', 'active']);
    });

    it('throws a mapped error', async () => {
      const { service } = create({ data: null, error: { code: '42501', message: 'denied' } });

      await expect(service.listMyTrips()).rejects.toMatchObject({
        key: 'errors.not_authenticated',
      });
    });
  });

  describe('getTrip', () => {
    const detail = {
      ...row,
      trip_members: [
        { user_id: OTHER_ID, role: 'participant', users: { display_name: 'Boris' } },
        { user_id: USER_ID, role: 'organizer', users: { display_name: 'Anna' } },
        { user_id: 'third', role: 'participant', users: { display_name: 'Alla' } },
      ],
    };

    it('gives the trip, active members, and the viewer role', async () => {
      const { client, service } = create({ data: detail, error: null });

      const trip = await service.getTrip('trip-1');

      expect(trip?.name).toBe('Lisbon');
      expect(trip?.viewerRole).toBe('organizer');
      expect(client.calls).toContainEqual(['eq', 'id', 'trip-1']);
      expect(client.calls).toContainEqual(['eq', 'trip_members.status', 'active']);
    });

    it('lists the organizer first, then the others by name', async () => {
      const { service } = create({ data: detail, error: null });

      const trip = await service.getTrip('trip-1');

      expect(trip?.members.map((member) => member.displayName)).toEqual(['Anna', 'Alla', 'Boris']);
      expect(trip?.members[0]).toEqual({
        userId: USER_ID,
        displayName: 'Anna',
        role: 'organizer',
      });
    });

    it('gives null for a trip that is missing or closed', async () => {
      const { service } = create({ data: null, error: null });

      await expect(service.getTrip('trip-1')).resolves.toBeNull();
    });

    it('gives null for an address that is not a trip id', async () => {
      const { service } = create({ data: null, error: { code: '22P02', message: 'bad uuid' } });

      await expect(service.getTrip('abc')).resolves.toBeNull();
    });

    it('throws other errors instead of hiding them as "not found"', async () => {
      const { service } = create({ data: null, error: { code: '500', message: 'down' } });

      await expect(service.getTrip('trip-1')).rejects.toMatchObject({ key: 'errors.unknown' });
    });
  });

  const input = {
    name: 'Lisbon',
    startDate: '2027-05-10',
    endDate: null,
    baseCurrency: 'EUR',
  };

  describe('createTrip', () => {
    it('calls create_trip and returns the id', async () => {
      const { client, service } = create({ data: 'new-id', error: null });

      await expect(service.createTrip(input)).resolves.toBe('new-id');
      expect(client.rpc).toHaveBeenCalledWith('create_trip', {
        p_name: 'Lisbon',
        p_start_date: '2027-05-10',
        p_end_date: null,
        p_base_currency: 'EUR',
      });
    });

    it.each([
      ['name', 'name'],
      ['dates', 'dates'],
      ['base_currency', 'base_currency'],
    ])('names the field %s from a validation error', async (details, field) => {
      const { service } = create({
        data: null,
        error: { code: 'P0001', message: 'validation_failed', details },
      });

      const error = (await service
        .createTrip(input)
        .catch((caught: unknown) => caught)) as TripError;

      expect(error).toBeInstanceOf(TripError);
      expect(error.key).toBe('errors.validation_failed');
      expect(error.field).toBe(field);
    });

    it('has no field for other errors', async () => {
      const { service } = create({
        data: null,
        error: { code: 'P0001', message: 'guest_not_allowed', details: null },
      });

      await expect(service.createTrip(input)).rejects.toMatchObject({
        key: 'errors.guest_not_allowed',
        field: null,
      });
    });
  });

  describe('updateTrip', () => {
    it('calls update_trip', async () => {
      const { client, service } = create({ data: null, error: null });

      await service.updateTrip('trip-1', input);

      expect(client.rpc).toHaveBeenCalledWith('update_trip', {
        p_trip_id: 'trip-1',
        p_name: 'Lisbon',
        p_start_date: '2027-05-10',
        p_end_date: null,
        p_base_currency: 'EUR',
      });
    });

    it('throws a mapped error', async () => {
      const { service } = create({
        data: null,
        error: { code: 'P0001', message: 'not_organizer' },
      });

      await expect(service.updateTrip('trip-1', input)).rejects.toMatchObject({
        key: 'errors.not_organizer',
      });
    });
  });
});
