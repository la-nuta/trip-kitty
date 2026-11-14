export interface TripForGrouping {
  readonly id: string;
  readonly start_date: string | null;
  readonly end_date: string | null;
  readonly created_at: string;
}

export type TripGroupKey = 'current_or_upcoming' | 'undated' | 'past';

export interface TripGroup<T> {
  readonly key: TripGroupKey;
  readonly trips: readonly T[];
}

function compareAscending(first: string, second: string): number {
  return first < second ? -1 : first > second ? 1 : 0;
}

/** Dates are `YYYY-MM-DD` strings, so they compare correctly as text and cannot shift zones. */
export function groupTrips<T extends TripForGrouping>(
  trips: readonly T[],
  today: string,
): readonly TripGroup<T>[] {
  const undated = trips.filter((trip) => (trip.end_date ?? trip.start_date) === null);
  const dated = trips.flatMap((trip) => {
    const lastDate = trip.end_date ?? trip.start_date;
    return lastDate === null ? [] : [{ trip, lastDate }];
  });

  const groups: TripGroup<T>[] = [
    {
      key: 'current_or_upcoming',
      trips: dated
        .filter(({ lastDate }) => lastDate >= today)
        .map(({ trip, lastDate }) => ({ trip, firstDate: trip.start_date ?? lastDate }))
        .sort((first, second) => compareAscending(first.firstDate, second.firstDate))
        .map(({ trip }) => trip),
    },
    {
      key: 'undated',
      trips: [...undated].sort((first, second) =>
        compareAscending(second.created_at, first.created_at),
      ),
    },
    {
      key: 'past',
      trips: dated
        .filter(({ lastDate }) => lastDate < today)
        .sort((first, second) => compareAscending(second.lastDate, first.lastDate))
        .map(({ trip }) => trip),
    },
  ];

  return groups.filter((group) => group.trips.length > 0);
}

/** The device's calendar day as `YYYY-MM-DD`. `toISOString()` would give the UTC day. */
export function toLocalDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}
