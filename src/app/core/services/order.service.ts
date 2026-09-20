import { Injectable, signal, computed, effect, inject } from '@angular/core';
import { DiningOption, Order, OrderItem, OrderStatus, PaymentMethod, SelectedModifier } from '../models/order.model';
import { MenuItem } from '../models/menu.model';
import { AudioService } from './audio.service';
import { SettingsService } from './settings.service';
import { AuthService } from './auth.service';
import { HawkerApiService } from './hawker-api.service';
import { BackendCreateOrderPayload, BackendDishOrder } from '../models/hawker-api.model';

@Injectable({
  providedIn: 'root'
})
export class OrderService {
  private audioService = inject(AudioService);
  private settingsService = inject(SettingsService);
  private authService = inject(AuthService);
  private hawkerApiService = inject(HawkerApiService);

  // Cart State
  readonly cartItems = signal<OrderItem[]>(this.loadCart());
  readonly diningOption = signal<DiningOption>('dine_in');
  readonly tableOrBuzzerNumber = signal<string>('');
  readonly orderNotes = signal<string>('');

  // Orders State
  readonly orders = signal<Order[]>(this.loadOrders());
  readonly lastBumpedOrder = signal<Order | null>(null);

  // Cart Computations
  readonly cartSubtotal = computed(() => {
    return this.cartItems().reduce((sum, item) => sum + item.totalPrice, 0);
  });

  readonly cartTakeawayFee = computed(() => {
    const settings = this.settingsService.settings();
    if (this.diningOption() === 'takeaway' && settings.enableTakeawayFee && this.cartItems().length > 0) {
      return settings.takeawayFeeAmount;
    }
    return 0;
  });

  readonly cartTax = computed(() => {
    const settings = this.settingsService.settings();
    if (settings.enableGst) {
      return (this.cartSubtotal() + this.cartTakeawayFee()) * settings.gstRate;
    }
    return 0;
  });

  readonly cartTotal = computed(() => {
    return Number((this.cartSubtotal() + this.cartTakeawayFee() + this.cartTax()).toFixed(2));
  });

  readonly cartItemCount = computed(() => {
    return this.cartItems().reduce((count, item) => count + item.quantity, 0);
  });

  // Orders Computations
  readonly activeOrders = computed(() => {
    return this.orders()
      .filter(o => o.status === 'pending' || o.status === 'preparing' || o.status === 'ready')
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  });

  readonly kdsPendingOrders = computed(() => {
    return this.orders().filter(o => o.status === 'pending');
  });

  readonly kdsPreparingOrders = computed(() => {
    return this.orders().filter(o => o.status === 'preparing');
  });

  readonly kdsReadyOrders = computed(() => {
    return this.orders().filter(o => o.status === 'ready');
  });

  readonly completedOrders = computed(() => {
    return this.orders()
      .filter(o => o.status === 'completed')
      .sort((a, b) => new Date(b.completedAt || b.createdAt).getTime() - new Date(a.completedAt || a.createdAt).getTime());
  });

  constructor() {
    // When stall changes, reload that stall's orders and cart
    effect(() => {
      const stall = this.authService.currentStall();
      if (stall) {
        this.orders.set(this.loadOrders());
        this.cartItems.set(this.loadCart());
        this.lastBumpedOrder.set(null);
      }
    });

    effect(() => {
      const stall = this.authService.currentStall();
      if (!stall) return;

      const ordersKey = `hawkerflow_orders_${stall.id}`;
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(ordersKey, JSON.stringify(this.orders()));
        }
      } catch (e) {
        // fallback
      }
    });

    effect(() => {
      const stall = this.authService.currentStall();
      if (!stall) return;

      const cartKey = `hawkerflow_cart_${stall.id}`;
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(cartKey, JSON.stringify(this.cartItems()));
        }
      } catch (e) {
        // fallback
      }
    });
  }

  private loadOrders(): Order[] {
    const stall = this.authService.currentStall();
    if (!stall) return [];

    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const stored = window.localStorage.getItem(`hawkerflow_orders_${stall.id}`);
        if (stored) return JSON.parse(stored);
      }
    } catch (e) {
      // fallback
    }

    return stall.initialOrders || [];
  }

  private loadCart(): OrderItem[] {
    const stall = this.authService.currentStall();
    if (!stall) return [];

    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const stored = window.localStorage.getItem(`hawkerflow_cart_${stall.id}`);
        if (stored) return JSON.parse(stored);
      }
    } catch (e) {
      // fallback
    }

    return [];
  }

  // Cart Operations
  addToCart(
    item: MenuItem,
    selectedModifiers: SelectedModifier[],
    quantity = 1,
    specialNotes = ''
  ): void {
    const modifierSum = selectedModifiers.reduce((acc, m) => acc + m.priceDelta, 0);
    const unitPrice = item.basePrice + modifierSum;
    const modifierKey = selectedModifiers.map(m => m.optionId).sort().join('_') + '_' + (specialNotes || '');

    const existingIndex = this.cartItems().findIndex(cartItem => {
      const cartModKey = cartItem.selectedModifiers.map(m => m.optionId).sort().join('_') + '_' + (cartItem.specialNotes || '');
      return cartItem.menuItemId === item.id && cartModKey === modifierKey;
    });

    if (existingIndex > -1) {
      this.cartItems.update(items => {
        const copy = [...items];
        const updated = { ...copy[existingIndex] };
        updated.quantity += quantity;
        updated.totalPrice = Number((updated.quantity * updated.unitPriceWithModifiers).toFixed(2));
        copy[existingIndex] = updated;
        return copy;
      });
    } else {
      const newItem: OrderItem = {
        id: 'cart-item-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
        menuItemId: item.id,
        name: item.name,
        chineseName: item.chineseName,
        basePrice: item.basePrice,
        quantity,
        selectedModifiers,
        unitPriceWithModifiers: unitPrice,
        totalPrice: Number((unitPrice * quantity).toFixed(2)),
        specialNotes
      };
      this.cartItems.update(items => [...items, newItem]);
    }
    this.audioService.playButtonTap();
  }

  updateQuantity(cartItemId: string, delta: number): void {
    this.cartItems.update(items => {
      return items
        .map(item => {
          if (item.id === cartItemId) {
            const newQty = item.quantity + delta;
            if (newQty <= 0) return null;
            return {
              ...item,
              quantity: newQty,
              totalPrice: Number((newQty * item.unitPriceWithModifiers).toFixed(2))
            };
          }
          return item;
        })
        .filter((item): item is OrderItem => item !== null);
    });
  }

  removeCartItem(cartItemId: string): void {
    this.cartItems.update(items => items.filter(item => item.id !== cartItemId));
    this.audioService.playButtonTap();
  }

  clearCart(): void {
    this.cartItems.set([]);
    this.tableOrBuzzerNumber.set('');
    this.orderNotes.set('');
  }

  setDiningOption(option: DiningOption): void {
    this.diningOption.set(option);
  }

  setTableOrBuzzerNumber(value: string): void {
    this.tableOrBuzzerNumber.set(value);
  }

  setOrderNotes(notes: string): void {
    this.orderNotes.set(notes);
  }

  // Order Submission & KDS Flow
  submitOrder(paymentMethod: PaymentMethod, cashTendered?: number, paynowRef?: string): Order {
    const currentOrders = this.orders();
    const nextSeq = currentOrders.length + 1;
    const orderNum = `HF-${String(nextSeq).padStart(3, '0')}`;

    const subtotal = this.cartSubtotal();
    const takeawayFee = this.cartTakeawayFee();
    const tax = this.cartTax();
    const total = this.cartTotal();

    let cashChange: number | undefined = undefined;
    if (paymentMethod === 'cash' && cashTendered) {
      cashChange = Math.max(0, Number((cashTendered - total).toFixed(2)));
    }

    const newOrder: Order = {
      id: 'ord-' + Date.now(),
      orderNumber: orderNum,
      dailySequence: nextSeq,
      diningOption: this.diningOption(),
      tableOrBuzzerNumber: this.tableOrBuzzerNumber() || (this.diningOption() === 'dine_in' ? 'Table Walk-in' : 'Takeaway Counter'),
      items: [...this.cartItems()],
      subtotal,
      takeawayFee,
      tax,
      discount: 0,
      total,
      paymentMethod,
      paymentStatus: 'paid',
      cashTendered,
      cashChange,
      paynowRef: paynowRef || (paymentMethod === 'paynow' ? 'PN-' + Math.floor(10000000 + Math.random() * 90000000) : undefined),
      status: 'pending',
      createdAt: new Date().toISOString(),
      orderNotes: this.orderNotes()
    };

    this.orders.update(list => [newOrder, ...list]);
    this.clearCart();

    // Audio & Feedback
    this.audioService.playCheckoutSuccess();
    setTimeout(() => {
      this.audioService.playNewOrderAlert();
    }, 500);

    return newOrder;
  }

  /**
   * Submits current cart directly to backend order service:
   * POST http://localhost:8082/hawkerflow/v1/order/orders
   */
  submitOrderToBackend(paymentMethod: PaymentMethod, cashTendered?: number, paynowRef?: string) {
    const stall = this.authService.currentStall();
    const stallNumericId = stall?.numericId ?? (stall ? parseInt(stall.id, 10) || 1 : 1);
    const dishes: BackendDishOrder[] = this.cartItems().map(item => ({
      dish_id: item.numericDishId ?? (parseInt(item.menuItemId, 10) || 1),
      quantity: item.quantity,
      price: Number(item.totalPrice.toFixed(2))
    }));

    const total = this.cartTotal();
    const payload: BackendCreateOrderPayload = {
      orders: [
        {
          stall_id: stallNumericId,
          dishes
        }
      ],
      total_price: total
    };

    return this.hawkerApiService.createOrder(payload);
  }

  updateOrderStatus(orderId: string, newStatus: OrderStatus): void {
    const now = new Date().toISOString();
    this.orders.update(list =>
      list.map(order => {
        if (order.id !== orderId) return order;
        const updated = { ...order, status: newStatus };
        if (newStatus === 'preparing' && !order.startedPrepAt) {
          updated.startedPrepAt = now;
        } else if (newStatus === 'ready' && !order.readyAt) {
          updated.readyAt = now;
        } else if (newStatus === 'completed' && !order.completedAt) {
          updated.completedAt = now;
          this.lastBumpedOrder.set(order);
        }
        return updated;
      })
    );

    if (newStatus === 'completed') {
      this.audioService.playTicketBumped();
    } else {
      this.audioService.playButtonTap();
    }
  }

  recallLastBumpedOrder(): void {
    const last = this.lastBumpedOrder();
    if (!last) return;

    this.orders.update(list =>
      list.map(order => {
        if (order.id === last.id) {
          return { ...order, status: 'ready', completedAt: undefined };
        }
        return order;
      })
    );
    this.lastBumpedOrder.set(null);
    this.audioService.playButtonTap();
  }

  cancelOrder(orderId: string, reason: string): void {
    this.orders.update(list =>
      list.map(order =>
        order.id === orderId
          ? { ...order, status: 'cancelled', paymentStatus: 'refunded', cancelledReason: reason }
          : order
      )
    );
    this.audioService.playButtonTap();
  }

  resetOrders(): void {
    const stall = this.authService.currentStall();
    this.orders.set(stall ? (stall.initialOrders || []) : []);
    this.lastBumpedOrder.set(null);
  }
}
