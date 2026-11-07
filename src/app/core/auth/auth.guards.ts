import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const requireSession: CanActivateFn = async (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.whenReady();
  return auth.session() !== null
    ? true
    : router.createUrlTree(['/sign-in'], { queryParams: { returnUrl: state.url } });
};

export const requireProfile: CanActivateFn = async (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.whenReady();
  return auth.profile()?.display_name
    ? true
    : router.createUrlTree(['/profile/setup'], { queryParams: { returnUrl: state.url } });
};

export const requireAccount: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.whenReady();
  return auth.isGuest() ? router.createUrlTree(['/trips']) : true;
};

/** Keeps account holders away from /sign-in. Guests may sign in to an existing account. */
export const redirectAccountHolder: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.whenReady();
  return auth.session() !== null && !auth.isGuest() ? router.createUrlTree(['/trips']) : true;
};

export const redirectHome: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.whenReady();
  return router.createUrlTree([auth.session() !== null ? '/trips' : '/sign-in']);
};
