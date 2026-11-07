import { Routes } from '@angular/router';
import {
  redirectAccountHolder,
  redirectHome,
  requireAccount,
  requireProfile,
  requireSession,
} from './core/auth/auth.guards';

// Screens of later phases show the empty shell until they are built.
const comingSoon = () =>
  import('./features/shell/coming-soon.page').then((module) => module.ComingSoonPage);

export const routes: Routes = [
  { path: '', pathMatch: 'full', canActivate: [redirectHome], children: [] },
  {
    path: 'sign-in',
    canActivate: [redirectAccountHolder],
    loadComponent: () => import('./features/auth/sign-in.page').then((m) => m.SignInPage),
  },
  {
    path: 'auth/callback',
    loadComponent: () =>
      import('./features/auth/auth-callback.page').then((m) => m.AuthCallbackPage),
  },
  {
    path: 'profile/setup',
    canActivate: [requireSession],
    loadComponent: () =>
      import('./features/profile/profile-setup.page').then((m) => m.ProfileSetupPage),
  },
  { path: 'profile', canActivate: [requireSession], loadComponent: comingSoon },
  { path: 'trips', canActivate: [requireSession, requireProfile], loadComponent: comingSoon },
  {
    path: 'trips/new',
    canActivate: [requireSession, requireProfile, requireAccount],
    loadComponent: comingSoon,
  },
  { path: 'trips/:id', canActivate: [requireSession, requireProfile], loadComponent: comingSoon },
  {
    path: 'trips/:id/edit',
    canActivate: [requireSession, requireProfile],
    loadComponent: comingSoon,
  },
  { path: 'join/:token', loadComponent: comingSoon },
  {
    path: '**',
    loadComponent: () =>
      import('./shared/page-not-found/page-not-found').then((m) => m.PageNotFound),
  },
];
