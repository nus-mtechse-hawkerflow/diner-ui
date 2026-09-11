import { PaymentMethod } from './order.model';

export interface PaymentBreakdown {
  method: PaymentMethod;
  count: number;
  totalAmount: number;
  percentage: number;
}

export interface HourlySales {
  hour: string; // e.g. "11:00", "12:00"
  orderCount: number;
  revenue: number;
}

export interface TopSellingItem {
  menuItemId: string;
  name: string;
  quantity: number;
  revenue: number;
  category: string;
}

export interface ShiftSummary {
  shiftDate: string;
  openedAt: string;
  closedAt?: string;
  isClosed: boolean;
  totalOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  grossSales: number;
  netSales: number;
  takeawayFeesCollected: number;
  avgOrderValue: number;
  avgPrepTimeMins: number;
  paymentBreakdown: PaymentBreakdown[];
  topItems: TopSellingItem[];
}
