import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { NgIf } from '@angular/common';

// Payload and official sport feeds use a mixture of IOC/BWF codes and ISO
// alpha-3 codes. FlagCDN uses ISO alpha-2 (plus the UK home-nation codes), so
// keep the translation in the shared flag primitive rather than every sport UI.
const FLAG_CODES: Record<string, string> = {
  AFG: 'af', ALG: 'dz', ARG: 'ar', AUS: 'au', AUT: 'at', AZE: 'az',
  BAN: 'bd', BEL: 'be', BGR: 'bg', BHR: 'bh', BHU: 'bt', BRA: 'br', BRN: 'bh', BRU: 'bn', BUL: 'bg',
  CAM: 'kh', CAN: 'ca', CHI: 'cl', CHL: 'cl', CHN: 'cn', CZE: 'cz',
  DEN: 'dk', DEU: 'de', EGY: 'eg', ENG: 'gb-eng', ESA: 'sv', ESP: 'es', EST: 'ee',
  FIN: 'fi', FRA: 'fr', GBR: 'gb', GER: 'de', GRN: 'gd', GUA: 'gt',
  HKG: 'hk', HUN: 'hu', IDN: 'id', INA: 'id', IND: 'in', IRI: 'ir', IRL: 'ie', IRQ: 'iq', ISR: 'il', ITA: 'it',
  JOR: 'jo', JPN: 'jp', KAZ: 'kz', KEN: 'ke', KGZ: 'kg', KOR: 'kr', KSA: 'sa', KUW: 'kw',
  LAO: 'la', LBN: 'lb', MAC: 'mo', MAS: 'my', MDV: 'mv', MEX: 'mx', MGL: 'mn', MMR: 'mm', MRI: 'mu', MYA: 'mm', MYS: 'my',
  NED: 'nl', NEP: 'np', NGR: 'ng', NOR: 'no', NZL: 'nz', OMA: 'om',
  PAK: 'pk', PER: 'pe', PHI: 'ph', PLE: 'ps', POL: 'pl', POR: 'pt', PRK: 'kp',
  QAT: 'qa',
  ROU: 'ro', RSA: 'za', SCO: 'gb-sct', SGP: 'sg', SIN: 'sg', SLO: 'si', SRI: 'lk',
  SUI: 'ch', SUR: 'sr', SVK: 'sk', SWE: 'se', SYR: 'sy',
  THA: 'th', TJK: 'tj', TKM: 'tm', TLS: 'tl', TPE: 'tw', TTO: 'tt', TUR: 'tr',
  UAE: 'ae', UKR: 'ua', USA: 'us', UZB: 'uz', VIE: 'vn', WAL: 'gb-wls', YEM: 'ye',
};

@Component({
  selector: 'app-country-flag',
  standalone: true,
  imports: [NgIf],
  template: `
    <span class="flag-shell" [class.has-image]="url && !failed">
      <img *ngIf="url && !failed" [src]="url" [alt]="alt" (error)="failed = true">
      <span class="flag-fallback" *ngIf="!url || failed" [attr.aria-label]="alt">
        {{ fallbackLabel }}
      </span>
    </span>
  `,
  styleUrls: ['./country-flag.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CountryFlagComponent {
  private countryCode = '';
  failed = false;

  @Input() label = '';
  @Input() size: 'small' | 'medium' = 'medium';

  @Input()
  set code(value: string | null | undefined) {
    this.countryCode = (value || '').trim().toUpperCase();
    this.failed = false;
  }

  get code(): string {
    return this.countryCode;
  }

  get url(): string | null {
    const assetCode = FLAG_CODES[this.countryCode];
    return assetCode ? `https://flagcdn.com/${assetCode}.svg` : null;
  }

  get fallbackLabel(): string {
    return this.countryCode.slice(0, 3) || '—';
  }

  get alt(): string {
    return `${this.label || this.countryCode || 'Country'} flag`;
  }
}
