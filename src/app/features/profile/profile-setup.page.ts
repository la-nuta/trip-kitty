import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { AuthService } from '../../core/auth/auth.service';
import { safeReturnUrl } from '../../core/auth/return-url';
import { toErrorKey } from '../../core/i18n/error-code';
import { languageName } from '../../core/i18n/language-name';
import { LanguageService } from '../../core/i18n/language.service';
import { FormField } from '../../shared/form-field/form-field';

const MAX_NAME_LENGTH = 50;

function displayNameLength(control: AbstractControl<string>): ValidationErrors | null {
  // Counted by characters, like char_length in the database, not by UTF-16 units.
  const length = [...control.value.trim()].length;
  return length >= 1 && length <= MAX_NAME_LENGTH ? null : { displayNameLength: true };
}

@Component({
  selector: 'app-profile-setup-page',
  imports: [FormField, ReactiveFormsModule, TranslocoPipe],
  templateUrl: './profile-setup.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileSetupPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly returnUrl = safeReturnUrl(
    inject(ActivatedRoute).snapshot.queryParamMap.get('returnUrl'),
  );

  protected readonly languages = inject(LanguageService);
  protected readonly languageName = languageName;
  protected readonly busy = signal(false);
  protected readonly submitted = signal(false);
  protected readonly errorKey = signal<string | null>(null);

  protected readonly name = new FormControl(this.auth.profile()?.display_name ?? '', {
    nonNullable: true,
    validators: [displayNameLength],
  });
  protected readonly form = new FormGroup({ name: this.name });

  protected nameErrorKey(): string | null {
    return this.submitted() && this.name.invalid ? 'validation.displayNameLength' : null;
  }

  // The select shows the active language, so it cannot disagree with the header switcher.
  protected onLanguageChange(event: Event): void {
    void this.languages.setLanguage((event.target as HTMLSelectElement).value);
  }

  protected async save(): Promise<void> {
    this.submitted.set(true);
    if (this.name.invalid || this.busy()) {
      return;
    }

    this.busy.set(true);
    this.errorKey.set(null);
    try {
      await this.auth.updateProfile({ display_name: this.name.value.trim() });
      await this.router.navigateByUrl(this.returnUrl);
    } catch (error) {
      this.errorKey.set(toErrorKey(error));
    } finally {
      this.busy.set(false);
    }
  }
}
