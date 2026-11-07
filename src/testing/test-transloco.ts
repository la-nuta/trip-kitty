import { Injectable } from '@angular/core';
import { provideTransloco, Translation, TranslocoLoader } from '@jsverse/transloco';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { of } from 'rxjs';

export const LANGUAGES = ['en', 'ru'];

@Injectable()
class FileLoader implements TranslocoLoader {
  getTranslation(lang: string) {
    const path = join(process.cwd(), 'public/i18n', `${lang}.json`);
    return of(JSON.parse(readFileSync(path, 'utf8')) as Translation);
  }
}

/** Real translation files, loaded synchronously. */
export function provideTestTransloco(defaultLang = 'en') {
  return provideTransloco({
    config: { availableLangs: LANGUAGES, defaultLang, reRenderOnLangChange: true },
    loader: FileLoader,
  });
}
