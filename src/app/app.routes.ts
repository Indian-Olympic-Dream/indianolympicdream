import { Routes } from "@angular/router";
import { authGuard } from "./core/guards/auth.guard";

export const routes: Routes = [

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
    path: "videos",
    loadComponent: () =>
      import("./videos/videos.component").then((m) => m.VideosComponent),
    data: {
      animation: "VideosPage",
      order: 6,
      transitionType: "bottom-to-top",
    },
  },
  {
    path: "store",
    loadComponent: () =>
      import("./store/store.component").then((m) => m.StoreComponent),
    data: {
      animation: "StorePage",
      order: 9,
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

  // History is now the ROOT route
  {
    path: "",
    loadChildren: () =>
      import("./history/history.routes").then((m) => m.HISTORY_ROUTES),
    data: { animation: "HistoryPage", order: 5 },
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
