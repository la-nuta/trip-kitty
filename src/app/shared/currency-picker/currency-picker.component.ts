import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DOCUMENT,
  forwardRef,
  inject,
  input,
  signal,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { LanguageService } from '../../core/i18n/language.service';

interface CurrencyOption {
  readonly code: string;
  readonly label: string;
}

/** ISO 4217 codes from `Intl`, searchable by code and by the name in the active language. */
@Component({
  selector: 'app-currency-picker',
  templateUrl: './currency-picker.component.html',
  styleUrl: './currency-picker.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => CurrencyPickerComponent),
      multi: true,
    },
  ],
})
export class CurrencyPickerComponent implements ControlValueAccessor {
  readonly inputId = input.required<string>();
  readonly invalid = input(false);
  readonly describedBy = input<string | null>(null);

  private readonly languages = inject(LanguageService);
  private readonly document = inject(DOCUMENT);
  private readonly codes = Intl.supportedValuesOf('currency');

  protected readonly value = signal('');
  protected readonly query = signal('');
  protected readonly open = signal(false);
  protected readonly active = signal(-1);
  protected readonly disabled = signal(false);

  private readonly options = computed<readonly CurrencyOption[]>(() => {
    const names = new Intl.DisplayNames(this.languages.language(), { type: 'currency' });
    return this.codes.map((code) => ({ code, label: `${code} — ${names.of(code) ?? code}` }));
  });

  protected readonly matches = computed(() => {
    const language = this.languages.language();
    const query = this.query().trim().toLocaleLowerCase(language);
    return query === ''
      ? this.options()
      : this.options().filter((option) => option.label.toLocaleLowerCase(language).includes(query));
  });

  protected readonly selectedLabel = computed(
    () => this.options().find((option) => option.code === this.value())?.label ?? this.value(),
  );
  protected readonly displayValue = computed(() =>
    this.open() ? this.query() : this.selectedLabel(),
  );
  protected readonly listboxId = computed(() => `${this.inputId()}-listbox`);
  protected readonly activeId = computed(() =>
    this.open() && this.active() >= 0 ? this.optionId(this.active()) : null,
  );

  private onChange: (code: string) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  writeValue(code: string | null): void {
    this.value.set(code ?? '');
  }

  registerOnChange(onChange: (code: string) => void): void {
    this.onChange = onChange;
  }

  registerOnTouched(onTouched: () => void): void {
    this.onTouched = onTouched;
  }

  setDisabledState(disabled: boolean): void {
    this.disabled.set(disabled);
  }

  protected optionId(index: number): string {
    return `${this.inputId()}-option-${index}`;
  }

  protected onFocus(): void {
    this.query.set('');
    this.active.set(-1);
    this.open.set(true);
  }

  protected onInput(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
    this.active.set(-1);
    this.open.set(true);
  }

  protected onKeydown(event: KeyboardEvent): void {
    const count = this.matches().length;
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp': {
        event.preventDefault();
        if (!this.open()) {
          this.onFocus();
        }
        if (count === 0) {
          return;
        }
        const current = this.active();
        const next =
          event.key === 'ArrowDown'
            ? current >= count - 1
              ? 0
              : current + 1
            : current <= 0
              ? count - 1
              : current - 1;
        this.active.set(next);
        this.document.getElementById(this.optionId(next))?.scrollIntoView?.({ block: 'nearest' });
        return;
      }
      case 'Enter': {
        const option = this.open() ? this.matches()[this.active()] : undefined;
        if (option) {
          // Choosing an option must not submit the form around the picker.
          event.preventDefault();
          this.choose(option.code);
        }
        return;
      }
      case 'Escape':
        if (this.open()) {
          event.preventDefault();
          this.close();
        }
        return;
    }
  }

  protected onBlur(): void {
    const typed = this.query().trim().toUpperCase();
    if (this.open() && this.codes.includes(typed)) {
      this.choose(typed);
    } else {
      this.close();
    }
    this.onTouched();
  }

  /** On mousedown, before the input loses focus and closes the list. */
  protected onOptionPointer(event: Event, code: string): void {
    event.preventDefault();
    this.choose(code);
  }

  private choose(code: string): void {
    this.value.set(code);
    this.onChange(code);
    this.close();
  }

  private close(): void {
    this.open.set(false);
    this.query.set('');
    this.active.set(-1);
  }
}
