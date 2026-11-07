import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { FakeAuth } from '../../../testing/fake-auth';
import { provideTestTransloco } from '../../../testing/test-transloco';
import { AuthService } from '../../core/auth/auth.service';
import { AuthCallbackPage } from './auth-callback.page';

describe('AuthCallbackPage', () => {
  let auth: FakeAuth;
  let navigate: ReturnType<typeof vi.spyOn>;

  async function open(returnUrl: string | null): Promise<HTMLElement> {
    auth = auth ?? new FakeAuth();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideTestTransloco('en'),
        { provide: AuthService, useValue: auth },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { queryParamMap: convertToParamMap(returnUrl ? { returnUrl } : {}) },
          },
        },
      ],
    });
    navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    const fixture = TestBed.createComponent(AuthCallbackPage);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  beforeEach(() => {
    auth = new FakeAuth();
    auth.signIn();
  });

  it('returns to an internal returnUrl', async () => {
    await open('/join/abc');

    expect(auth.whenReadyCalls).toBe(1);
    expect(navigate).toHaveBeenCalledWith('/join/abc', { replaceUrl: true });
  });

  it('goes to /trips without returnUrl', async () => {
    await open(null);

    expect(navigate).toHaveBeenCalledWith('/trips', { replaceUrl: true });
  });

  it.each(['//evil.example', '/\\evil.example', 'https://evil.example'])(
    'refuses the external returnUrl %s',
    async (returnUrl) => {
      await open(returnUrl);

      expect(navigate).toHaveBeenCalledWith('/trips', { replaceUrl: true });
    },
  );

  it('explains a failed link and offers sign-in', async () => {
    auth.signOutNow();

    const element = await open('/join/abc');

    expect(navigate).not.toHaveBeenCalled();
    expect(element.textContent).toContain('invalid or has expired');
    expect(element.querySelector('a')?.getAttribute('href')).toBe('/sign-in');
  });
});
