import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { NgIf } from '@angular/common';

// Payload and official sport feeds use a mixture of IOC/BWF codes and ISO
// alpha-3 codes. FlagCDN uses ISO alpha-2 (plus the UK home-nation codes), so
// keep the translation in the shared flag primitive rather than every sport UI.
const FLAG_CODES: Record<string, string> = {
  ALG: 'dz', ARG: 'ar', AUS: 'au', AUT: 'at', AZE: 'az',
  BAN: 'bd', BEL: 'be', BGR: 'bg', BRA: 'br', BUL: 'bg',
  CAN: 'ca', CHI: 'cl', CHL: 'cl', CHN: 'cn', CZE: 'cz',
  DEN: 'dk', DEU: 'de', EGY: 'eg', ENG: 'gb-eng', ESA: 'sv', ESP: 'es', EST: 'ee',
  FIN: 'fi', FRA: 'fr', GBR: 'gb', GER: 'de', GRN: 'gd', GUA: 'gt',
  HKG: 'hk', HUN: 'hu', IDN: 'id', INA: 'id', IND: 'in', IRL: 'ie', ISR: 'il', ITA: 'it',
  JPN: 'jp', KAZ: 'kz', KEN: 'ke', KOR: 'kr',
  MAC: 'mo', MAS: 'my', MDV: 'mv', MEX: 'mx', MMR: 'mm', MRI: 'mu', MYA: 'mm', MYS: 'my',
  NED: 'nl', NEP: 'np', NGR: 'ng', NOR: 'no', NZL: 'nz',
  PAK: 'pk', PER: 'pe', POL: 'pl', POR: 'pt',
  ROU: 'ro', RSA: 'za', SCO: 'gb-sct', SGP: 'sg', SIN: 'sg', SLO: 'si', SRI: 'lk',
  SUI: 'ch', SUR: 'sr', SVK: 'sk', SWE: 'se',
  THA: 'th', TPE: 'tw', TTO: 'tt', TUR: 'tr',
  UKR: 'ua', USA: 'us', VIE: 'vn', WAL: 'gb-wls',
};

const HOME_NATION_EMOJI: Record<string, string> = {
  ENG: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
  SCO: '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
  WAL: '🏴󠁧󠁢󠁷󠁬󠁳󠁿',
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
    return assetCode ? `https://flagcdn.com/w80/${assetCode}.png` : null;
  }

  get fallbackLabel(): string {
    const homeNation = HOME_NATION_EMOJI[this.countryCode];
    if (homeNation) return homeNation;

    const assetCode = FLAG_CODES[this.countryCode];
    if (assetCode && /^[a-z]{2}$/.test(assetCode)) {
      return [...assetCode.toUpperCase()]
        .map((letter) => String.fromCodePoint(127397 + letter.charCodeAt(0)))
        .join('');
    }

    return this.countryCode.slice(0, 3) || '—';
  }

  get alt(): string {
    return `${this.label || this.countryCode || 'Country'} flag`;
  }
}
