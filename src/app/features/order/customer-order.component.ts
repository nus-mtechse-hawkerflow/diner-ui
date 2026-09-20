import { Component, inject, signal, computed, OnInit, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { CustomerService } from '../../core/services/customer.service';
import { OrderService } from '../../core/services/order.service';
import { HawkerApiService } from '../../core/services/hawker-api.service';
import { StallAccount } from '../../core/models/auth.model';
import { Category, MenuItem } from '../../core/models/menu.model';
import { DiningOption, Order, OrderItem, PaymentMethod, SelectedModifier } from '../../core/models/order.model';
import { CustomerVoucher } from '../../core/models/customer.model';
import { BackendCreateOrderPayload, BackendDishOrder } from '../../core/models/hawker-api.model';
import { ModifierModalComponent } from '../../shared/components/modifier-modal/modifier-modal.component';
import { PaymentModalComponent } from '../../shared/components/payment-modal/payment-modal.component';
import { IconComponent } from '../../shared/components/icon/icon.component';

@Component({
  selector: 'app-customer-order',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    ModifierModalComponent,
    PaymentModalComponent,
    IconComponent
  ],
  templateUrl: './customer-order.component.html'
})
export class CustomerOrderComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private authService = inject(AuthService);
  private customerService = inject(CustomerService);
  private orderService = inject(OrderService);
  private hawkerApiService = inject(HawkerApiService);

  stallId = signal<string>('');
  currentStall = signal<StallAccount | null>(null);

  categories = signal<Category[]>([]);
  items = signal<MenuItem[]>([]);
  selectedCategory = signal<string>('all');

  diningOption = signal<DiningOption>('dine_in');
  tableNumber = 'Table 04';

  cart = signal<OrderItem[]>([]);
  selectedItemForModifier = signal<MenuItem | null>(null);
  showVoucherDrawer = signal<boolean>(false);
  showCartModal = signal<boolean>(false);
  showPaymentModal = signal<boolean>(false);
  isSubmittingOrder = signal<boolean>(false);

  readonly appliedVoucher = this.customerService.appliedVoucher;
  readonly vouchers = this.customerService.vouchers;

  constructor() {
    // When stalls are loaded or updated from backend, refresh current stall info if active
    effect(() => {
      const id = this.stallId();
      if (id) {
        this.loadStallData(id);
      }
    });
  }

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      const id = params.get('stallId');
      if (id) {
        this.stallId.set(id);
        this.loadStallData(id);
      }
    });
  }

  loadStallData(id: string): void {
    const stalls = this.authService.allStalls();
    const stall = stalls.find(
      s => s.id === id || String(s.numericId) === id || s.id === `stall-${id}`
    ) || stalls[0];

    if (!stall) return;
    this.currentStall.set(stall);

    // If stall has initial categories & items directly from backend API
    if (stall.initialCategories && stall.initialCategories.length > 0) {
      this.categories.set(stall.initialCategories);
    }
    if (stall.initialMenuItems && stall.initialMenuItems.length > 0) {
      this.items.set(stall.initialMenuItems);
    }

    // Load from localStorage if present
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const storedCats = window.localStorage.getItem(`hawkerflow_categories_${stall.id}`);
        const storedItems = window.localStorage.getItem(`hawkerflow_menu_${stall.id}`);
        if (storedCats) this.categories.set(JSON.parse(storedCats));
        if (storedItems) this.items.set(JSON.parse(storedItems));
      }
    } catch (e) {
      // fallback
    }
  }

  readonly displayedItems = computed(() => {
    const cat = this.selectedCategory();
    const list = this.items();
    if (cat === 'all') return list;
    return list.filter(i => i.categoryId === cat);
  });

  openDishSelector(item: MenuItem): void {
    if (!item.isAvailable) return;
    if (item.modifierGroups && item.modifierGroups.length > 0) {
      this.selectedItemForModifier.set(item);
    } else {
      this.addSimpleItem(item);
    }
  }

  addSimpleItem(item: MenuItem): void {
    const orderItem: OrderItem = {
      id: 'cart-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
      menuItemId: item.id,
      numericDishId: item.numericDishId ?? (parseInt(item.id, 10) || undefined),
      name: item.name,
      chineseName: item.chineseName,
      basePrice: item.basePrice,
      quantity: 1,
      selectedModifiers: [],
      unitPriceWithModifiers: item.basePrice,
      totalPrice: item.basePrice
    };
    this.cart.update(list => [...list, orderItem]);
  }

  onAddCustomizedItem(event: {
    item: MenuItem;
    selectedModifiers: SelectedModifier[];
    quantity: number;
    specialNotes: string;
  }): void {
    const modTotal = event.selectedModifiers.reduce((sum, m) => sum + m.priceDelta, 0);
    const unitPrice = event.item.basePrice + modTotal;
    const orderItem: OrderItem = {
      id: 'cart-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
      menuItemId: event.item.id,
      numericDishId: event.item.numericDishId ?? (parseInt(event.item.id, 10) || undefined),
      name: event.item.name,
      chineseName: event.item.chineseName,
      basePrice: event.item.basePrice,
      quantity: event.quantity,
      selectedModifiers: event.selectedModifiers,
      unitPriceWithModifiers: unitPrice,
      totalPrice: unitPrice * event.quantity,
      specialNotes: event.specialNotes || undefined
    };
    this.cart.update(list => [...list, orderItem]);
  }

  updateQuantity(index: number, delta: number): void {
    this.cart.update(list => {
      const target = list[index];
      if (!target) return list;
      const newQty = target.quantity + delta;
      if (newQty <= 0) {
        return list.filter((_, i) => i !== index);
      }
      const updated = {
        ...target,
        quantity: newQty,
        totalPrice: target.unitPriceWithModifiers * newQty
      };
      return list.map((item, i) => (i === index ? updated : item));
    });
  }

  removeCartItem(index: number): void {
    this.cart.update(list => list.filter((_, i) => i !== index));
  }

  readonly totalItemsCount = computed(() => {
    return this.cart().reduce((sum, i) => sum + i.quantity, 0);
  });

  readonly rawSubtotal = computed(() => {
    return this.cart().reduce((sum, i) => sum + i.totalPrice, 0);
  });

  readonly takeawayFee = computed(() => {
    return this.diningOption() === 'takeaway' ? 0.30 : 0;
  });

  readonly discountAmount = computed(() => {
    const voucher = this.appliedVoucher();
    const subtotal = this.rawSubtotal();
    if (!voucher || subtotal === 0) return 0;

    if (voucher.minSpend && subtotal < voucher.minSpend) return 0;

    if (voucher.discountType === 'fixed') {
      return Math.min(voucher.discountValue, subtotal);
    }
    if (voucher.discountType === 'percentage') {
      return Number(((subtotal * voucher.discountValue) / 100).toFixed(2));
    }
    return 0;
  });

  readonly grandTotal = computed(() => {
    const sub = this.rawSubtotal();
    const take = this.takeawayFee();
    const disc = this.discountAmount();
    return Math.max(0, Number((sub + take - disc).toFixed(2)));
  });

  onSelectVoucher(vouch: CustomerVoucher): void {
    if (vouch.isUsed) return;
    this.customerService.applyVoucher(vouch);
    this.showVoucherDrawer.set(false);
  }

  removeVoucher(): void {
    this.customerService.removeVoucher();
  }

  onCustomerPaymentComplete(event: {
    method: PaymentMethod;
    cashTendered?: number;
    paynowRef?: string;
  }): void {
    this.showPaymentModal.set(false);
    this.showCartModal.set(false);

    const stall = this.currentStall();
    if (!stall) return;

    this.isSubmittingOrder.set(true);

    const stallNumericId = stall.numericId ?? (parseInt(stall.id, 10) || 1);
    const dishes: BackendDishOrder[] = this.cart().map(item => ({
      dish_id: item.numericDishId ?? (parseInt(item.menuItemId, 10) || 1),
      quantity: item.quantity,
      price: Number(item.totalPrice.toFixed(2))
    }));

    const grandTotal = this.grandTotal();
    const backendPayload: BackendCreateOrderPayload = {
      orders: [
        {
          stall_id: stallNumericId,
          dishes
        }
      ],
      total_price: grandTotal
    };

    // Call POST http://localhost:8082/hawkerflow/v1/order/orders
    this.hawkerApiService.createOrder(backendPayload).subscribe({
      next: (response) => {
        this.isSubmittingOrder.set(false);
        const orderId = String(response.order_id);
        const orderNumber = `HF-${String(response.order_id).padStart(3, '0')}`;

        const newOrder: Order = {
          id: orderId,
          numericStallId: stallNumericId,
          orderNumber,
          dailySequence: response.order_id,
          diningOption: this.diningOption(),
          tableOrBuzzerNumber: this.diningOption() === 'dine_in' ? this.tableNumber : 'Takeaway Pickup',
          items: [...this.cart()],
          subtotal: this.rawSubtotal(),
          takeawayFee: this.takeawayFee(),
          tax: 0,
          discount: this.discountAmount(),
          total: grandTotal,
          paymentMethod: event.method,
          paymentStatus: 'paid',
          cashTendered: event.cashTendered,
          paynowRef: event.paynowRef || 'PN-' + Math.floor(10000000 + Math.random() * 90000000),
          status: (response.order_status?.toLowerCase() as any) || 'pending',
          createdAt: response.order_created_at || new Date().toISOString()
        };

        this.finalizeOrderAndNavigate(newOrder, stall);
      },
      error: (err) => {
        this.isSubmittingOrder.set(false);
        console.warn('Backend order API currently unreachable, falling back to offline order:', err);

        // Fallback local order creation to prevent diner disruption
        const orderId = 'ord-' + Date.now();
        const seq = Math.floor(100 + Math.random() * 900);
        const orderNumber = `HF-${seq}`;

        const fallbackOrder: Order = {
          id: orderId,
          numericStallId: stallNumericId,
          orderNumber,
          dailySequence: seq,
          diningOption: this.diningOption(),
          tableOrBuzzerNumber: this.diningOption() === 'dine_in' ? this.tableNumber : 'Takeaway Pickup',
          items: [...this.cart()],
          subtotal: this.rawSubtotal(),
          takeawayFee: this.takeawayFee(),
          tax: 0,
          discount: this.discountAmount(),
          total: grandTotal,
          paymentMethod: event.method,
          paymentStatus: 'paid',
          cashTendered: event.cashTendered,
          paynowRef: event.paynowRef || 'PN-' + Math.floor(10000000 + Math.random() * 90000000),
          status: 'pending',
          createdAt: new Date().toISOString()
        };

        this.finalizeOrderAndNavigate(fallbackOrder, stall);
      }
    });
  }

  private finalizeOrderAndNavigate(order: Order, stall: StallAccount): void {
    // 1. Record in stall's KDS orders storage
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const stallOrdersKey = `hawkerflow_orders_${stall.id}`;
        const stored = window.localStorage.getItem(stallOrdersKey);
        const list: Order[] = stored ? JSON.parse(stored) : [];
        list.unshift(order);
        window.localStorage.setItem(stallOrdersKey, JSON.stringify(list));
      }
    } catch (e) {}

    // 2. Record in Customer Service for loyalty points, stamp cards & order history
    this.customerService.recordCustomerOrder(order, stall.id, stall.stallName, stall.emoji || '🍲');

    // 3. Clear cart
    this.cart.set([]);

    // 4. Navigate to live Order Status Tracker
    this.router.navigate(['/order-tracker', order.id], {
      state: { order, stallName: stall.stallName, stallEmoji: stall.emoji }
    });
  }
}
