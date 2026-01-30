import { Routes } from '@angular/router';

export const HISTORY_ROUTES: Routes = [
    {
        path: '',
        loadComponent: () =>
            import('./history.component').then((m) => m.HistoryComponent),
        data: { animation: 'HistoryPage', order: 5 },
    },
    {
        path: 'sport/:sportname',
        loadComponent: () =>
            import('./history-sport-detail.component').then(
                (m) => m.HistorySportDetailComponent,
            ),
        data: { animation: 'HistorySportDetailPage', order: 6 },
    },
    {
        path: ':slug',
        loadComponent: () =>
            import('./edition-detail.component').then(
                (m) => m.EditionDetailComponent,
            ),
        data: { animation: 'EditionDetailPage', order: 6 },
    },
];
