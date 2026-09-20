import { Injectable, inject, signal, OnDestroy } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Subject, Observable, catchError, of } from 'rxjs';
import {
  OrderStatusEvent,
  OrderStatusToast,
  SnsMessageWrapper,
  SqsReceiveResponse
} from '../models/order-notification.model';
import { OrderStatus } from '../models/order.model';
import { CustomerService } from './customer.service';
import { OrderService } from './order.service';
import { AudioService } from './audio.service';

export const SNS_ORDER_STATUS_TOPIC_ARN = 'arn:aws:sns:us-east-1:000000000000:order_status';
export const LOCALSTACK_ENDPOINT = 'http://localhost:4566';
export const SQS_QUEUE_URL = 'http://localhost:4566/000000000000/diner_order_status_queue';
export const SQS_QUEUE_ARN = 'arn:aws:sqs:us-east-1:000000000000:diner_order_status_queue';
export const ORDER_BACKEND_API_BASE = 'http://localhost:8082/hawkerflow/v1/order/orders';

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
  private isSubscribed = false;

  constructor() {
    this.init();
  }

  init(): void {
    if (typeof window === 'undefined') return;
    this.ensureSqsSubscription();
    this.startPolling();
  }

  ngOnDestroy(): void {
    this.stopPolling();
    if (this.toastTimeout) clearTimeout(this.toastTimeout);
  }

  /**
   * Ensures the SQS queue exists on LocalStack and is subscribed to the SNS topic:
   * arn:aws:sns:us-east-1:000000000000:order_status
   */
  ensureSqsSubscription(): void {
    if (this.isSubscribed) return;

    const createHeaders = new HttpHeaders({
      'Content-Type': 'application/x-amz-json-1.0',
      'X-Amz-Target': 'AmazonSQS.CreateQueue'
    });

    this.http.post(
      LOCALSTACK_ENDPOINT + '/',
      { QueueName: 'diner_order_status_queue' },
      { headers: createHeaders }
    ).pipe(
      catchError(() => of(null))
    ).subscribe(() => {
      // Subscribe SQS queue to SNS topic
      const subHeaders = new HttpHeaders({
        'Content-Type': 'application/x-www-form-urlencoded'
      });
      const body = `Action=Subscribe&TopicArn=${encodeURIComponent(SNS_ORDER_STATUS_TOPIC_ARN)}&Protocol=sqs&Endpoint=${encodeURIComponent(SQS_QUEUE_ARN)}`;

      this.http.post(LOCALSTACK_ENDPOINT + '/', body, { headers: subHeaders, responseType: 'text' }).pipe(
        catchError(() => of(null))
      ).subscribe(() => {
        this.isSubscribed = true;
      });
    });
  }

  /**
   * Polls SQS for incoming order status events published by the SNS topic.
   */
  startPolling(intervalMs = 2000): void {
    if (this.pollingInterval) return;
    this.isPolling.set(true);

    this.pollSqsMessages();
    this.pollingInterval = setInterval(() => {
      this.pollSqsMessages();
    }, intervalMs);
  }

  stopPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    this.isPolling.set(false);
  }

  private pollSqsMessages(): void {
    const headers = new HttpHeaders({
      'Content-Type': 'application/x-amz-json-1.0',
      'X-Amz-Target': 'AmazonSQS.ReceiveMessage'
    });

    const payload = {
      QueueUrl: SQS_QUEUE_URL,
      MaxNumberOfMessages: 10,
      WaitTimeSeconds: 0
    };

    this.http.post<SqsReceiveResponse>(SQS_QUEUE_URL, payload, { headers }).pipe(
      catchError(() => of({ Messages: [] }))
    ).subscribe((response) => {
      if (response && response.Messages && response.Messages.length > 0) {
        response.Messages.forEach(msg => {
          this.processSqsMessage(msg.Body, msg.ReceiptHandle);
        });
      }
    });
  }

  /**
   * Processes a single message from SQS (which wraps an SNS notification).
   */
  processSqsMessage(rawBody: string, receiptHandle?: string): OrderStatusEvent | null {
    try {
      let snsWrapper: SnsMessageWrapper | null = null;
      let eventPayload: any = null;

      try {
        const parsed = JSON.parse(rawBody);
        if (parsed.Type === 'Notification' && parsed.Message) {
          snsWrapper = parsed;
          eventPayload = JSON.parse(parsed.Message);
        } else if (parsed.event_type || parsed.data || parsed.order_id) {
          eventPayload = parsed;
        }
      } catch (e) {
        return null;
      }

      if (!eventPayload) return null;

      const data = eventPayload.data || eventPayload;
      const orderId = data.order_id ?? eventPayload.order_id;
      const rawStatus = (data.status ?? data.order_status ?? eventPayload.status ?? 'READY').toString().toUpperCase();
      const eventType = eventPayload.event_type || 'OrderReady';

      if (orderId === undefined || orderId === null) return null;

      let mappedStatus: OrderStatus = 'pending';
      if (rawStatus === 'PREPARING' || rawStatus === 'ACCEPTED' || rawStatus === 'IN_PROGRESS' || rawStatus === 'COOKING') {
        mappedStatus = 'preparing';
      } else if (rawStatus === 'READY') {
        mappedStatus = 'ready';
      } else if (rawStatus === 'COMPLETED') {
        mappedStatus = 'completed';
      } else if (rawStatus === 'CANCELLED' || rawStatus === 'REJECTED') {
        mappedStatus = 'cancelled';
      }

      const statusEvent: OrderStatusEvent = {
        orderId: String(orderId),
        stallId: data.stall_id,
        status: mappedStatus,
        eventType,
        timestamp: snsWrapper?.Timestamp || new Date().toISOString()
      };

      // Emit event
      this.latestStatusEvent.set(statusEvent);
      this.statusSubject.next(statusEvent);

      // Apply updates to local stores
      this.updateLocalOrderStores(statusEvent);

      // Delete message from queue
      if (receiptHandle) {
        this.deleteSqsMessage(receiptHandle);
      }

      return statusEvent;
    } catch (err) {
      console.error('Error processing order status message:', err);
      return null;
    }
  }

  private deleteSqsMessage(receiptHandle: string): void {
    const headers = new HttpHeaders({
      'Content-Type': 'application/x-amz-json-1.0',
      'X-Amz-Target': 'AmazonSQS.DeleteMessage'
    });

    this.http.post(
      SQS_QUEUE_URL,
      { QueueUrl: SQS_QUEUE_URL, ReceiptHandle: receiptHandle },
      { headers }
    ).pipe(
      catchError(() => of(null))
    ).subscribe();
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

  /**
   * Directly fetch live order details from backend service:
   * GET http://localhost:8082/hawkerflow/v1/order/orders/{order_id}
   */
  fetchOrderLiveStatus(orderId: string | number): Observable<any> {
    const numericId = parseInt(String(orderId).replace(/\D/g, ''), 10) || orderId;
    return this.http.get<any>(`${ORDER_BACKEND_API_BASE}/${numericId}`).pipe(
      catchError(err => of(null))
    );
  }
}
