import { TestBed } from '@angular/core/testing';
import { provideTestTransloco } from '../../../testing/test-transloco';
import { FormField } from './form-field';

describe('FormField', () => {
  function render(errorKey: string | null) {
    TestBed.configureTestingModule({ providers: [provideTestTransloco('en')] });
    const fixture = TestBed.createComponent(FormField);
    fixture.componentRef.setInput('labelKey', 'auth.emailLabel');
    fixture.componentRef.setInput('controlId', 'email');
    fixture.componentRef.setInput('errorKey', errorKey);
    fixture.detectChanges();
    return fixture;
  }

  it('links a translated label to the control', async () => {
    const fixture = render(null);
    await fixture.whenStable();
    const label = (fixture.nativeElement as HTMLElement).querySelector('label');

    expect(label?.textContent).toContain('Email');
    expect(label?.getAttribute('for')).toBe('email');
  });

  it('shows no error by default', () => {
    expect((render(null).nativeElement as HTMLElement).querySelector('[role=alert]')).toBeNull();
  });

  it('shows a translated error with an id the control can refer to', async () => {
    const fixture = render('validation.required');
    await fixture.whenStable();
    const error = (fixture.nativeElement as HTMLElement).querySelector('[role=alert]');

    expect(error?.textContent).toContain('This field is required.');
    expect(error?.id).toBe('email-error');
  });
});
