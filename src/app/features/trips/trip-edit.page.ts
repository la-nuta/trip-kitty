import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { PageNotFound } from '../../shared/page-not-found/page-not-found';
import { TripFormComponent } from './trip-form/trip-form.component';
import { toTripError, TripDetails, TripError, TripInput, TripsService } from './trips.service';

@Component({
  selector: 'app-trip-edit-page',
  imports: [PageNotFound, TranslocoPipe, TripFormComponent],
  template: `
    @switch (state()) {
      @case ('loading') {
        <p role="status">{{ 'common.loading' | transloco }}</p>
      }
      @case ('notFound') {
        <app-page-not-found />
      }
      @case ('error') {
        <p class="form-error" role="alert">{{ loadErrorKey() | transloco }}</p>
      }
      @case ('ready') {
        <h1>{{ 'trips.editTitle' | transloco }}</h1>
        <app-trip-form
          submitKey="trips.save"
          [initial]="initial()"
          [busy]="busy()"
          [serverError]="error()"
          (save)="update($event)"
        />
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TripEditPage implements OnInit {
  private readonly trips = inject(TripsService);
  private readonly router = inject(Router);
  private readonly id = inject(ActivatedRoute).snapshot.paramMap.get('id') ?? '';
  private readonly trip = signal<TripDetails | null>(null);

  protected readonly state = signal<'loading' | 'ready' | 'notFound' | 'error'>('loading');
  protected readonly loadErrorKey = signal('');
  protected readonly busy = signal(false);
  protected readonly error = signal<TripError | null>(null);
  protected readonly initial = computed<TripInput | null>(() => {
    const trip = this.trip();
    return trip
      ? {
          name: trip.name,
          startDate: trip.start_date,
          endDate: trip.end_date,
          baseCurrency: trip.base_currency,
        }
      : null;
  });

  async ngOnInit(): Promise<void> {
    try {
      const trip = await this.trips.getTrip(this.id);
      // A participant gets the same answer as an outsider: the server would refuse anyway.
      if (trip?.viewerRole !== 'organizer') {
        this.state.set('notFound');
        return;
      }
      this.trip.set(trip);
      this.state.set('ready');
    } catch (error) {
      this.loadErrorKey.set(toTripError(error).key);
      this.state.set('error');
    }
  }

  protected async update(input: TripInput): Promise<void> {
    if (this.busy()) {
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    try {
      await this.trips.updateTrip(this.id, input);
      await this.router.navigateByUrl(`/trips/${this.id}`);
    } catch (error) {
      this.error.set(toTripError(error));
    } finally {
      this.busy.set(false);
    }
  }
}
