import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { CustomerService } from '../../core/services/customer.service';
import { OrderService } from '../../core/services/order.service';
import { StallAccount } from '../../core/models/auth.model';
import { Category, MenuItem } from '../../core/models/menu.model';
import { DiningOption, Order, OrderItem, PaymentMethod, SelectedModifier } from '../../core/models/order.model';
import { CustomerVoucher } from '../../core/models/customer.model';
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

  readonly appliedVoucher = this.customerService.appliedVoucher;
  readonly vouchers = this.customerService.vouchers;

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
    const stall = stalls.find(s => s.id === id) || stalls[0];
    this.currentStall.set(stall);

    // Load categories & items from stall or localStorage
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const storedCats = window.localStorage.getItem(`hawkerflow_categories_${stall.id}`);
        const storedItems = window.localStorage.getItem(`hawkerflow_menu_${stall.id}`);
        this.categories.set(storedCats ? JSON.parse(storedCats) : (stall.initialCategories || []));
        this.items.set(storedItems ? JSON.parse(storedItems) : (stall.initialMenuItems || []));
      } else {
        this.categories.set(stall.initialCategories || []);
        this.items.set(stall.initialMenuItems || []);
      }
    } catch (e) {
      this.categories.set(stall.initialCategories || []);
      this.items.set(stall.initialMenuItems || []);
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

    const orderId = 'ord-' + Date.now();
    const seq = Math.floor(100 + Math.random() * 900);
    const orderNumber = `HF-${seq}`;

    const newOrder: Order = {
      id: orderId,
      orderNumber,
      dailySequence: seq,
      diningOption: this.diningOption(),
      tableOrBuzzerNumber: this.diningOption() === 'dine_in' ? this.tableNumber : 'Takeaway Pickup',
      items: this.cart(),
      subtotal: this.rawSubtotal(),
      takeawayFee: this.takeawayFee(),
      tax: 0,
      discount: this.discountAmount(),
      total: this.grandTotal(),
      paymentMethod: event.method,
      paymentStatus: 'paid',
      cashTendered: event.cashTendered,
      paynowRef: event.paynowRef || 'PN-' + Math.floor(10000000 + Math.random() * 90000000),
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    // 1. Record in stall's KDS orders storage
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const stallOrdersKey = `hawkerflow_orders_${stall.id}`;
        const stored = window.localStorage.getItem(stallOrdersKey);
        const list: Order[] = stored ? JSON.parse(stored) : [];
        list.unshift(newOrder);
        window.localStorage.setItem(stallOrdersKey, JSON.stringify(list));
      }
    } catch (e) {}

    // 2. Record in Customer Service for loyalty points, stamp cards & order history
    this.customerService.recordCustomerOrder(newOrder, stall.id, stall.stallName, stall.emoji || '🍲');

    // 3. Navigate to live Order Status Tracker
    this.router.navigate(['/order-tracker', newOrder.id], {
      state: { order: newOrder, stallName: stall.stallName, stallEmoji: stall.emoji }
    });
  }
}
