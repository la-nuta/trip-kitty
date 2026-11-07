import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { TripFormComponent } from './trip-form/trip-form.component';
import { toTripError, TripError, TripInput, TripsService } from './trips.service';

@Component({
  selector: 'app-trip-create-page',
  imports: [TranslocoPipe, TripFormComponent],
  template: `
    <h1>{{ 'trips.newTitle' | transloco }}</h1>
    <app-trip-form
      submitKey="trips.create"
      [busy]="busy()"
      [serverError]="error()"
      (save)="create($event)"
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TripCreatePage {
  private readonly trips = inject(TripsService);
  private readonly router = inject(Router);

  protected readonly busy = signal(false);
  protected readonly error = signal<TripError | null>(null);

  protected async create(input: TripInput): Promise<void> {
    if (this.busy()) {
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    try {
      const id = await this.trips.createTrip(input);
      await this.router.navigateByUrl(`/trips/${id}`);
    } catch (error) {
      this.error.set(toTripError(error));
    } finally {
      this.busy.set(false);
    }
  }
}
