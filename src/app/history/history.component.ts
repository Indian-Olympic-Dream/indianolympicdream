import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { PayloadService, Edition, OlympicParticipation } from '../services/payload.service';

@Component({
  selector: 'app-history',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <div class="history-container">
      <header class="history-header">
        <h1>Indian Olympic History</h1>
        <p class="subtitle">India's Olympic Journey from 1900 to Present</p>
      </header>

      <section class="stats-section">
        <div class="stat-card">
          <mat-icon>emoji_events</mat-icon>
          <div class="stat-value">{{ medalCounts.gold }}</div>
          <div class="stat-label">Gold Medals</div>
        </div>
        <div class="stat-card">
          <mat-icon>workspace_premium</mat-icon>
          <div class="stat-value">{{ medalCounts.silver }}</div>
          <div class="stat-label">Silver Medals</div>
        </div>
        <div class="stat-card">
          <mat-icon>military_tech</mat-icon>
          <div class="stat-value">{{ medalCounts.bronze }}</div>
          <div class="stat-label">Bronze Medals</div>
        </div>
        <div class="stat-card">
          <mat-icon>groups</mat-icon>
          <div class="stat-value">{{ totalAthletes }}</div>
          <div class="stat-label">Olympians</div>
        </div>
      </section>

      <section class="editions-section">
        <h2>Olympic Editions</h2>
        <div class="editions-grid" *ngIf="!loading">
          <mat-card *ngFor="let edition of editions" class="edition-card"
            [routerLink]="['/history', edition.slug]">
            <img *ngIf="edition.logo?.url" [src]="getLogoUrl(edition)" 
                 [alt]="edition.name + ' logo'" class="edition-logo">
            <div *ngIf="!edition.logo?.url" class="edition-placeholder">
              {{ edition.year }}
            </div>
            <mat-card-content>
              <h3>{{ edition.name }}</h3>
              <p>{{ edition.city }}, {{ edition.hostCountry }}</p>
            </mat-card-content>
          </mat-card>
        </div>
        <mat-spinner *ngIf="loading"></mat-spinner>
      </section>
    </div>
  `,
  styles: [`
    .history-container {
      padding: 24px;
      max-width: 1200px;
      margin: 0 auto;
    }

    .history-header {
      text-align: center;
      margin-bottom: 40px;
    }

    .history-header h1 {
      font-size: 2.5rem;
      margin-bottom: 8px;
      background: linear-gradient(135deg, #FF9933, #FFFFFF, #138808);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    .subtitle {
      color: rgba(255, 255, 255, 0.7);
      font-size: 1.1rem;
    }

    .stats-section {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 16px;
      margin-bottom: 48px;
    }

    .stat-card {
      background: linear-gradient(135deg, rgba(255, 153, 51, 0.1), rgba(19, 136, 8, 0.1));
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      padding: 24px;
      text-align: center;
    }

    .stat-card mat-icon {
      font-size: 32px;
      width: 32px;
      height: 32px;
      color: #FF9933;
      margin-bottom: 8px;
    }

    .stat-value {
      font-size: 2rem;
      font-weight: 700;
      color: white;
    }

    .stat-label {
      color: rgba(255, 255, 255, 0.6);
      font-size: 0.9rem;
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    .editions-section h2 {
      margin-bottom: 24px;
      color: white;
    }

    .editions-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
      gap: 16px;
    }

    .edition-card {
      background: rgba(30, 30, 50, 0.8);
      border-radius: 12px;
      cursor: pointer;
      transition: transform 0.2s, box-shadow 0.2s;
      overflow: hidden;
    }

    .edition-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 8px 24px rgba(255, 153, 51, 0.2);
    }

    .edition-logo {
      width: 100%;
      height: 100px;
      object-fit: contain;
      padding: 16px;
      background: rgba(255, 255, 255, 0.05);
    }

    .edition-placeholder {
      width: 100%;
      height: 100px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 2rem;
      font-weight: 700;
      background: linear-gradient(135deg, #1a1a2e, #16213e);
      color: #FF9933;
    }

    .edition-card h3 {
      margin: 0;
      font-size: 1rem;
      color: white;
    }

    .edition-card p {
      margin: 4px 0 0;
      font-size: 0.85rem;
      color: rgba(255, 255, 255, 0.6);
    }

    mat-spinner {
      margin: 48px auto;
    }
  `]
})
export class HistoryComponent implements OnInit {
  private payload = inject(PayloadService);

  editions: Edition[] = [];
  loading = true;
  totalAthletes = 0;
  medalCounts = { gold: 0, silver: 0, bronze: 0 };

  ngOnInit() {
    this.loadData();
  }

  async loadData() {
    // Load editions (all completed ones)
    this.payload.getEditions({ status: 'completed' }).subscribe(editions => {
      this.editions = [...editions].sort((a, b) => b.year - a.year);
      this.loading = false;
    });

    // Load medal counts
    this.payload.getMedalists().subscribe(participations => {
      participations.forEach(p => {
        if (p.result === 'gold') this.medalCounts.gold++;
        else if (p.result === 'silver') this.medalCounts.silver++;
        else if (p.result === 'bronze') this.medalCounts.bronze++;
      });
    });

    // Load athlete count
    this.payload.getAthletes({ limit: 1 }).subscribe(response => {
      this.totalAthletes = response.totalDocs;
    });
  }

  getLogoUrl(edition: Edition): string {
    if (edition.logo?.url) {
      return 'http://localhost:3000' + edition.logo.url;
    }
    return '';
  }
}
