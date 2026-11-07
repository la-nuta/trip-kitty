import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTestTransloco } from '../../../testing/test-transloco';
import { PageNotFound } from './page-not-found';

describe('PageNotFound', () => {
  it('does not reveal whether the address exists and links home', async () => {
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideTestTransloco('en')] });
    const fixture = TestBed.createComponent(PageNotFound);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;

    expect(element.textContent).toContain('Not found or no access');
    expect(element.querySelector('a')?.getAttribute('href')).toBe('/');
  });
});
