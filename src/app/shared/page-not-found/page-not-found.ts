import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { EmptyState } from '../empty-state/empty-state';

/** Also used for "trip not found or no access": the text never says which of the two it is. */
@Component({
  selector: 'app-page-not-found',
  imports: [EmptyState, RouterLink, TranslocoPipe],
  templateUrl: './page-not-found.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PageNotFound {}
