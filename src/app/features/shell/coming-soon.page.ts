import { ChangeDetectionStrategy, Component } from '@angular/core';
import { EmptyState } from '../../shared/empty-state/empty-state';

@Component({
  selector: 'app-coming-soon-page',
  imports: [EmptyState],
  template: `<app-empty-state titleKey="common.comingSoonTitle" textKey="common.comingSoonText" />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ComingSoonPage {}
