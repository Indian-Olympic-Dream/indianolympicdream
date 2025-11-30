import { Route } from '@angular/router';
import { StoriesComponent } from './stories.component';
import { StoryDetailsComponent } from './story-details/story-details.component';

export const STORIES_ROUTES: Route[] = [
  {
    path: '',
    component: StoriesComponent,
  },
  {
    path: ':slug',
    component: StoryDetailsComponent,
  },
];
