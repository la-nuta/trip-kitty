import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { AuthService } from '../../core/auth/auth.service';
import { safeReturnUrl } from '../../core/auth/return-url';

/** The Supabase client reads the tokens from the link by itself; this page only waits for it. */
@Component({
  selector: 'app-auth-callback-page',
  imports: [RouterLink, TranslocoPipe],
  templateUrl: './auth-callback.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthCallbackPage implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly failed = signal(false);

  async ngOnInit(): Promise<void> {
    await this.auth.whenReady();

    if (this.auth.session() === null) {
      this.failed.set(true);
      return;
    }

    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
    await this.router.navigateByUrl(safeReturnUrl(returnUrl), { replaceUrl: true });
  }
}
