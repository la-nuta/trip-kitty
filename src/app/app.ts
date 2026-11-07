import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { AuthService } from './core/auth/auth.service';
import { languageName } from './core/i18n/language-name';
import { LanguageService } from './core/i18n/language.service';
import { ThemeService } from './core/theme/theme.service';

@Component({
  imports: [RouterLink, RouterOutlet, TranslocoPipe],
  selector: 'app-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  protected readonly auth = inject(AuthService);
  protected readonly languages = inject(LanguageService);
  protected readonly languageName = languageName;

  constructor() {
    // Created here so the saved theme applies on every screen.
    inject(ThemeService);
  }

  protected onLanguageChange(event: Event): void {
    void this.languages.setLanguage((event.target as HTMLSelectElement).value);
  }
}
