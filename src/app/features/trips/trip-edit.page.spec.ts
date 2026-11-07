import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { FakeAuth } from '../../../testing/fake-auth';
import { fakeDetails } from '../../../testing/fake-trips';
import { provideTestTransloco } from '../../../testing/test-transloco';
import { AuthService } from '../../core/auth/auth.service';
import { TripFormComponent } from './trip-form/trip-form.component';
import { TripEditPage } from './trip-edit.page';
import { TripDetails, TripError, TripsService } from './trips.service';

const INPUT = { name: 'Porto', startDate: null, endDate: null, baseCurrency: 'USD' };

describe('TripEditPage', () => {
  async function render(trip: TripDetails | null | Error, updateTrip = vi.fn()) {
    const getTrip = vi.fn(() =>
      trip instanceof Error ? Promise.reject(trip) : Promise.resolve(trip),
    );
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideTestTransloco('en'),
        { provide: AuthService, useValue: new FakeAuth() },
        { provide: TripsService, useValue: { getTrip, updateTrip } },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ id: 'trip-1' }) } },
        },
      ],
    });
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    const fixture = TestBed.createComponent(TripEditPage);
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
    return { fixture, navigate, getTrip, element: fixture.nativeElement as HTMLElement };
  }

  it('starts the form from the trip, for the organizer', async () => {
    const { element, getTrip } = await render(fakeDetails());

    expect(getTrip).toHaveBeenCalledWith('trip-1');
    expect((element.querySelector('#trip-name') as HTMLInputElement).value).toBe('Lisbon');
    expect((element.querySelector('#trip-start') as HTMLInputElement).value).toBe('2099-05-10');
  });

  it('shows not found to a participant, with no trip data', async () => {
    const { element } = await render(fakeDetails({ viewerRole: 'participant' }));

    expect(element.textContent).toContain('Not found or no access');
    expect(element.textContent).not.toContain('Lisbon');
    expect(element.querySelector('form')).toBeNull();
  });

  it('shows not found when the trip is closed or missing', async () => {
    const { element } = await render(null);

    expect(element.textContent).toContain('Not found or no access');
  });

  it('shows an error, not "not found", when loading fails', async () => {
    const { element } = await render(new TripError('errors.unknown', null));

    expect(element.querySelector('[role=alert]')?.textContent).toContain('Something went wrong');
    expect(element.textContent).not.toContain('Not found or no access');
  });

  it('saves and returns to the trip', async () => {
    const updateTrip = vi.fn().mockResolvedValue(undefined);
    const { fixture, navigate } = await render(fakeDetails(), updateTrip);
    const form = fixture.debugElement.query(By.directive(TripFormComponent))
      .componentInstance as TripFormComponent;

    form.save.emit(INPUT);
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();

    expect(updateTrip).toHaveBeenCalledWith('trip-1', INPUT);
    expect(navigate).toHaveBeenCalledWith('/trips/trip-1');
  });

  it('passes a server error to the form and stays', async () => {
    const error = new TripError('errors.not_organizer', null);
    const { fixture, navigate } = await render(fakeDetails(), vi.fn().mockRejectedValue(error));
    const form = fixture.debugElement.query(By.directive(TripFormComponent))
      .componentInstance as TripFormComponent;

    form.save.emit(INPUT);
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();

    expect(form.serverError()).toBe(error);
    expect(navigate).not.toHaveBeenCalled();
  });
});
