import { CountryFlagComponent } from './country-flag.component';

describe('CountryFlagComponent', () => {
  it('maps BWF country codes to rectangular flag assets', () => {
    const flag = new CountryFlagComponent();

    flag.code = 'KOR';
    expect(flag.url).toBe('https://flagcdn.com/w80/kr.png');

    flag.code = 'BUL';
    expect(flag.url).toBe('https://flagcdn.com/w80/bg.png');
  });

  it('supports BWF aliases and provides a visible fallback', () => {
    const flag = new CountryFlagComponent();

    flag.code = 'INA';
    expect(flag.url).toBe('https://flagcdn.com/w80/id.png');
    expect(flag.fallbackLabel).toBe('🇮🇩');

    flag.code = 'XYZ';
    expect(flag.url).toBeNull();
    expect(flag.fallbackLabel).toBe('XYZ');
  });
});
