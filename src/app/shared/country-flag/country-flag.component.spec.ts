import { CountryFlagComponent } from './country-flag.component';

describe('CountryFlagComponent', () => {
  it('maps BWF country codes to rectangular flag assets', () => {
    const flag = new CountryFlagComponent();

    flag.code = 'KOR';
    expect(flag.url).toBe('https://flagcdn.com/kr.svg');

    flag.code = 'BUL';
    expect(flag.url).toBe('https://flagcdn.com/bg.svg');
  });

  it('supports BWF aliases and provides a visible fallback', () => {
    const flag = new CountryFlagComponent();

    flag.code = 'INA';
    expect(flag.url).toBe('https://flagcdn.com/id.svg');
    expect(flag.fallbackLabel).toBe('INA');

    flag.code = 'XYZ';
    expect(flag.url).toBeNull();
    expect(flag.fallbackLabel).toBe('XYZ');
  });

  it('covers every Asian Games national Olympic committee without emoji fallback', () => {
    const flag = new CountryFlagComponent();
    const asianGamesCodes = [
      'AFG', 'BRN', 'BAN', 'BHU', 'BRU', 'CAM', 'CHN', 'HKG', 'INA', 'IND', 'IRI', 'IRQ',
      'JPN', 'JOR', 'KAZ', 'PRK', 'KOR', 'KUW', 'KGZ', 'LAO', 'LBN', 'MAC', 'MAS', 'MDV',
      'MGL', 'MYA', 'NEP', 'OMA', 'PAK', 'PLE', 'PHI', 'QAT', 'KSA', 'SGP', 'SRI', 'SYR',
      'TPE', 'TJK', 'THA', 'TLS', 'TKM', 'UAE', 'UZB', 'VIE', 'YEM',
    ];

    for (const code of asianGamesCodes) {
      flag.code = code;
      expect(flag.url).withContext(code).toMatch(/^https:\/\/flagcdn\.com\/.+\.svg$/);
      expect(flag.fallbackLabel).withContext(code).toBe(code);
    }
  });
});
