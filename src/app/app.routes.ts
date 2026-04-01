import { Routes } from "@angular/router";

export const routes: Routes = [
  {
    path: "",
    loadComponent: () =>
      import("./sports/sports.component").then((m) => m.SportsComponent),
    data: {
      animation: "HomePage",
      order: 1,
    },
  },
  {
    path: "home",
    redirectTo: "",
    pathMatch: "full",
  },
  {
    path: "sports",
    redirectTo: "",
    pathMatch: "full",
  },
  {
    path: "history",
    loadChildren: () =>
      import("./history/history.routes").then((m) => m.HISTORY_ROUTES),
    data: { animation: "HistoryPage", order: 2 },
  },
  {
    path: "calendar/:slug",
    loadComponent: () =>
      import("./calendar/calendar-detail.component").then(
        (m) => m.CalendarDetailComponent,
      ),
    data: {
      animation: "CalendarDetailPage",
      order: 3,
      transitionType: "bottom-to-top",
    },
  },
  {
    path: "calendar",
    loadComponent: () =>
      import("./calendar/calendar.component").then((m) => m.CalendarComponent),
    data: {
      animation: "CalendarPage",
      order: 3,
      transitionType: "bottom-to-top",
    },
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
    path: "sports",
    loadComponent: () =>
      import("./sports/sports.component").then((m) => m.SportsComponent),
    data: {
      animation: "SportsPage",
      order: 4,
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
      order: 5,
      transitionType: "bottom-to-top",
    },
  },
  {
    path: "stories",
    loadChildren: () =>
      import("./stories/stories.routes").then((m) => m.STORIES_ROUTES),
    data: {
      animation: "StoriesPage",
      order: 6,
      transitionType: "bottom-to-top",
    },
  },
  {
    path: "sport/:sportname",
    redirectTo: "history/sport/:sportname",
  },
  {
    path: "internal-error",
    loadComponent: () =>
      import("./server-error/server-error.component").then(
        (m) => m.ServerErrorComponent,
      ),
    data: { animation: "InternalErrorPage", order: 10 },
  },
  {
    path: "**",
    loadComponent: () =>
      import("./pagenotfound/pagenotfound.component").then(
        (m) => m.PagenotfoundComponent,
      ),
    data: { animation: "NotFoundPage", order: 11 },
  },
];
