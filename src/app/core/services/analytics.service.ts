import { Injectable, computed, inject } from '@angular/core';
import { OrderService } from './order.service';
import { MenuService } from './menu.service';
import { HourlySales, PaymentBreakdown, ShiftSummary, TopSellingItem } from '../models/analytics.model';
import { PaymentMethod } from '../models/order.model';

@Injectable({
  providedIn: 'root'
})
export class AnalyticsService {
  private orderService = inject(OrderService);
  private menuService = inject(MenuService);

  readonly orders = this.orderService.orders;

  readonly shiftSummary = computed<ShiftSummary>(() => {
    const all = this.orders();
    const completed = all.filter(o => o.status === 'completed' || o.status === 'ready' || o.status === 'preparing');
    const cancelled = all.filter(o => o.status === 'cancelled');

    const grossSales = completed.reduce((sum, o) => sum + o.total, 0);
    const takeawayFeesCollected = completed.reduce((sum, o) => sum + o.takeawayFee, 0);
    const netSales = grossSales; // before GST/costs
    const totalOrders = all.length;
    const completedCount = all.filter(o => o.status === 'completed').length;
    const avgOrderValue = completed.length > 0 ? Number((grossSales / completed.length).toFixed(2)) : 0;

    // Calculate Average Prep Time (from createdAt/startedPrepAt to readyAt/completedAt)
    let totalPrepMinutes = 0;
    let prepCount = 0;
    all.forEach(o => {
      const end = o.readyAt || o.completedAt;
      const start = o.startedPrepAt || o.createdAt;
      if (end && start) {
        const diffMs = new Date(end).getTime() - new Date(start).getTime();
        const mins = Math.max(1, Math.round(diffMs / (60 * 1000)));
        totalPrepMinutes += mins;
        prepCount++;
      }
    });
    const avgPrepTimeMins = prepCount > 0 ? Number((totalPrepMinutes / prepCount).toFixed(1)) : 4.2;

    return {
      shiftDate: new Date().toISOString().split('T')[0],
      openedAt: new Date(Date.now() - 6 * 3600 * 1000).toISOString(),
      isClosed: false,
      totalOrders,
      completedOrders: completedCount,
      cancelledOrders: cancelled.length,
      grossSales: Number(grossSales.toFixed(2)),
      netSales: Number(netSales.toFixed(2)),
      takeawayFeesCollected: Number(takeawayFeesCollected.toFixed(2)),
      avgOrderValue,
      avgPrepTimeMins,
      paymentBreakdown: this.paymentBreakdown(),
      topItems: this.topSellingItems()
    };
  });

  readonly paymentBreakdown = computed<PaymentBreakdown[]>(() => {
    const validOrders = this.orders().filter(o => o.paymentStatus === 'paid' && o.status !== 'cancelled');
    const totalRev = validOrders.reduce((sum, o) => sum + o.total, 0);

    const methods: PaymentMethod[] = ['paynow', 'cash', 'nets', 'card'];
    return methods.map(method => {
      const matching = validOrders.filter(o => o.paymentMethod === method);
      const totalAmount = matching.reduce((sum, o) => sum + o.total, 0);
      const percentage = totalRev > 0 ? Number(((totalAmount / totalRev) * 100).toFixed(1)) : 0;
      return {
        method,
        count: matching.length,
        totalAmount: Number(totalAmount.toFixed(2)),
        percentage
      };
    });
  });

  readonly topSellingItems = computed<TopSellingItem[]>(() => {
    const validOrders = this.orders().filter(o => o.status !== 'cancelled');
    const itemMap = new Map<string, { name: string; quantity: number; revenue: number; category: string }>();

    validOrders.forEach(o => {
      o.items.forEach(item => {
        const existing = itemMap.get(item.menuItemId) || {
          name: item.name,
          quantity: 0,
          revenue: 0,
          category: 'Mains'
        };
        existing.quantity += item.quantity;
        existing.revenue += item.totalPrice;
        itemMap.set(item.menuItemId, existing);
      });
    });

    const list: TopSellingItem[] = [];
    itemMap.forEach((val, key) => {
      list.push({
        menuItemId: key,
        name: val.name,
        quantity: val.quantity,
        revenue: Number(val.revenue.toFixed(2)),
        category: val.category
      });
    });

    return list.sort((a, b) => b.quantity - a.quantity).slice(0, 6);
  });

  readonly hourlySales = computed<HourlySales[]>(() => {
    const validOrders = this.orders().filter(o => o.status !== 'cancelled');
    const hours = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00'];
    
    // Map existing orders by hour of creation
    const hourMap = new Map<string, { count: number; rev: number }>();
    hours.forEach(h => hourMap.set(h, { count: 0, rev: 0 }));

    validOrders.forEach(o => {
      const date = new Date(o.createdAt);
      const hourStr = `${String(date.getHours()).padStart(2, '0')}:00`;
      const cur = hourMap.get(hourStr) || { count: 0, rev: 0 };
      cur.count++;
      cur.rev += o.total;
      hourMap.set(hourStr, cur);
    });

    return hours.map(hour => {
      const data = hourMap.get(hour) || { count: 0, rev: 0 };
      return {
        hour,
        orderCount: data.count,
        revenue: Number(data.rev.toFixed(2))
      };
    });
  });
}
