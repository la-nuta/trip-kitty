import { TestBed } from '@angular/core/testing';
import { provideTestTransloco } from '../../../testing/test-transloco';
import { EmptyState } from './empty-state';

describe('EmptyState', () => {
  it('shows the translated title and text', async () => {
    TestBed.configureTestingModule({ providers: [provideTestTransloco('ru')] });
    const fixture = TestBed.createComponent(EmptyState);
    fixture.componentRef.setInput('titleKey', 'common.comingSoonTitle');
    fixture.componentRef.setInput('textKey', 'common.comingSoonText');
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('h1')?.textContent).toContain('Здесь пока пусто');
    expect(element.querySelector('p')?.textContent).toContain('Этот раздел скоро появится.');
  });
});
