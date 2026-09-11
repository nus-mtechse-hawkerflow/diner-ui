export interface StallSettings {
  stallName: string;
  hawkerCentreName: string;
  unitNumber: string;
  uenNumber: string; // PayNow UEN
  contactNumber: string;
  currencySymbol: string;
  enableTakeawayFee: boolean;
  takeawayFeeAmount: number; // default $0.30 SGD
  enableGst: boolean;
  gstRate: number; // e.g. 0.09 (9%)
  isDarkTheme: boolean;
  soundAlertsEnabled: boolean;
  soundVolume: number;
  kdsWarningThresholdMins: number; // default 5 mins
  kdsCriticalThresholdMins: number; // default 10 mins
}
