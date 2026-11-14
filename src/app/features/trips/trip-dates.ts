import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { IntlDatePipe } from '../../core/i18n/intl-date.pipe';

/** A range, a single date when only one is set or both are equal, or "dates not set". */
@Component({
  selector: 'app-trip-dates',
  imports: [IntlDatePipe, TranslocoPipe],
  template: `
    @if (start() && end() && start() !== end()) {
      {{ start() | intlDate }} – {{ end() | intlDate }}
    } @else if (start() ?? end(); as date) {
      {{ date | intlDate }}
    } @else {
      {{ 'trips.noDates' | transloco }}
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TripDates {
  readonly start = input<string | null>(null);
  readonly end = input<string | null>(null);
}
