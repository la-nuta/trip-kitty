import { HttpClient, provideHttpClient } from '@angular/common/http';
import {
  EnvironmentProviders,
  inject,
  isDevMode,
  makeEnvironmentProviders,
  provideAppInitializer,
} from '@angular/core';
import { provideTransloco, TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { detectLanguage } from './language-detection';
import { TranslocoHttpLoader } from './transloco-loader';

async function loadInitialLanguage(): Promise<void> {
  const http = inject(HttpClient);
  const transloco = inject(TranslocoService);

  const available = await firstValueFrom(http.get<string[]>('i18n/languages.json'));
  transloco.setAvailableLangs(available);

  const language = detectLanguage(navigator.languages, available, null);
  transloco.setActiveLang(language);
  await firstValueFrom(transloco.load(language));
}

export function provideI18n(): EnvironmentProviders {
  return makeEnvironmentProviders([
    provideHttpClient(),
    provideTransloco({
      config: {
        reRenderOnLangChange: true,
        fallbackLang: 'en',
        missingHandler: { logMissingKey: true, useFallbackTranslation: true },
        prodMode: !isDevMode(),
      },
      loader: TranslocoHttpLoader,
    }),
    provideAppInitializer(loadInitialLanguage),
  ]);
}
