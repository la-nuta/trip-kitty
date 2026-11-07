import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { AuthService } from '../../core/auth/auth.service';
import { safeReturnUrl } from '../../core/auth/return-url';
import { toErrorKey } from '../../core/i18n/error-code';
import { FormField } from '../../shared/form-field/form-field';

@Component({
  selector: 'app-sign-in-page',
  imports: [FormField, ReactiveFormsModule, TranslocoPipe],
  templateUrl: './sign-in.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SignInPage {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly returnUrl = safeReturnUrl(
    inject(ActivatedRoute).snapshot.queryParamMap.get('returnUrl'),
  );

  protected readonly step = signal<'email' | 'code'>('email');
  protected readonly busy = signal(false);
  protected readonly submitted = signal(false);
  protected readonly errorKey = signal<string | null>(null);

  protected readonly email = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.email],
  });
  protected readonly code = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.pattern(/^\d{6}$/)],
  });
  protected readonly emailForm = new FormGroup({ email: this.email });
  protected readonly codeForm = new FormGroup({ code: this.code });

  protected emailErrorKey(): string | null {
    if (!this.submitted() || this.email.valid) {
      return null;
    }
    return this.email.hasError('required') ? 'validation.required' : 'validation.email';
  }

  protected codeErrorKey(): string | null {
    return this.submitted() && this.code.invalid ? 'validation.codeFormat' : null;
  }

  protected async sendCode(): Promise<void> {
    this.email.setValue(this.email.value.trim());
    this.submitted.set(true);
    if (this.email.invalid) {
      return;
    }
    await this.run(async () => {
      await this.auth.signInWithEmail(this.email.value, this.returnUrl);
      this.submitted.set(false);
      this.step.set('code');
    });
  }

  protected async verifyCode(): Promise<void> {
    this.code.setValue(this.code.value.trim());
    this.submitted.set(true);
    if (this.code.invalid) {
      return;
    }
    await this.run(async () => {
      await this.auth.verifyEmailCode(this.email.value, this.code.value);
      await this.router.navigateByUrl(this.returnUrl);
    });
  }

  protected changeEmail(): void {
    this.code.reset();
    this.errorKey.set(null);
    this.submitted.set(false);
    this.step.set('email');
  }

  private async run(action: () => Promise<void>): Promise<void> {
    if (this.busy()) {
      return;
    }
    this.busy.set(true);
    this.errorKey.set(null);
    try {
      await action();
    } catch (error) {
      this.errorKey.set(toErrorKey(error));
    } finally {
      this.busy.set(false);
    }
  }
}
