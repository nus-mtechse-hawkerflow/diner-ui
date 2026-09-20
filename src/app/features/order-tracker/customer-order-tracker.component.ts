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
  stepLevel = signal<number>(1); // 1 = Received, 2 = Cooking, 3 = Ready, 4 = Completed
  estimatedMinutes = signal<number>(6);
  currentStatus = signal<OrderStatus>('pending');

  lookupQuery = '';
  lookupNotFound = signal<boolean>(false);

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
      if (!current) {
        const actives = this.activeOrders();
        if (actives.length > 0) {
          this.selectOrderToTrack(actives[0]);
        } else {
          const all = this.allCustomerOrders();
          if (all.length > 0 && !this.orderId()) {
            this.selectOrderToTrack(all[0]);
          }
        }
      }
    });
  }

  ngOnInit(): void {
    const navState = history.state;
    if (navState && navState.order) {
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
          this.selectOrderToTrack(match);
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
              this.selectOrderToTrack(fetchedOrder);
            }
          });
        }
      } else {
        // Navigated directly to /tracking without orderId parameter
        const actives = this.activeOrders();
        if (actives.length > 0) {
          this.selectOrderToTrack(actives[0]);
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

  selectOrderToTrack(ord: Order): void {
    this.orderId.set(ord.id);
    this.order.set(ord);
    this.applyOrderStatus(ord.status);
    this.lookupNotFound.set(false);
  }

  searchAndTrackOrder(): void {
    const q = this.lookupQuery.trim().toLowerCase();
    if (!q) return;

    const match = this.allCustomerOrders().find(o =>
      o.id.toLowerCase() === q ||
      o.orderNumber.toLowerCase().includes(q) ||
      String(o.dailySequence) === q
    );

    if (match) {
      this.selectOrderToTrack(match);
      this.lookupNotFound.set(false);
    } else {
      // Try backend fetch
      this.orderNotificationService.fetchOrderLiveStatus(q).subscribe(backendOrder => {
        if (backendOrder) {
          const rawStatus = (backendOrder.order_status || backendOrder.status || '').toUpperCase();
          let mapped: OrderStatus = 'pending';
          if (rawStatus === 'READY') mapped = 'ready';
          else if (rawStatus === 'PREPARING' || rawStatus === 'ACCEPTED' || rawStatus === 'IN_PROGRESS' || rawStatus === 'COOKING') mapped = 'preparing';
          else if (rawStatus === 'COMPLETED' || rawStatus === 'COLLECTED') mapped = 'completed';
          else if (rawStatus === 'CANCELLED' || rawStatus === 'REJECTED') mapped = 'cancelled';

          const fetchedOrder: Order = {
            id: String(backendOrder.f_id || q),
            orderNumber: `HF-${String(q).padStart(3, '0')}`,
            dailySequence: Number(q) || 1,
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
          this.selectOrderToTrack(fetchedOrder);
          this.customerService.customerOrders.update(list => [fetchedOrder, ...list]);
          this.lookupNotFound.set(false);
        } else {
          this.lookupNotFound.set(true);
        }
      });
    }
  }

  markOrderCompleted(): void {
    const current = this.order();
    if (!current) return;

    this.customerService.updateOrderStatus(current.id, 'completed');
    this.orderService.updateOrderStatus(current.id, 'completed');
    this.applyOrderStatus('completed');
    this.audioService.playTicketBumped();
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

    if (status === 'pending') {
      this.stepLevel.set(1);
      this.estimatedMinutes.set(6);
    } else if (status === 'preparing') {
      this.stepLevel.set(2);
      this.estimatedMinutes.set(3);
    } else if (status === 'ready') {
      this.stepLevel.set(3);
      this.estimatedMinutes.set(0);
    } else if (status === 'completed') {
      this.stepLevel.set(4);
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
