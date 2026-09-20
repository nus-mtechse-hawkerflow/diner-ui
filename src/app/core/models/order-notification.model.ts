import { OrderStatus } from './order.model';

export interface OrderStatusEvent {
  orderId: number | string;
  stallId?: number;
  status: OrderStatus;
  eventType: string; // e.g. 'OrderReady', 'ORDER_UPDATED'
  timestamp: string;
}

export interface SnsMessageWrapper {
  Type: string;
  MessageId: string;
  TopicArn: string;
  Message: string; // JSON string
  Timestamp: string;
}

export interface SqsMessageItem {
  MessageId: string;
  ReceiptHandle: string;
  MD5OfBody: string;
  Body: string;
}

export interface SqsReceiveResponse {
  Messages?: SqsMessageItem[];
}

export interface OrderStatusToast {
  orderId: string;
  orderNumber: string;
  stallName: string;
  stallEmoji: string;
  status: OrderStatus;
  message: string;
}
