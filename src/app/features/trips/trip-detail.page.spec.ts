import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { FakeAuth } from '../../../testing/fake-auth';
import { fakeDetails } from '../../../testing/fake-trips';
import { provideTestTransloco } from '../../../testing/test-transloco';
import { AuthService } from '../../core/auth/auth.service';
import { TripDetailPage } from './trip-detail.page';
import { TripDetails, TripError, TripsService } from './trips.service';

describe('TripDetailPage', () => {
  async function render(trip: TripDetails | null | Error): Promise<HTMLElement> {
    const auth = new FakeAuth();
    auth.signIn();
    const getTrip = vi.fn(() =>
      trip instanceof Error ? Promise.reject(trip) : Promise.resolve(trip),
    );
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideTestTransloco('en'),
        { provide: AuthService, useValue: auth },
        { provide: TripsService, useValue: { getTrip } },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ id: 'trip-1' }) } },
        },
      ],
    });
    const fixture = TestBed.createComponent(TripDetailPage);
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows the trip details', async () => {
    const element = await render(fakeDetails());

    expect(element.querySelector('h1')?.textContent).toContain('Lisbon');
    expect(element.textContent).toContain('May 10, 2099');
    expect(element.textContent).toContain('EUR');
  });

  it('lists participants with their roles and marks the viewer', async () => {
    const items = [...(await render(fakeDetails())).querySelectorAll('li')];

    expect(items).toHaveLength(2);
    expect(items[0]?.textContent).toContain('Anna');
    expect(items[0]?.textContent).toContain('Organizer');
    expect(items[0]?.textContent).toContain('you');
    expect(items[1]?.textContent).toContain('Boris');
    expect(items[1]?.textContent).toContain('Participant');
    expect(items[1]?.textContent).not.toContain('you');
  });

  it('offers editing to the organizer', async () => {
    const element = await render(fakeDetails());

    expect(element.querySelector('a[href="/trips/trip-1/edit"]')?.textContent).toContain('Edit');
  });

  it('does not offer editing to a participant', async () => {
    const element = await render(fakeDetails({ viewerRole: 'participant' }));

    expect(element.querySelector('a[href="/trips/trip-1/edit"]')).toBeNull();
  });

  it('links back to "My trips"', async () => {
    expect((await render(fakeDetails())).querySelector('a[href="/trips"]')).not.toBeNull();
  });

  it('shows not found, with no trip data, for a closed or missing trip', async () => {
    const element = await render(null);

    expect(element.textContent).toContain('Not found or no access');
    expect(element.querySelector('h1')?.textContent).not.toContain('Lisbon');
  });

  it('shows an error, not "not found", when loading fails', async () => {
    const element = await render(new TripError('errors.unknown', null));

    expect(element.querySelector('[role=alert]')?.textContent).toContain('Something went wrong');
    expect(element.textContent).not.toContain('Not found or no access');
  });
});
