import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

/** Label, projected control, and error message. The error border is set in styles.scss. */
@Component({
  selector: 'app-form-field',
  imports: [TranslocoPipe],
  templateUrl: './form-field.html',
  styleUrl: './form-field.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FormField {
  readonly labelKey = input.required<string>();
  readonly controlId = input.required<string>();
  readonly errorKey = input<string | null>(null);
}
