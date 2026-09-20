import { Injectable, signal, effect, inject } from '@angular/core';
import { StallSettings } from '../models/settings.model';
import { AuthService } from './auth.service';

const DEFAULT_SETTINGS: StallSettings = {
  stallName: 'Hawker Stall',
  hawkerCentreName: 'Hawker Centre',
  unitNumber: '#01-01',
  uenNumber: '202300000A',
  contactNumber: '+65 9000 0000',
  currencySymbol: 'SGD $',
  enableTakeawayFee: true,
  takeawayFeeAmount: 0.30,
  enableGst: false,
  gstRate: 0.09,
  isDarkTheme: false,
  soundAlertsEnabled: true,
  soundVolume: 0.8,
  kdsWarningThresholdMins: 5,
  kdsCriticalThresholdMins: 10
};

@Injectable({
  providedIn: 'root'
})
export class SettingsService {
  private authService = inject(AuthService);

  readonly settings = signal<StallSettings>(this.loadCurrentStallSettings());

  constructor() {
    // When stall changes, reload that stall's settings
    effect(() => {
      const stall = this.authService.currentStall();
      if (stall) {
        this.settings.set(this.loadCurrentStallSettings());
      }
    });

    effect(() => {
      const current = this.settings();
      if (typeof document !== 'undefined') {
        if (current.isDarkTheme) {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      }
    });
  }

  private loadCurrentStallSettings(): StallSettings {
    const stall = this.authService.currentStall();
    if (!stall || !stall.settings) {
      return DEFAULT_SETTINGS;
    }
    return stall.settings;
  }

  updateSettings(partial: Partial<StallSettings>): void {
    this.settings.update(s => ({ ...s, ...partial }));
  }

  toggleTheme(): void {
    this.settings.update(s => ({ ...s, isDarkTheme: !s.isDarkTheme }));
  }

  toggleSound(): void {
    this.settings.update(s => ({ ...s, soundAlertsEnabled: !s.soundAlertsEnabled }));
  }
}
