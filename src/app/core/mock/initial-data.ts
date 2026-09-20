import { Category, MenuItem } from '../models/menu.model';
import { Order } from '../models/order.model';
import { StallSettings } from '../models/settings.model';
import { StallAccount } from '../models/auth.model';

export const PRESET_STALLS: StallAccount[] = [];
export const INITIAL_CATEGORIES: Category[] = [];
export const INITIAL_MENU_ITEMS: MenuItem[] = [];
export const INITIAL_ORDERS: Order[] = [];
export const INITIAL_SETTINGS: StallSettings = {
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
