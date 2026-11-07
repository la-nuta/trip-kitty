import { inject, Pipe, PipeTransform } from '@angular/core';
import { LanguageService } from './language.service';

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** Not pure: the result depends on the language signal, not only on the arguments. */
@Pipe({ name: 'intlDate', pure: false })
export class IntlDatePipe implements PipeTransform {
  private readonly languages = inject(LanguageService);
  private readonly formatters = new Map<string, Intl.DateTimeFormat>();

  transform(
    value: string | null | undefined,
    options: Intl.DateTimeFormatOptions = { dateStyle: 'medium' },
  ): string {
    if (!value) {
      return '';
    }

    const dateOnly = DATE_ONLY.test(value);
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '';
    }

    // A date-only value parses as midnight UTC, so it is also formatted in UTC: it must not move
    // to the previous day west of Greenwich.
    return this.formatter(dateOnly ? { ...options, timeZone: 'UTC' } : options).format(date);
  }

  private formatter(options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
    const language = this.languages.language();
    const key = `${language}|${JSON.stringify(options)}`;
    let formatter = this.formatters.get(key);
    if (formatter === undefined) {
      formatter = new Intl.DateTimeFormat(language, options);
      this.formatters.set(key, formatter);
    }
    return formatter;
  }
}
