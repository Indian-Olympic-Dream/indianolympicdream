import { Routes } from "@angular/router";
import { authGuard } from "./core/guards/auth.guard";

export const routes: Routes = [
  {
    path: "home",
    loadComponent: () =>
      import("./home/home.component").then((m) => m.HomeComponent),
    data: { animation: "HomePage", order: 2 },
    // resolve: {
    //   allsportsdata: AllSportsResolverService // This resolver would also need to be provided differently if used with standalone components, typically in the route's providers array or globally.
    // }
  },
  {
    path: "sub-home",
    canActivate: [authGuard],
    children: [
      {
        path: "",
        loadComponent: () =>
          import("./admin-home/home/home.component").then(
            (m) => m.HomeComponent,
          ),
        // data: { animation: 'AdminHomePage', order: 3 }
      },
    ],
  },
  {
    path: "sports/:sportname",
    loadComponent: () =>
      import("./sport-details/sport-details.component").then(
        (m) => m.SportDetailsComponent,
      ),
    data: { animation: "SportDetailsPage", order: 1 },
  },
  {
    path: "athletes",
    loadComponent: () =>
      import("./athletes/athletes.component").then((m) => m.AthletesComponent),
    data: {
      animation: "AthletesPage",
      order: 4,
      transitionType: "bottom-to-top",
    },
  },
  {
    path: "history",
    loadComponent: () =>
      import("./history/history.component").then((m) => m.HistoryComponent),
    data: { animation: "HistoryPage", order: 5 },
  },
  {
    path: "history/:slug",
    loadComponent: () =>
      import("./history/edition-detail.component").then((m) => m.EditionDetailComponent),
    data: { animation: "EditionDetailPage", order: 6 },
  },
  {
    path: "calendar",
    loadComponent: () =>
      import("./calendar/calendar.component").then((m) => m.CalendarComponent),
    data: {
      animation: "CalendarPage",
      order: 4,
      transitionType: "bottom-to-top",
    },
  },
  {
    path: "schedule",
    loadComponent: () =>
      import("./schedule/schedule.component").then((m) => m.ScheduleComponent),
    data: {
      animation: "SchedulePage",
      order: 5,
      transitionType: "bottom-to-top",
    },
  },
  {
    path: "explore",
    loadComponent: () =>
      import("./explore/explore.component").then((m) => m.ExploreComponent),
    data: {
      animation: "ExplorePage",
      order: 6,
      transitionType: "bottom-to-top",
    },
  },
  {
    path: "originals",
    loadComponent: () =>
      import("./originals/originals.component").then(
        (m) => m.OriginalsComponent,
      ),
    data: {
      animation: "OriginalsPage",
      order: 7,
      transitionType: "bottom-to-top",
    },
  },
  {
    path: "stories",
    loadChildren: () =>
      import("./stories/stories.routes").then((m) => m.STORIES_ROUTES),
    data: {
      animation: "StoriesPage",
      order: 8,
      transitionType: "bottom-to-top",
    },
  },
  {
    path: "about",
    loadComponent: () =>
      import("./about/about.component").then((m) => m.AboutComponent),
    data: { animation: "AboutPage", order: 8, transitionType: "bottom-to-top" },
  },
  // {
  //   path: 'feedback',
  //   loadComponent: () => import('./feedback/feedback.component').then(m => m.FeedbackComponent),
  //   data: { animation: 'FeedbackPage', order: 10, transitionType: 'bottom-to-top' }
  // },
  {
    path: "auth",
    loadChildren: () => import("./auth/auth.routes").then((m) => m.AUTH_ROUTES),
  },
  {
    path: "internal-error",
    loadComponent: () =>
      import("./server-error/server-error.component").then(
        (m) => m.ServerErrorComponent,
      ),
    data: { animation: "InternalErrorPage", order: 10 },
  },
  { path: "", redirectTo: "/home?edition=2028", pathMatch: "full" },
  {
    path: "**",
    loadComponent: () =>
      import("./pagenotfound/pagenotfound.component").then(
        (m) => m.PagenotfoundComponent,
      ),
    data: { animation: "NotFoundPage", order: 11 },
  },
];
