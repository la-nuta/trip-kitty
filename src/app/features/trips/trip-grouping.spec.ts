import { groupTrips, toLocalDate, TripForGrouping } from './trip-grouping';

const TODAY = '2027-05-10';

function trip(id: string, overrides: Partial<TripForGrouping> = {}): TripForGrouping {
  return {
    id,
    start_date: null,
    end_date: null,
    created_at: '2027-01-01T00:00:00Z',
    ...overrides,
  };
}

function ids(group: { trips: readonly TripForGrouping[] } | undefined): string[] {
  return group?.trips.map((item) => item.id) ?? [];
}

describe('groupTrips', () => {
  it('shows the groups in the agreed order', () => {
    const groups = groupTrips(
      [
        trip('past', { end_date: '2027-05-01' }),
        trip('undated'),
        trip('upcoming', { start_date: '2027-06-01' }),
      ],
      TODAY,
    );

    expect(groups.map((group) => group.key)).toEqual(['current_or_upcoming', 'undated', 'past']);
  });

  it('omits empty groups', () => {
    expect(groupTrips([trip('undated')], TODAY).map((group) => group.key)).toEqual(['undated']);
  });

  it('gives no groups without trips', () => {
    expect(groupTrips([], TODAY)).toEqual([]);
  });

  it('sorts current and upcoming trips by start date, nearest first', () => {
    const [group] = groupTrips(
      [
        trip('later', { start_date: '2027-08-01' }),
        trip('running', { start_date: '2027-05-01', end_date: '2027-05-20' }),
        trip('soon', { start_date: '2027-06-01' }),
      ],
      TODAY,
    );

    expect(ids(group)).toEqual(['running', 'soon', 'later']);
  });

  it('sorts a trip with only an end date by that date among upcoming trips', () => {
    const [group] = groupTrips(
      [trip('start', { start_date: '2027-07-01' }), trip('end', { end_date: '2027-06-01' })],
      TODAY,
    );

    expect(ids(group)).toEqual(['end', 'start']);
  });

  it('sorts undated trips by creation time, newest first', () => {
    const [group] = groupTrips(
      [
        trip('old', { created_at: '2027-01-01T00:00:00Z' }),
        trip('new', { created_at: '2027-03-01T00:00:00Z' }),
      ],
      TODAY,
    );

    expect(ids(group)).toEqual(['new', 'old']);
  });

  it('sorts past trips by last date, most recent first', () => {
    const [group] = groupTrips(
      [
        trip('older', { start_date: '2026-01-01', end_date: '2026-01-05' }),
        trip('recent', { start_date: '2026-12-01' }),
        trip('middle', { end_date: '2026-06-01' }),
      ],
      TODAY,
    );

    expect(ids(group)).toEqual(['recent', 'middle', 'older']);
  });

  it('does not treat a trip ending today as past', () => {
    const [group] = groupTrips([trip('today', { end_date: TODAY })], TODAY);

    expect(group?.key).toBe('current_or_upcoming');
  });

  it('does not treat a one-day trip today as past', () => {
    const [group] = groupTrips([trip('today', { start_date: TODAY })], TODAY);

    expect(group?.key).toBe('current_or_upcoming');
  });

  it('treats a trip that ended yesterday as past', () => {
    const [group] = groupTrips([trip('yesterday', { end_date: '2027-05-09' })], TODAY);

    expect(group?.key).toBe('past');
  });

  it('treats a trip with only a past start date as past', () => {
    const [group] = groupTrips([trip('start', { start_date: '2027-05-01' })], TODAY);

    expect(group?.key).toBe('past');
  });

  it('does not change the given list', () => {
    const trips = [
      trip('b', { start_date: '2027-08-01' }),
      trip('a', { start_date: '2027-06-01' }),
    ];

    groupTrips(trips, TODAY);

    expect(trips.map((item) => item.id)).toEqual(['b', 'a']);
  });
});

describe('toLocalDate', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('uses the local calendar day, not the UTC one', () => {
    vi.stubEnv('TZ', 'Pacific/Auckland');

    expect(toLocalDate(new Date('2027-05-10T20:00:00Z'))).toBe('2027-05-11');
  });

  it('pads the month and the day', () => {
    expect(toLocalDate(new Date(2027, 0, 5))).toBe('2027-01-05');
  });
});
