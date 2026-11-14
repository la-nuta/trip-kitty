import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { FakeAuth } from '../../../testing/fake-auth';
import { provideTestTransloco } from '../../../testing/test-transloco';
import { AuthService } from '../../core/auth/auth.service';
import { TripFormComponent } from './trip-form/trip-form.component';
import { By } from '@angular/platform-browser';
import { TripCreatePage } from './trip-create.page';
import { TripError, TripsService } from './trips.service';

const INPUT = { name: 'Lisbon', startDate: null, endDate: null, baseCurrency: 'EUR' };

describe('TripCreatePage', () => {
  async function render(createTrip: ReturnType<typeof vi.fn>) {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideTestTransloco('en'),
        { provide: AuthService, useValue: new FakeAuth() },
        { provide: TripsService, useValue: { createTrip } },
      ],
    });
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    const fixture = TestBed.createComponent(TripCreatePage);
    await fixture.whenStable();
    const form = fixture.debugElement.query(By.directive(TripFormComponent))
      .componentInstance as TripFormComponent;
    return { fixture, form, navigate };
  }

  it('creates the trip and opens it', async () => {
    const createTrip = vi.fn().mockResolvedValue('new-id');
    const { form, fixture, navigate } = await render(createTrip);

    form.save.emit(INPUT);
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();

    expect(createTrip).toHaveBeenCalledWith(INPUT);
    expect(navigate).toHaveBeenCalledWith('/trips/new-id');
  });

  it('passes a server error to the form and stays', async () => {
    const error = new TripError('errors.validation_failed', 'dates');
    const { form, fixture, navigate } = await render(vi.fn().mockRejectedValue(error));

    form.save.emit(INPUT);
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();

    expect(form.serverError()).toBe(error);
    expect(form.busy()).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
  });
});
