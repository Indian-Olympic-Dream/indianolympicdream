import { Routes } from "@angular/router";

export const routes: Routes = [
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

