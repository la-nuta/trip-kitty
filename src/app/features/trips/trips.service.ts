import { inject, Injectable } from '@angular/core';
import { AuthService } from '../../core/auth/auth.service';
import { toErrorKey } from '../../core/i18n/error-code';
import { SUPABASE_CLIENT } from '../../core/supabase/supabase.client';

export type TripRole = 'organizer' | 'participant';
export type TripField = 'name' | 'dates' | 'base_currency';

export interface TripSummary {
  readonly id: string;
  readonly name: string;
  readonly start_date: string | null;
  readonly end_date: string | null;
  readonly base_currency: string;
  readonly created_at: string;
  readonly memberCount: number;
  readonly role: TripRole;
}

export interface TripMember {
  readonly userId: string;
  readonly displayName: string;
  readonly role: TripRole;
}

export interface TripDetails {
  readonly id: string;
  readonly name: string;
  readonly start_date: string | null;
  readonly end_date: string | null;
  readonly base_currency: string;
  readonly viewerRole: TripRole;
  readonly members: readonly TripMember[];
}

export interface TripInput {
  readonly name: string;
  readonly startDate: string | null;
  readonly endDate: string | null;
  readonly baseCurrency: string;
}

const FIELDS: readonly string[] = ['name', 'dates', 'base_currency'];
const INVALID_TEXT_REPRESENTATION = '22P02';

/** A translation key, plus the form field when the server names one in `detail`. */
export class TripError extends Error {
  constructor(
    readonly key: string,
    readonly field: TripField | null,
  ) {
    super(key);
    this.name = 'TripError';
  }
}

export function toTripError(error: unknown): TripError {
  if (error instanceof TripError) {
    return error;
  }
  const key = toErrorKey(error);
  const details = (error as { details?: unknown } | null)?.details;
  const field =
    key === 'errors.validation_failed' && typeof details === 'string' && FIELDS.includes(details)
      ? (details as TripField)
      : null;
  return new TripError(key, field);
}

function asRole(role: string | undefined): TripRole {
  return role === 'organizer' ? 'organizer' : 'participant';
}

// The generated types mark every function argument as required text; the functions accept null
// dates, which mean "no date".
function optionalDate(value: string | null): string {
  return value as string;
}

@Injectable({ providedIn: 'root' })
export class TripsService {
  private readonly clientLoad = inject(SUPABASE_CLIENT);
  private readonly auth = inject(AuthService);

  /** Trips where the viewer is an active member. RLS hides every other trip. */
  async listMyTrips(): Promise<TripSummary[]> {
    const client = await this.clientLoad;
    const { data, error } = await client
      .from('trips')
      .select(
        'id, name, start_date, end_date, base_currency, created_at, trip_members(user_id, role)',
      )
      // The organizer can also see left and removed rows, so the count needs this filter.
      .eq('trip_members.status', 'active');
    if (error) {
      throw toTripError(error);
    }

    const userId = this.auth.user()?.id;
    return data.map(({ trip_members, ...trip }) => ({
      ...trip,
      memberCount: trip_members.length,
      role: asRole(trip_members.find((member) => member.user_id === userId)?.role),
    }));
  }

  /** `null` when the trip does not exist or the viewer has no access: the two look the same. */
  async getTrip(id: string): Promise<TripDetails | null> {
    const client = await this.clientLoad;
    const { data, error } = await client
      .from('trips')
      .select(
        'id, name, start_date, end_date, base_currency, trip_members(user_id, role, users(display_name))',
      )
      .eq('id', id)
      .eq('trip_members.status', 'active')
      .maybeSingle();

    if (error?.code === INVALID_TEXT_REPRESENTATION) {
      return null;
    }
    if (error) {
      throw toTripError(error);
    }
    const userId = this.auth.user()?.id;
    const own = data?.trip_members.find((member) => member.user_id === userId);
    if (!data || !own) {
      return null;
    }

    const { trip_members, ...trip } = data;
    const members = trip_members
      .map((member) => ({
        userId: member.user_id,
        displayName: member.users?.display_name ?? '',
        role: asRole(member.role),
      }))
      .sort(
        (first, second) =>
          Number(second.role === 'organizer') - Number(first.role === 'organizer') ||
          first.displayName.localeCompare(second.displayName),
      );
    return { ...trip, viewerRole: asRole(own.role), members };
  }

  async createTrip(input: TripInput): Promise<string> {
    const client = await this.clientLoad;
    const { data, error } = await client.rpc('create_trip', {
      p_name: input.name,
      p_start_date: optionalDate(input.startDate),
      p_end_date: optionalDate(input.endDate),
      p_base_currency: input.baseCurrency,
    });
    if (error) {
      throw toTripError(error);
    }
    return data;
  }

  async updateTrip(id: string, input: TripInput): Promise<void> {
    const client = await this.clientLoad;
    const { error } = await client.rpc('update_trip', {
      p_trip_id: id,
      p_name: input.name,
      p_start_date: optionalDate(input.startDate),
      p_end_date: optionalDate(input.endDate),
      p_base_currency: input.baseCurrency,
    });
    if (error) {
      throw toTripError(error);
    }
  }
}
