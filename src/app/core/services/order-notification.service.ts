import { Injectable, inject, signal, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Subject, Observable, catchError, of } from 'rxjs';
import {
  OrderStatusEvent,
  OrderStatusToast
} from '../models/order-notification.model';
import { Order, OrderStatus } from '../models/order.model';
import { CustomerService } from './customer.service';
import { OrderService } from './order.service';
import { AudioService } from './audio.service';

export const SNS_ORDER_STATUS_TOPIC_ARN = 'arn:aws:sns:us-east-1:000000000000:order_status';
export const ORDER_BACKEND_API_BASE = 'http://localhost:8082/hawkerflow/v1/order/orders';
export const DEFAULT_ORDER_POLLING_INTERVAL_MS = 10000; // 10 seconds

@Injectable({
  providedIn: 'root'
})
export class OrderNotificationService implements OnDestroy {
  private http = inject(HttpClient);
  private customerService = inject(CustomerService);
  private orderService = inject(OrderService);
  private audioService = inject(AudioService);

  readonly latestStatusEvent = signal<OrderStatusEvent | null>(null);
  readonly activeToast = signal<OrderStatusToast | null>(null);
  readonly isPolling = signal<boolean>(false);

  private statusSubject = new Subject<OrderStatusEvent>();
  readonly orderStatusChanges$: Observable<OrderStatusEvent> = this.statusSubject.asObservable();

  private pollingInterval: any = null;
  private toastTimeout: any = null;

  constructor() {
    this.init();
  }

  init(): void {
    if (typeof window === 'undefined') return;
    this.startPolling();
  }

  ngOnDestroy(): void {
    this.stopPolling();
    if (this.toastTimeout) clearTimeout(this.toastTimeout);
  }

  /**
   * Starts periodic polling (default every 10 seconds) of active diner orders
   * from the backend Order Service (GET http://localhost:8082/hawkerflow/v1/order/orders/{order_id})
   */
  startPolling(intervalMs = DEFAULT_ORDER_POLLING_INTERVAL_MS): void {
    if (this.pollingInterval) return;
    this.isPolling.set(true);

    this.pollActiveOrders();
    this.pollingInterval = setInterval(() => {
      this.pollActiveOrders();
    }, intervalMs);
  }

  stopPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    this.isPolling.set(false);
  }

  /**
   * Queries GET http://localhost:8082/hawkerflow/v1/order/orders/{order_id} for all active diner orders
   */
  pollActiveOrders(): void {
    const activeOrders = this.customerService.activeCustomerOrders();
    if (!activeOrders || activeOrders.length === 0) return;

    for (const order of activeOrders) {
      const numericId = this.getNumericOrderId(order);
      if (numericId === null || numericId === undefined) continue;

      this.fetchOrderLiveStatus(numericId).subscribe((backendOrder) => {
        if (backendOrder) {
          this.processBackendOrder(backendOrder, order);
        }
      });
    }
  }

  /**
   * Directly fetch live order details from backend service:
   * GET http://localhost:8082/hawkerflow/v1/order/orders/{order_id}
   */
  fetchOrderLiveStatus(orderId: string | number): Observable<any> {
    const numericId = parseInt(String(orderId).replace(/\D/g, ''), 10) || orderId;
    return this.http.get<any>(`${ORDER_BACKEND_API_BASE}/${numericId}`).pipe(
      catchError(() => of(null))
    );
  }

  /**
   * Parses backend order response and triggers status updates if changed
   */
  processBackendOrder(backendOrder: any, localOrder?: Order): OrderStatusEvent | null {
    if (!backendOrder) return null;

    const orderId = backendOrder.order_id ?? backendOrder.id ?? localOrder?.id;
    if (orderId === undefined || orderId === null) return null;

    const rawStatus = (backendOrder.order_status ?? backendOrder.status ?? '').toString().toUpperCase();
    const stallId = backendOrder.stall_id ?? (backendOrder.orders && backendOrder.orders[0]?.stall_id) ?? localOrder?.numericStallId;

    return this.processOrderStatusUpdate(orderId, rawStatus, stallId);
  }

  private lastKnownStatusMap = new Map<string, OrderStatus>();

  /**
   * Processes a status update for an order, updates store and fires toasts/alerts
   * only when the order status has actually changed.
   */
  processOrderStatusUpdate(
    orderId: string | number,
    rawStatus: string,
    stallId?: number,
    eventType?: string
  ): OrderStatusEvent {
    const normalizedRaw = (rawStatus || '').toUpperCase();
    let mappedStatus: OrderStatus = 'pending';

    if (
      normalizedRaw === 'COMPLETED' ||
      normalizedRaw === 'COLLECTED' ||
      normalizedRaw.includes('COMPLETE') ||
      normalizedRaw.includes('COLLECT')
    ) {
      mappedStatus = 'completed';
    } else if (
      normalizedRaw === 'PREPARING' ||
      normalizedRaw === 'ACCEPTED' ||
      normalizedRaw === 'IN_PROGRESS' ||
      normalizedRaw === 'COOKING' ||
      normalizedRaw.includes('PREPAR') ||
      normalizedRaw.includes('ACCEPT')
    ) {
      mappedStatus = 'preparing';
    } else if (normalizedRaw === 'READY') {
      mappedStatus = 'ready';
    } else if (normalizedRaw === 'CANCELLED' || normalizedRaw === 'REJECTED') {
      mappedStatus = 'cancelled';
    }

    const orderIdKey = String(orderId);
    const existingOrder = this.customerService.customerOrders().find(
      o => o.id === orderIdKey || o.id === `ord-${orderIdKey}` || o.dailySequence === Number(orderId)
    );

    const prevStatus = this.lastKnownStatusMap.get(orderIdKey) || existingOrder?.status;
    const hasStatusChanged = !prevStatus || prevStatus !== mappedStatus;

    // Update map with current state
    this.lastKnownStatusMap.set(orderIdKey, mappedStatus);

    const resolvedEventType = eventType || (
      mappedStatus === 'ready'
        ? 'OrderReady'
        : (mappedStatus === 'completed'
          ? (normalizedRaw.includes('COLLECT') ? 'OrderCollected' : 'OrderCompleted')
          : (normalizedRaw.includes('ACCEPT') ? 'OrderAccepted' : 'OrderPreparing'))
    );

    const statusEvent: OrderStatusEvent = {
      orderId: String(orderId),
      stallId,
      status: mappedStatus,
      eventType: resolvedEventType,
      timestamp: new Date().toISOString()
    };

    // Only fire notifications, audio alerts, and state emissions if status actually changed
    if (hasStatusChanged) {
      this.latestStatusEvent.set(statusEvent);
      this.statusSubject.next(statusEvent);
      this.updateLocalOrderStores(statusEvent);
    }

    return statusEvent;
  }

  /**
   * Compatibility method for parsing JSON or SQS payloads if passed
   */
  processSqsMessage(rawBody: string): OrderStatusEvent | null {
    try {
      let eventPayload: any = null;
      try {
        const parsed = JSON.parse(rawBody);
        if (parsed.Type === 'Notification' && parsed.Message) {
          eventPayload = JSON.parse(parsed.Message);
        } else {
          eventPayload = parsed;
        }
      } catch {
        return null;
      }

      if (!eventPayload) return null;
      const data = eventPayload.data || eventPayload;
      const orderId = data.order_id ?? eventPayload.order_id;
      const rawStatus = (data.status ?? data.order_status ?? eventPayload.status ?? '').toString();
      const eventType = eventPayload.event_type;

      if (orderId === undefined || orderId === null) return null;
      return this.processOrderStatusUpdate(orderId, rawStatus, data.stall_id, eventType);
    } catch {
      return null;
    }
  }

  private getNumericOrderId(order: Order): number | string | null {
    if (order.dailySequence) return order.dailySequence;
    const num = parseInt(order.id.replace(/\D/g, ''), 10);
    if (!isNaN(num)) return num;
    return order.id;
  }

  private updateLocalOrderStores(event: OrderStatusEvent): void {
    const orderIdStr = String(event.orderId);

    // 1. Update CustomerService customerOrders
    this.customerService.updateOrderStatus(event.orderId, event.status);

    // 2. Update OrderService orders
    this.orderService.updateOrderStatus(orderIdStr, event.status);

    // 3. Audio notification & toast trigger
    if (event.status === 'ready') {
      this.audioService.playNewOrderAlert();
      this.showToastForOrder(event, '🔥 Your order is READY for collection!');
    } else if (event.status === 'preparing') {
      this.audioService.playButtonTap();
      const isAccepted = event.eventType.toLowerCase().includes('accept');
      const msg = isAccepted
        ? '👨‍🍳 Stall has ACCEPTED your order and started cooking!'
        : '👨‍🍳 Stall is preparing your order.';
      this.showToastForOrder(event, msg);
    } else if (event.status === 'completed') {
      this.audioService.playTicketBumped();
      this.showToastForOrder(event, '🎉 Order completed! Enjoy your meal.');
    }
  }

  private showToastForOrder(event: OrderStatusEvent, message: string): void {
    const matched = this.customerService.customerOrders().find(
      o => o.id === String(event.orderId) || o.dailySequence === Number(event.orderId)
    );

    const orderNumber = matched?.orderNumber || `HF-${String(event.orderId).padStart(3, '0')}`;
    const stallName = 'Hawker Stall';

    this.activeToast.set({
      orderId: String(event.orderId),
      orderNumber,
      stallName,
      stallEmoji: '🍲',
      status: event.status,
      message
    });

    if (this.toastTimeout) clearTimeout(this.toastTimeout);
    this.toastTimeout = setTimeout(() => {
      this.dismissToast();
    }, 7000);
  }

  dismissToast(): void {
    this.activeToast.set(null);
  }
}
