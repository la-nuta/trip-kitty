import { inject, Pipe, PipeTransform } from '@angular/core';
import { LanguageService } from './language.service';

/** Not pure: the result depends on the language signal, not only on the arguments. */
@Pipe({ name: 'intlNumber', pure: false })
export class IntlNumberPipe implements PipeTransform {
  private readonly languages = inject(LanguageService);
  private readonly formatters = new Map<string, Intl.NumberFormat>();

  transform(value: number | null | undefined, options: Intl.NumberFormatOptions = {}): string {
    return value === null || value === undefined ? '' : this.formatter(options).format(value);
  }

  private formatter(options: Intl.NumberFormatOptions): Intl.NumberFormat {
    const language = this.languages.language();
    const key = `${language}|${JSON.stringify(options)}`;
    let formatter = this.formatters.get(key);
    if (formatter === undefined) {
      formatter = new Intl.NumberFormat(language, options);
      this.formatters.set(key, formatter);
    }
    return formatter;
  }
}
