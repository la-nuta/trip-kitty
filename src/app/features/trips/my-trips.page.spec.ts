import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { FakeAuth, fakeProfile } from '../../../testing/fake-auth';
import { fakeSummary } from '../../../testing/fake-trips';
import { provideTestTransloco } from '../../../testing/test-transloco';
import { AuthService } from '../../core/auth/auth.service';
import { MyTripsPage } from './my-trips.page';
import { TripError, TripsService, TripSummary } from './trips.service';

describe('MyTripsPage', () => {
  let auth: FakeAuth;
  let fixture: ComponentFixture<MyTripsPage>;

  async function render(result: TripSummary[] | Error): Promise<HTMLElement> {
    const listMyTrips = vi.fn(() =>
      result instanceof Error ? Promise.reject(result) : Promise.resolve(result),
    );
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideTestTransloco('en'),
        { provide: AuthService, useValue: auth },
        { provide: TripsService, useValue: { listMyTrips } },
      ],
    });
    fixture = TestBed.createComponent(MyTripsPage);
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  beforeEach(() => {
    vi.useFakeTimers({ now: new Date(2027, 4, 10, 12), toFake: ['Date'] });
    auth = new FakeAuth();
    auth.signIn();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const createLinks = (element: HTMLElement) => element.querySelectorAll('a[href="/trips/new"]');

  it('shows an empty state with the create action', async () => {
    const element = await render([]);

    expect(element.textContent).toContain('No trips yet');
    expect(createLinks(element)).toHaveLength(1);
  });

  it('shows the name, dates, currency, participants, and role', async () => {
    const element = await render([
      fakeSummary({ start_date: '2027-06-01', end_date: '2027-06-05', memberCount: 3 }),
    ]);
    const card = element.querySelector('a[href="/trips/trip-1"]');

    expect(card?.textContent).toContain('Lisbon');
    expect(card?.textContent).toContain('Jun 1, 2027');
    expect(card?.textContent).toContain('EUR');
    expect(card?.textContent).toContain('Participants: 3');
    expect(card?.textContent).toContain('Organizer');
  });

  it('shows the participant role', async () => {
    const element = await render([fakeSummary({ role: 'participant' })]);

    expect(element.textContent).toContain('Participant');
  });

  it('shows groups in order, by the local date, with card colors per group', async () => {
    const element = await render([
      fakeSummary({ id: 'past', start_date: '2027-05-01', end_date: '2027-05-09' }),
      fakeSummary({ id: 'undated', start_date: null, end_date: null }),
      fakeSummary({ id: 'today', start_date: '2027-05-01', end_date: '2027-05-10' }),
    ]);

    expect([...element.querySelectorAll('h2')].map((title) => title.textContent?.trim())).toEqual([
      'Current and upcoming',
      'Without dates',
      'Past',
    ]);
    expect(element.querySelector('a[href="/trips/today"]')?.className).toContain('card-accent');
    expect(element.querySelector('a[href="/trips/undated"]')?.className).toContain('card-undated');
    expect(element.querySelector('a[href="/trips/past"]')?.className).toContain('card-past');
  });

  it('offers creation above a filled list', async () => {
    expect(createLinks(await render([fakeSummary()]))).toHaveLength(1);
  });

  it('tells a guest that creating needs an account, without the link', async () => {
    auth.signIn(fakeProfile(), true);

    const element = await render([]);

    expect(createLinks(element)).toHaveLength(0);
    expect(element.textContent).toContain('needs an account');
  });

  it('shows the same message to a guest with trips', async () => {
    auth.signIn(fakeProfile(), true);

    const element = await render([fakeSummary({ role: 'participant' })]);

    expect(createLinks(element)).toHaveLength(0);
    expect(element.textContent).toContain('needs an account');
  });

  it('shows a translated error when the list cannot be loaded', async () => {
    const element = await render(new TripError('errors.unknown', null));

    expect(element.querySelector('[role=alert]')?.textContent).toContain('Something went wrong');
    expect(element.textContent).not.toContain('No trips yet');
  });
});
