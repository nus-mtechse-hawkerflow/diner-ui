import { Component, inject, signal, computed, OnInit, OnDestroy, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { CustomerService } from '../../core/services/customer.service';
import { OrderService } from '../../core/services/order.service';
import { OrderNotificationService } from '../../core/services/order-notification.service';
import { AudioService } from '../../core/services/audio.service';
import { Order, OrderStatus } from '../../core/models/order.model';
import { OrderStatusEvent } from '../../core/models/order-notification.model';
import { ReceiptModalComponent } from '../../shared/components/receipt-modal/receipt-modal.component';
import { IconComponent } from '../../shared/components/icon/icon.component';

@Component({
  selector: 'app-customer-order-tracker',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ReceiptModalComponent, IconComponent],
  templateUrl: './customer-order-tracker.component.html'
})
export class CustomerOrderTrackerComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private customerService = inject(CustomerService);
  private orderService = inject(OrderService);
  private orderNotificationService = inject(OrderNotificationService);
  private audioService = inject(AudioService);

  orderId = signal<string>('');
  order = signal<Order | null>(null);
  stallName = signal<string>('Hawker Stall');
  stallEmoji = signal<string>('🍲');

  showReceiptModal = signal<boolean>(false);
  selectedPastOrderForReceipt = signal<Order | null>(null);
  stepLevel = signal<number>(1); // 1 = Received, 2 = Cooking, 3 = Ready, 4 = Completed
  estimatedMinutes = signal<number>(6);
  currentStatus = signal<OrderStatus>('pending');

  lookupQuery = '';
  isSearching = signal<boolean>(false);
  lookupNotFound = signal<boolean>(false);
  searchedPastOrder = signal<Order | null>(null);

  readonly allCustomerOrders = this.customerService.customerOrders;
  readonly activeOrders = this.customerService.activeCustomerOrders;

  private eventSubscription: Subscription | null = null;

  constructor() {
    // React to live status events from AWS SNS
    effect(() => {
      const event = this.orderNotificationService.latestStatusEvent();
      if (event) {
        this.handleStatusEvent(event);
      }
    });

    // If order list changes and no order is currently selected, pick first active
    effect(() => {
      const current = this.order();
      const actives = this.activeOrders();
      if (!current) {
        if (actives.length > 0) {
          this.selectOrderToTrack(actives[0]);
        }
      } else {
        const matched = this.allCustomerOrders().find(o => o.id === current.id || o.id === `ord-${current.id}` || (current.dailySequence && o.dailySequence === current.dailySequence));
        const effectiveStatus = matched?.status ?? current.status;
        if (effectiveStatus === 'completed' || effectiveStatus === 'cancelled') {
          const remainingActives = actives.filter(o => o.id !== current.id);
          if (remainingActives.length > 0) {
            this.selectOrderToTrack(remainingActives[0]);
          } else {
            this.clearTracker();
          }
        } else if (matched && matched.status !== current.status) {
          this.order.set(matched);
          this.applyOrderStatus(matched.status);
        }
      }
    });
  }

  ngOnInit(): void {
    const navState = history.state;
    if (navState && navState.order && navState.order.status !== 'completed' && navState.order.status !== 'cancelled') {
      this.order.set(navState.order);
      if (navState.stallName) this.stallName.set(navState.stallName);
      if (navState.stallEmoji) this.stallEmoji.set(navState.stallEmoji);
      this.applyOrderStatus(navState.order.status);
    }

    this.route.paramMap.subscribe(params => {
      const id = params.get('orderId');
      if (id) {
        this.orderId.set(id);
        const match = this.allCustomerOrders().find(o => o.id === id || String(o.dailySequence) === id || o.id === 'ord-' + id);
        if (match) {
          if (match.status !== 'completed' && match.status !== 'cancelled') {
            this.selectOrderToTrack(match);
          } else {
            this.searchedPastOrder.set(match);
            this.clearTracker();
          }
        } else {
          // Fetch live status from backend API
          this.orderNotificationService.fetchOrderLiveStatus(id).subscribe(backendOrder => {
            if (backendOrder) {
              const rawStatus = (backendOrder.order_status || backendOrder.status || '').toUpperCase();
              let mapped: OrderStatus = 'pending';
              if (rawStatus === 'READY') mapped = 'ready';
              else if (rawStatus === 'PREPARING' || rawStatus === 'ACCEPTED' || rawStatus === 'IN_PROGRESS' || rawStatus === 'COOKING') mapped = 'preparing';
              else if (rawStatus === 'COMPLETED' || rawStatus === 'COLLECTED') mapped = 'completed';
              else if (rawStatus === 'CANCELLED' || rawStatus === 'REJECTED') mapped = 'cancelled';

              const fetchedOrder: Order = {
                id: String(backendOrder.f_id || id),
                orderNumber: `HF-${String(id).padStart(3, '0')}`,
                dailySequence: Number(id) || 1,
                diningOption: 'dine_in',
                tableOrBuzzerNumber: 'Dine-In',
                items: [],
                subtotal: Number(backendOrder.f_total_price) || 0,
                takeawayFee: 0,
                tax: 0,
                discount: 0,
                total: Number(backendOrder.f_total_price) || 0,
                paymentMethod: 'paynow',
                paymentStatus: 'paid',
                status: mapped,
                createdAt: backendOrder.f_created_at || new Date().toISOString()
              };

              if (mapped !== 'completed' && mapped !== 'cancelled') {
                this.selectOrderToTrack(fetchedOrder);
              } else {
                this.searchedPastOrder.set(fetchedOrder);
                this.clearTracker();
              }
            }
          });
        }
      } else {
        // Navigated directly to /tracking without orderId parameter
        const actives = this.activeOrders();
        if (actives.length > 0) {
          this.selectOrderToTrack(actives[0]);
        } else {
          this.clearTracker();
        }
      }
    });

    // Real-time stream subscription
    this.eventSubscription = this.orderNotificationService.orderStatusChanges$.subscribe(event => {
      this.handleStatusEvent(event);
    });
  }

  ngOnDestroy(): void {
    if (this.eventSubscription) {
      this.eventSubscription.unsubscribe();
    }
  }

  formatOrderDate(isoDate?: string): string {
    if (!isoDate) return '';
    try {
      const d = new Date(isoDate);
      return d.toLocaleDateString('en-SG', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoDate;
    }
  }

  clearTracker(): void {
    this.order.set(null);
    this.orderId.set('');
  }

  clearLookup(): void {
    this.lookupQuery = '';
    this.lookupNotFound.set(false);
    this.searchedPastOrder.set(null);
  }

  selectOrderToTrack(ord: Order): void {
    if (ord.status === 'completed' || ord.status === 'cancelled') {
      this.clearTracker();
      this.searchedPastOrder.set(ord);
      return;
    }
    this.searchedPastOrder.set(null);
    this.orderId.set(ord.id);
    this.order.set(ord);
    this.applyOrderStatus(ord.status);
    this.lookupNotFound.set(false);
  }

  searchAndTrackOrder(): void {
    const q = this.lookupQuery.trim();
    if (!q) return;

    this.isSearching.set(true);
    const qLower = q.toLowerCase();

    // 1. Check local orders
    const match = this.allCustomerOrders().find(o =>
      o.id.toLowerCase() === qLower ||
      o.orderNumber.toLowerCase().includes(qLower) ||
      String(o.dailySequence) === qLower ||
      o.items.some(i => i.name.toLowerCase().includes(qLower))
    );

    if (match) {
      this.isSearching.set(false);
      if (match.status === 'completed' || match.status === 'cancelled') {
        this.searchedPastOrder.set(match);
        this.clearTracker();
        this.lookupNotFound.set(false);
      } else {
        this.searchedPastOrder.set(null);
        this.selectOrderToTrack(match);
      }
      return;
    }

    // 2. Fetch from backend API: GET /hawkerflow/v1/order/orders/{order_id}
    this.orderNotificationService.fetchOrderLiveStatus(q).subscribe({
      next: (backendOrder) => {
        this.isSearching.set(false);
        if (backendOrder && (backendOrder.order_id !== undefined || backendOrder.f_id !== undefined || backendOrder.id !== undefined)) {
          const rawStatus = (backendOrder.order_status || backendOrder.status || 'completed').toUpperCase();
          let mapped: OrderStatus = 'completed';
          if (rawStatus === 'READY') mapped = 'ready';
          else if (rawStatus === 'PREPARING' || rawStatus === 'ACCEPTED') mapped = 'preparing';
          else if (rawStatus === 'PENDING') mapped = 'pending';
          else if (rawStatus === 'CANCELLED' || rawStatus === 'REJECTED') mapped = 'cancelled';
          else mapped = 'completed';

          const orderIdNum = Number(backendOrder.order_id || backendOrder.f_id || backendOrder.id || parseInt(q.replace(/\D/g, ''), 10) || 1);
          const totalPrice = Number(backendOrder.total_price || backendOrder.f_total_price || backendOrder.order_price || 0);

          let items: any[] = [];
          if (Array.isArray(backendOrder.dishes)) {
            items = backendOrder.dishes.map((d: any, idx: number) => ({
              id: `item-${orderIdNum}-${d.dish_id || idx}`,
              menuItemId: String(d.dish_id || idx),
              numericDishId: Number(d.dish_id || idx),
              name: d.dish_name || `Dish #${d.dish_id || idx}`,
              basePrice: Number(d.price || d.order_price || 0),
              quantity: Number(d.quantity || 1),
              selectedModifiers: [],
              unitPriceWithModifiers: Number(d.price || d.order_price || 0),
              totalPrice: Number(d.price || d.order_price || 0)
            }));
          }

          const fetchedOrder: Order = {
            id: String(orderIdNum),
            orderNumber: `HF-${String(orderIdNum).padStart(3, '0')}`,
            dailySequence: orderIdNum,
            diningOption: 'dine_in',
            tableOrBuzzerNumber: 'Dine-In',
            items,
            subtotal: totalPrice,
            takeawayFee: 0,
            tax: 0,
            discount: 0,
            total: totalPrice,
            paymentMethod: 'paynow',
            paymentStatus: 'paid',
            status: mapped,
            createdAt: backendOrder.order_created_at || backendOrder.created_at || new Date().toISOString()
          };

          this.customerService.customerOrders.update(list => {
            const exists = list.some(o => o.id === fetchedOrder.id);
            return exists ? list : [fetchedOrder, ...list];
          });

          if (mapped === 'completed' || mapped === 'cancelled') {
            this.searchedPastOrder.set(fetchedOrder);
            this.clearTracker();
            this.lookupNotFound.set(false);
          } else {
            this.searchedPastOrder.set(null);
            this.selectOrderToTrack(fetchedOrder);
          }
        } else {
          this.searchedPastOrder.set(null);
          this.lookupNotFound.set(true);
        }
      },
      error: () => {
        this.isSearching.set(false);
        this.searchedPastOrder.set(null);
        this.lookupNotFound.set(true);
      }
    });
  }

  private handleStatusEvent(event: OrderStatusEvent): void {
    const currentId = this.orderId();
    const isMatching = currentId === String(event.orderId) ||
      currentId === 'ord-' + event.orderId ||
      this.order()?.dailySequence === Number(event.orderId);

    if (isMatching) {
      this.applyOrderStatus(event.status);
    }
  }

  private applyOrderStatus(status: OrderStatus): void {
    this.currentStatus.set(status);

    if (status === 'completed' || status === 'cancelled') {
      const currentId = this.orderId();
      this.clearTracker();
      const remainingActives = this.activeOrders().filter(o => o.id !== currentId);
      if (remainingActives.length > 0) {
        this.selectOrderToTrack(remainingActives[0]);
      }
      return;
    }

    if (status === 'pending') {
      this.stepLevel.set(1);
      this.estimatedMinutes.set(6);
    } else if (status === 'preparing') {
      this.stepLevel.set(2);
      this.estimatedMinutes.set(3);
    } else if (status === 'ready') {
      this.stepLevel.set(3);
      this.estimatedMinutes.set(0);
    }

    this.order.update(o => (o ? { ...o, status } : null));
  }

  readonly statusMessage = computed(() => {
    const status = this.currentStatus();
    if (status === 'pending') return '⏳ Order received by stall! Waiting for chef...';
    if (status === 'preparing') return '👨‍🍳 Wok is sizzling! Stall is cooking your dishes...';
    if (status === 'ready') return '🔥 Food is READY! Please collect at the stall counter.';
    if (status === 'completed') return '✅ Order Completed! Hope you enjoyed your meal! 🎉';
    return '❌ Order was cancelled.';
  });
}
