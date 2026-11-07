import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { FakeAuth, fakeProfile } from '../../../testing/fake-auth';
import { provideTestTransloco } from '../../../testing/test-transloco';
import { AuthService } from '../../core/auth/auth.service';
import { LanguageService } from '../../core/i18n/language.service';
import { SignInPage } from './sign-in.page';

describe('SignInPage', () => {
  let auth: FakeAuth;
  let sendCode: ReturnType<typeof vi.fn>;
  let verifyCode: ReturnType<typeof vi.fn>;
  let fixture: ComponentFixture<SignInPage>;
  let navigate: ReturnType<typeof vi.spyOn>;

  function configure(returnUrl: string | null = null): void {
    auth = new FakeAuth();
    sendCode = vi.fn().mockResolvedValue(undefined);
    verifyCode = vi.fn().mockResolvedValue(undefined);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideTestTransloco('en'),
        {
          provide: AuthService,
          useValue: Object.assign(auth, { signInWithEmail: sendCode, verifyEmailCode: verifyCode }),
        },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { queryParamMap: convertToParamMap(returnUrl ? { returnUrl } : {}) },
          },
        },
      ],
    });
    navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
  }

  async function render(): Promise<HTMLElement> {
    fixture = TestBed.createComponent(SignInPage);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  function fill(element: HTMLElement, selector: string, value: string): void {
    const input = element.querySelector(selector) as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
  }

  // The submit handlers are async and Angular does not track them, so let them finish first.
  async function settle(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  }

  async function submit(element: HTMLElement): Promise<void> {
    element.querySelector('form')?.dispatchEvent(new Event('submit', { cancelable: true }));
    await settle();
  }

  async function reachCodeStep(element: HTMLElement): Promise<void> {
    fill(element, 'input[type=email]', 'a@example.test');
    await submit(element);
  }

  it('starts at the email step', async () => {
    configure();
    const element = await render();

    expect(element.querySelector('input[type=email]')).not.toBeNull();
    expect(element.querySelector('#code')).toBeNull();
  });

  it('does not send a code for an empty or invalid email', async () => {
    configure();
    const element = await render();

    await submit(element);
    expect(element.querySelector('[role=alert]')?.textContent).toContain('required');

    fill(element, 'input[type=email]', 'not-an-email');
    await submit(element);
    expect(element.querySelector('[role=alert]')?.textContent).toContain('valid email');
    expect(sendCode).not.toHaveBeenCalled();
  });

  it('marks the invalid control for its error border', async () => {
    configure();
    const element = await render();

    await submit(element);

    expect(element.querySelector('#email')?.getAttribute('aria-invalid')).toBe('true');
    expect(element.querySelector('#email')?.getAttribute('aria-describedby')).toBe('email-error');
  });

  it('sends the code with the trimmed email and the safe returnUrl', async () => {
    configure('/join/abc');
    const element = await render();

    fill(element, 'input[type=email]', '  a@example.test ');
    await submit(element);

    expect(sendCode).toHaveBeenCalledWith('a@example.test', '/join/abc');
    expect(element.querySelector('#code')).not.toBeNull();
    expect(element.textContent).toContain('a@example.test');
  });

  it('sends the default returnUrl instead of an external one', async () => {
    configure('https://evil.example');
    const element = await render();

    await reachCodeStep(element);

    expect(sendCode).toHaveBeenCalledWith('a@example.test', '/trips');
  });

  it('stays on the email step and shows a translated error when sending fails', async () => {
    configure();
    const element = await render();
    sendCode.mockRejectedValue({ code: 'over_email_send_rate_limit' });

    await reachCodeStep(element);

    expect(element.querySelector('#code')).toBeNull();
    expect(element.querySelector('[role=alert]')?.textContent).toContain('Too many attempts');
  });

  it('requires a 6-digit code', async () => {
    configure();
    const element = await render();
    await reachCodeStep(element);

    fill(element, '#code', '123');
    await submit(element);

    expect(element.querySelector('[role=alert]')?.textContent).toContain('6-digit');
    expect(verifyCode).not.toHaveBeenCalled();
  });

  it('verifies the code and goes to returnUrl', async () => {
    configure('/join/abc');
    const element = await render();
    await reachCodeStep(element);

    fill(element, '#code', '123456');
    await submit(element);

    expect(verifyCode).toHaveBeenCalledWith('a@example.test', '123456');
    expect(navigate).toHaveBeenCalledWith('/join/abc');
  });

  it('goes to /trips without returnUrl', async () => {
    configure();
    const element = await render();
    await reachCodeStep(element);

    fill(element, '#code', '123456');
    await submit(element);

    expect(navigate).toHaveBeenCalledWith('/trips');
  });

  it('shows a translated error for a wrong code and keeps the step', async () => {
    configure();
    const element = await render();
    await reachCodeStep(element);
    verifyCode.mockRejectedValue({ code: 'otp_expired' });

    fill(element, '#code', '000000');
    await submit(element);

    expect(element.querySelector('[role=alert]')?.textContent).toContain('wrong or has expired');
    expect((element.querySelector('#code') as HTMLInputElement).value).toBe('000000');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('can go back to change the email', async () => {
    configure();
    const element = await render();
    await reachCodeStep(element);

    (element.querySelector('button[type=button]') as HTMLButtonElement).click();
    await fixture.whenStable();

    expect((element.querySelector('#email') as HTMLInputElement).value).toBe('a@example.test');
    expect(element.querySelector('#code')).toBeNull();
  });

  it('warns a guest that the guest profile will be lost', async () => {
    configure();
    auth.signIn(fakeProfile(), true);

    expect((await render()).textContent).toContain('will be lost');
  });

  it('does not warn a visitor', async () => {
    configure();

    expect((await render()).textContent).not.toContain('will be lost');
  });

  describe('language switch (SC-006)', () => {
    it('keeps the typed email', async () => {
      configure();
      const element = await render();
      fill(element, 'input[type=email]', 'a@example.test');

      await TestBed.inject(LanguageService).setLanguage('ru');
      await fixture.whenStable();

      expect((element.querySelector('#email') as HTMLInputElement).value).toBe('a@example.test');
      expect(element.textContent).toContain('Вход');
    });

    it('keeps the code step and the typed code', async () => {
      configure();
      const element = await render();
      await reachCodeStep(element);
      fill(element, '#code', '123');

      await TestBed.inject(LanguageService).setLanguage('ru');
      await fixture.whenStable();

      expect((element.querySelector('#code') as HTMLInputElement).value).toBe('123');
      expect(element.textContent).toContain('a@example.test');
      expect(element.textContent).toContain('Одноразовый код');
    });
  });
});
