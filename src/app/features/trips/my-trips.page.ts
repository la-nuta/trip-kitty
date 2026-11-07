import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { AuthService } from '../../core/auth/auth.service';
import { IntlNumberPipe } from '../../core/i18n/intl-number.pipe';
import { EmptyState } from '../../shared/empty-state/empty-state';
import { TripDates } from './trip-dates';
import { groupTrips, toLocalDate, TripGroupKey } from './trip-grouping';
import { toTripError, TripRole, TripsService, TripSummary } from './trips.service';

const GROUP_VIEW: Record<TripGroupKey, { titleKey: string; cardClass: string }> = {
  current_or_upcoming: { titleKey: 'trips.groupCurrent', cardClass: 'card-accent' },
  undated: { titleKey: 'trips.groupUndated', cardClass: 'card-undated' },
  past: { titleKey: 'trips.groupPast', cardClass: 'card-past' },
};

export const ROLE_KEYS: Record<TripRole, string> = {
  organizer: 'trips.roleOrganizer',
  participant: 'trips.roleParticipant',
};

@Component({
  selector: 'app-my-trips-page',
  imports: [EmptyState, IntlNumberPipe, RouterLink, TranslocoPipe, TripDates],
  templateUrl: './my-trips.page.html',
  styleUrl: './my-trips.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MyTripsPage implements OnInit {
  private readonly trips = inject(TripsService);
  protected readonly auth = inject(AuthService);
  protected readonly roleKeys = ROLE_KEYS;

  // The device's calendar day: a trip ending today is not past yet (FR-005).
  private readonly today = toLocalDate(new Date());
  private readonly list = signal<readonly TripSummary[]>([]);

  protected readonly state = signal<'loading' | 'ready' | 'error'>('loading');
  protected readonly errorKey = signal('');
  protected readonly groups = computed(() =>
    groupTrips(this.list(), this.today).map((group) => ({ ...group, ...GROUP_VIEW[group.key] })),
  );

  async ngOnInit(): Promise<void> {
    try {
      this.list.set(await this.trips.listMyTrips());
      this.state.set('ready');
    } catch (error) {
      this.errorKey.set(toTripError(error).key);
      this.state.set('error');
    }
  }
}
