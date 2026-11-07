import { TestBed } from '@angular/core/testing';
import { FakeAuth } from '../../../testing/fake-auth';
import { provideTestTransloco } from '../../../testing/test-transloco';
import { AuthService } from '../../core/auth/auth.service';
import { TripDates } from './trip-dates';

describe('TripDates', () => {
  async function text(start: string | null, end: string | null): Promise<string> {
    TestBed.configureTestingModule({
      providers: [provideTestTransloco('en'), { provide: AuthService, useValue: new FakeAuth() }],
    });
    const fixture = TestBed.createComponent(TripDates);
    fixture.componentRef.setInput('start', start);
    fixture.componentRef.setInput('end', end);
    await fixture.whenStable();
    return (fixture.nativeElement as HTMLElement).textContent?.replace(/\s+/g, ' ').trim() ?? '';
  }

  it('shows a range', async () => {
    expect(await text('2027-05-10', '2027-05-17')).toBe('May 10, 2027 – May 17, 2027');
  });

  it('shows one date for a one-day trip', async () => {
    expect(await text('2027-05-10', '2027-05-10')).toBe('May 10, 2027');
  });

  it('shows a single start date', async () => {
    expect(await text('2027-05-10', null)).toBe('May 10, 2027');
  });

  it('shows a single end date', async () => {
    expect(await text(null, '2027-05-17')).toBe('May 17, 2027');
  });

  it('says when there are no dates', async () => {
    expect(await text(null, null)).toBe('Dates not set');
  });
});
