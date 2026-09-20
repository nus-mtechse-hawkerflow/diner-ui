export type OrderStatus = 'pending' | 'preparing' | 'ready' | 'completed' | 'cancelled';
export type PaymentMethod = 'cash' | 'paynow' | 'nets' | 'card';
export type PaymentStatus = 'pending' | 'paid' | 'refunded';
export type DiningOption = 'dine_in' | 'takeaway';

export interface SelectedModifier {
  groupId: string;
  groupName: string;
  optionId: string;
  optionName: string;
  priceDelta: number;
}

export interface OrderItem {
  id: string; // unique item instance id in cart
  menuItemId: string;
  numericDishId?: number;
  name: string;
  chineseName?: string;
  basePrice: number;
  quantity: number;
  selectedModifiers: SelectedModifier[];
  unitPriceWithModifiers: number;
  totalPrice: number;
  specialNotes?: string;
}

export interface Order {
  id: string;
  numericStallId?: number;
  orderNumber: string; // e.g. "HF-101"
  dailySequence: number;
  diningOption: DiningOption;
  tableOrBuzzerNumber?: string;
  items: OrderItem[];
  subtotal: number;
  takeawayFee: number;
  tax: number;
  discount: number;
  total: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  cashTendered?: number;
  cashChange?: number;
  paynowRef?: string;
  status: OrderStatus;
  createdAt: string; // ISO string
  startedPrepAt?: string;
  readyAt?: string;
  completedAt?: string;
  orderNotes?: string;
  cancelledReason?: string;
}
