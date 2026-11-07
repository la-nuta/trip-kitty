import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { AuthService } from '../../core/auth/auth.service';
import { PageNotFound } from '../../shared/page-not-found/page-not-found';
import { ROLE_KEYS } from './my-trips.page';
import { TripDates } from './trip-dates';
import { toTripError, TripDetails, TripsService } from './trips.service';

@Component({
  selector: 'app-trip-detail-page',
  imports: [PageNotFound, RouterLink, TranslocoPipe, TripDates],
  templateUrl: './trip-detail.page.html',
  styleUrl: './trip-detail.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TripDetailPage implements OnInit {
  private readonly trips = inject(TripsService);
  private readonly id = inject(ActivatedRoute).snapshot.paramMap.get('id') ?? '';

  protected readonly auth = inject(AuthService);
  protected readonly roleKeys = ROLE_KEYS;
  protected readonly trip = signal<TripDetails | null>(null);
  protected readonly state = signal<'loading' | 'ready' | 'notFound' | 'error'>('loading');
  protected readonly errorKey = signal('');

  async ngOnInit(): Promise<void> {
    try {
      const trip = await this.trips.getTrip(this.id);
      this.trip.set(trip);
      this.state.set(trip ? 'ready' : 'notFound');
    } catch (error) {
      this.errorKey.set(toTripError(error).key);
      this.state.set('error');
    }
  }
}
