import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { PayloadService, Edition, OlympicParticipation, Athlete } from '../services/payload.service';

@Component({
    selector: 'app-edition-detail',
    standalone: true,
    imports: [
        CommonModule,
        RouterModule,
        MatCardModule,
        MatButtonModule,
        MatIconModule,
        MatProgressSpinnerModule,
        MatChipsModule,
    ],
    template: `
    <div class="edition-container" *ngIf="edition">
      <header class="edition-header">
        <button mat-icon-button [routerLink]="['/history']" class="back-button">
          <mat-icon>arrow_back</mat-icon>
        </button>
        <div class="edition-info">
          <h1>{{ edition.name }}</h1>
          <p class="subtitle">{{ edition.city }}, {{ edition.hostCountry }}</p>
        </div>
        <img *ngIf="edition.logo?.url" [src]="getLogoUrl()" 
             [alt]="edition.name + ' logo'" class="edition-logo">
      </header>

      <section class="medals-section" *ngIf="medals.length > 0">
        <h2>🏅 Indian Medal Winners</h2>
        <div class="medals-list">
          <mat-card *ngFor="let medal of medals" class="medal-card"
            [class.gold]="medal.result === 'gold'"
            [class.silver]="medal.result === 'silver'"
            [class.bronze]="medal.result === 'bronze'">
            <div class="medal-icon">{{ getMedalEmoji(medal.result) }}</div>
            <mat-card-content>
              <h3>{{ getAthleteName(medal) }}</h3>
              <p>{{ getEventName(medal) }}</p>
            </mat-card-content>
          </mat-card>
        </div>
      </section>

      <section class="participants-section">
        <h2>Indian Participants ({{ participations.length }})</h2>
        <div class="participants-chips">
          <mat-chip-set>
            <mat-chip *ngFor="let p of participations">
              {{ getAthleteName(p) }} - {{ getEventName(p) }}
            </mat-chip>
          </mat-chip-set>
        </div>
      </section>
    </div>

    <mat-spinner *ngIf="loading"></mat-spinner>
  `,
    styles: [`
    .edition-container {
      padding: 24px;
      max-width: 1200px;
      margin: 0 auto;
    }

    .edition-header {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 32px;
    }

    .back-button {
      background: rgba(255, 255, 255, 0.1);
    }

    .edition-info {
      flex: 1;
    }

    .edition-info h1 {
      margin: 0;
      color: white;
    }

    .subtitle {
      margin: 4px 0 0;
      color: rgba(255, 255, 255, 0.6);
    }

    .edition-logo {
      width: 80px;
      height: 80px;
      object-fit: contain;
    }

    h2 {
      color: white;
      margin-bottom: 16px;
    }

    .medals-section {
      margin-bottom: 32px;
    }

    .medals-list {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
      gap: 16px;
    }

    .medal-card {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 16px;
      background: rgba(30, 30, 50, 0.8);
      border-radius: 12px;
    }

    .medal-card.gold { border-left: 4px solid #FFD700; }
    .medal-card.silver { border-left: 4px solid #C0C0C0; }
    .medal-card.bronze { border-left: 4px solid #CD7F32; }

    .medal-icon {
      font-size: 2rem;
    }

    .medal-card h3 {
      margin: 0;
      color: white;
      font-size: 1rem;
    }

    .medal-card p {
      margin: 4px 0 0;
      color: rgba(255, 255, 255, 0.6);
      font-size: 0.85rem;
    }

    .participants-section {
      margin-top: 32px;
    }

    mat-chip {
      margin: 4px;
    }

    mat-spinner {
      margin: 48px auto;
    }
  `]
})
export class EditionDetailComponent implements OnInit {
    private payload = inject(PayloadService);
    private route = inject(ActivatedRoute);

    edition: Edition | null = null;
    participations: OlympicParticipation[] = [];
    medals: OlympicParticipation[] = [];
    loading = true;

    ngOnInit() {
        const slug = this.route.snapshot.paramMap.get('slug');
        if (slug) {
            this.loadEdition(slug);
        }
    }

    loadEdition(slug: string) {
        this.payload.getEditionBySlug(slug).subscribe(edition => {
            this.edition = edition;
            if (edition) {
                this.loadParticipations(edition.id);
            }
            this.loading = false;
        });
    }

    loadParticipations(editionId: string) {
        this.payload.getParticipations({ editionId }).subscribe(participations => {
            this.participations = participations;
            this.medals = participations.filter(p =>
                ['gold', 'silver', 'bronze'].includes(p.result)
            );
        });
    }

    getLogoUrl(): string {
        if (this.edition?.logo?.url) {
            return 'http://localhost:3000' + this.edition.logo.url;
        }
        return '';
    }

    getAthleteName(p: OlympicParticipation): string {
        if (typeof p.athlete === 'object' && p.athlete) {
            return (p.athlete as Athlete).fullName;
        }
        return 'Unknown';
    }

    getEventName(p: OlympicParticipation): string {
        if (typeof p.event === 'object' && p.event) {
            return p.event.name;
        }
        return '';
    }

    getMedalEmoji(result: string): string {
        switch (result) {
            case 'gold': return '🥇';
            case 'silver': return '🥈';
            case 'bronze': return '🥉';
            default: return '🏅';
        }
    }
}
