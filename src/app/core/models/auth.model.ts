import { StallSettings } from './settings.model';
import { Category, MenuItem } from './menu.model';
import { Order } from './order.model';

export interface StallAccount {
  id: string; // e.g. "stall-ah-huat", "stall-uncle-lim"
  stallName: string;
  hawkerCentreName: string;
  unitNumber: string;
  uenNumber: string;
  contactNumber: string;
  ownerName: string;
  email: string;
  password?: string;
  emoji: string;
  cuisineCategory: string;
  settings: StallSettings;
  initialCategories?: Category[];
  initialMenuItems?: MenuItem[];
  initialOrders?: Order[];
}

export interface UserSession {
  stallId: string;
  email: string;
  ownerName: string;
  role: 'owner' | 'cashier' | 'cook';
  loggedInAt: string;
}
