import { ChangeDetectionStrategy, Component, input, OnInit, output, signal } from '@angular/core';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';
import { CurrencyPickerComponent } from '../../../shared/currency-picker/currency-picker.component';
import { FormField } from '../../../shared/form-field/form-field';
import { TripField, TripInput } from '../trips.service';

export interface TripFormError {
  readonly key: string;
  readonly field: TripField | null;
}

const MAX_NAME_LENGTH = 100;

function nameLength(control: AbstractControl<string>): ValidationErrors | null {
  // Counted by characters, like char_length in the database, not by UTF-16 units.
  const length = [...control.value.trim()].length;
  return length >= 1 && length <= MAX_NAME_LENGTH ? null : { nameLength: true };
}

function datesInOrder(group: AbstractControl): ValidationErrors | null {
  const { startDate, endDate } = group.value as { startDate: string; endDate: string };
  return startDate && endDate && endDate < startDate ? { endBeforeStart: true } : null;
}

/** Shared by the create and edit pages. Values stay as typed when saving fails. */
@Component({
  selector: 'app-trip-form',
  imports: [CurrencyPickerComponent, FormField, ReactiveFormsModule, TranslocoPipe],
  templateUrl: './trip-form.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TripFormComponent implements OnInit {
  readonly initial = input<TripInput | null>(null);
  readonly busy = input(false);
  readonly serverError = input<TripFormError | null>(null);
  readonly submitKey = input.required<string>();
  readonly save = output<TripInput>();

  protected readonly submitted = signal(false);
  protected readonly form = new FormGroup(
    {
      name: new FormControl('', { nonNullable: true, validators: [nameLength] }),
      startDate: new FormControl('', { nonNullable: true }),
      endDate: new FormControl('', { nonNullable: true }),
      currency: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    },
    { validators: [datesInOrder] },
  );

  ngOnInit(): void {
    const initial = this.initial();
    if (initial) {
      this.form.setValue({
        name: initial.name,
        startDate: initial.startDate ?? '',
        endDate: initial.endDate ?? '',
        currency: initial.baseCurrency,
      });
    }
  }

  protected nameErrorKey(): string | null {
    const local = this.submitted() && this.form.controls.name.invalid;
    return local || this.serverField() === 'name' ? 'validation.tripNameLength' : null;
  }

  protected endDateErrorKey(): string | null {
    const local = this.submitted() && this.form.hasError('endBeforeStart');
    return local || this.serverField() === 'dates' ? 'validation.endBeforeStart' : null;
  }

  protected currencyErrorKey(): string | null {
    const local = this.submitted() && this.form.controls.currency.invalid;
    return local || this.serverField() === 'base_currency' ? 'validation.required' : null;
  }

  protected formErrorKey(): string | null {
    const error = this.serverError();
    return error && error.field === null ? error.key : null;
  }

  protected onSubmit(): void {
    this.submitted.set(true);
    if (this.form.invalid) {
      return;
    }
    const { name, startDate, endDate, currency } = this.form.getRawValue();
    this.save.emit({
      name: name.trim(),
      startDate: startDate || null,
      endDate: endDate || null,
      baseCurrency: currency,
    });
  }

  private serverField(): TripField | null {
    return this.serverError()?.field ?? null;
  }
}
