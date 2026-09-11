import { Injectable, signal, computed, effect, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CustomerUser, CustomerVoucher, CustomerStampCard, CustomerTier } from '../models/customer.model';
import { Order } from '../models/order.model';

const CUSTOMER_SESSION_KEY = 'hawkerflow_customer_session_v1';
const CUSTOMER_VOUCHERS_KEY = 'hawkerflow_customer_vouchers_v1';
const CUSTOMER_STAMPS_KEY = 'hawkerflow_customer_stamps_v1';
const CUSTOMER_ORDERS_KEY = 'hawkerflow_customer_orders_v1';

export const INITIAL_PRESET_CUSTOMERS: CustomerUser[] = [
  {
    id: 'cust-uncle-tan',
    name: 'Uncle Tan (陈伯)',
    email: 'uncletan@hawkerkaki.sg',
    phone: '+65 9123 4567',
    isGuest: false,
    loyaltyPoints: 340,
    tier: 'Gold Kaki',
    avatarEmoji: '👴',
    registeredAt: '2025-01-15T08:30:00.000Z'
  },
  {
    id: 'cust-chloe-lim',
    name: 'Chloe Lim',
    email: 'chloe.lim@gmail.com',
    phone: '+65 9876 5432',
    isGuest: false,
    loyaltyPoints: 185,
    tier: 'Silver Kaki',
    avatarEmoji: '👩',
    registeredAt: '2025-06-20T12:00:00.000Z'
  }
];

export const INITIAL_VOUCHERS: CustomerVoucher[] = [
  {
    id: 'vouch-welcome-5',
    code: 'WELCOME5',
    title: '$5.00 Hawker Welcome Voucher',
    description: 'Enjoy $5 off on any hawker meal across all stalls. Min spend $10.',
    discountType: 'fixed',
    discountValue: 5.00,
    minSpend: 10.00,
    validUntil: '2026-12-31',
    isUsed: false,
    icon: 'sparkles'
  },
  {
    id: 'vouch-kopi-free',
    code: 'FREEKOPI',
    title: 'Free Traditional Kopi / Teh',
    description: 'Complimentary hot kopi or teh with any main dish order.',
    discountType: 'fixed',
    discountValue: 1.60,
    minSpend: 5.00,
    applicableStallId: 'stall-uncle-lim',
    validUntil: '2026-12-31',
    isUsed: false,
    icon: 'coffee'
  },
  {
    id: 'vouch-maxwell-10',
    code: 'MAXWELL10',
    title: '10% Maxwell Food Centre Discount',
    description: 'Get 10% off your total bill at Ah Huat Hainanese Delights.',
    discountType: 'percentage',
    discountValue: 10,
    minSpend: 8.00,
    applicableStallId: 'stall-ah-huat',
    validUntil: '2026-12-31',
    isUsed: false,
    icon: 'flame'
  },
  {
    id: 'vouch-seafood-3',
    code: 'SEAFOOD3',
    title: '$3.00 OFF Newton BBQ Seafood',
    description: 'Discount on Sambal Stingray & Grilled Seafood. Min spend $15.',
    discountType: 'fixed',
    discountValue: 3.00,
    minSpend: 15.00,
    applicableStallId: 'stall-newton-bbq',
    validUntil: '2026-12-31',
    isUsed: false,
    icon: 'soup'
  }
];

export const INITIAL_STAMP_CARDS: CustomerStampCard[] = [
  {
    id: 'stamp-ah-huat',
    stallId: 'stall-ah-huat',
    stallName: 'Ah Huat Hainanese Delights',
    stallEmoji: '🍗',
    currentStamps: 7,
    maxStamps: 10,
    rewardDescription: 'Free Chicken Rice Set (Worth $6.50)',
    claimedRewardsCount: 1
  },
  {
    id: 'stamp-uncle-lim',
    stallId: 'stall-uncle-lim',
    stallName: "Uncle Lim's Kopi & Toast",
    stallEmoji: '☕',
    currentStamps: 8,
    maxStamps: 10,
    rewardDescription: 'Free Traditional Kopi Set + Kaya Toast',
    claimedRewardsCount: 3
  },
  {
    id: 'stamp-airport-noodles',
    stallId: 'stall-old-airport',
    stallName: 'Old Airport Road Famous Noodles',
    stallEmoji: '🍜',
    currentStamps: 4,
    maxStamps: 10,
    rewardDescription: 'Free Signature Wonton Mee',
    claimedRewardsCount: 0
  }
];

@Injectable({
  providedIn: 'root'
})
export class CustomerService {
  private router = inject(Router);

  readonly currentCustomer = signal<CustomerUser | null>(this.loadCustomerSession());
  readonly vouchers = signal<CustomerVoucher[]>(this.loadVouchers());
  readonly stampCards = signal<CustomerStampCard[]>(this.loadStampCards());
  readonly appliedVoucher = signal<CustomerVoucher | null>(null);
  readonly customerOrders = signal<Order[]>(this.loadCustomerOrders());

  readonly isAuthenticated = computed(() => {
    const cust = this.currentCustomer();
    return cust !== null && !cust.isGuest;
  });

  readonly isGuest = computed(() => {
    const cust = this.currentCustomer();
    return cust !== null && cust.isGuest;
  });

  readonly activeVouchersCount = computed(() => {
    return this.vouchers().filter(v => !v.isUsed).length;
  });

  constructor() {
    effect(() => {
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          const cust = this.currentCustomer();
          if (cust) {
            window.localStorage.setItem(CUSTOMER_SESSION_KEY, JSON.stringify(cust));
          } else {
            window.localStorage.removeItem(CUSTOMER_SESSION_KEY);
          }
          window.localStorage.setItem(CUSTOMER_VOUCHERS_KEY, JSON.stringify(this.vouchers()));
          window.localStorage.setItem(CUSTOMER_STAMPS_KEY, JSON.stringify(this.stampCards()));
          window.localStorage.setItem(CUSTOMER_ORDERS_KEY, JSON.stringify(this.customerOrders()));
        }
      } catch (e) {
        // storage fallback
      }
    });
  }

  private loadCustomerSession(): CustomerUser | null {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const stored = window.localStorage.getItem(CUSTOMER_SESSION_KEY);
        if (stored) return JSON.parse(stored);
      }
    } catch (e) {}
    // Default to Uncle Tan demo session for immediate rich experience
    return INITIAL_PRESET_CUSTOMERS[0];
  }

  private loadVouchers(): CustomerVoucher[] {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const stored = window.localStorage.getItem(CUSTOMER_VOUCHERS_KEY);
        if (stored) return JSON.parse(stored);
      }
    } catch (e) {}
    return INITIAL_VOUCHERS;
  }

  private loadStampCards(): CustomerStampCard[] {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const stored = window.localStorage.getItem(CUSTOMER_STAMPS_KEY);
        if (stored) return JSON.parse(stored);
      }
    } catch (e) {}
    return INITIAL_STAMP_CARDS;
  }

  private loadCustomerOrders(): Order[] {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const stored = window.localStorage.getItem(CUSTOMER_ORDERS_KEY);
        if (stored) return JSON.parse(stored);
      }
    } catch (e) {}
    return [];
  }

  continueAsGuest(name?: string, phone?: string): CustomerUser {
    const guestUser: CustomerUser = {
      id: 'guest-' + Date.now(),
      name: name?.trim() || 'Guest Diner (散客)',
      phone: phone?.trim() || undefined,
      isGuest: true,
      loyaltyPoints: 0,
      tier: 'Bronze Kaki',
      avatarEmoji: '🥢',
      registeredAt: new Date().toISOString()
    };
    this.currentCustomer.set(guestUser);
    this.router.navigate(['/stalls']);
    return guestUser;
  }

  quickLoginPreset(customerId: string): void {
    const preset = INITIAL_PRESET_CUSTOMERS.find(c => c.id === customerId);
    if (preset) {
      this.currentCustomer.set(preset);
      this.router.navigate(['/stalls']);
    }
  }

  login(identifier: string): { success: boolean; error?: string } {
    const term = identifier.trim().toLowerCase();
    const match = INITIAL_PRESET_CUSTOMERS.find(
      c =>
        c.email?.toLowerCase() === term ||
        c.phone?.includes(term) ||
        c.name.toLowerCase().includes(term)
    );

    if (match) {
      this.currentCustomer.set(match);
      this.router.navigate(['/stalls']);
      return { success: true };
    }

    // If not in presets, create active session for this user
    const newUser: CustomerUser = {
      id: 'cust-' + Date.now(),
      name: identifier.split('@')[0],
      email: identifier.includes('@') ? identifier : undefined,
      phone: !identifier.includes('@') ? identifier : undefined,
      isGuest: false,
      loyaltyPoints: 50,
      tier: 'Bronze Kaki',
      avatarEmoji: '😋',
      registeredAt: new Date().toISOString()
    };
    this.currentCustomer.set(newUser);
    this.router.navigate(['/stalls']);
    return { success: true };
  }

  register(data: { name: string; email?: string; phone: string }): CustomerUser {
    const newUser: CustomerUser = {
      id: 'cust-' + Date.now(),
      name: data.name.trim(),
      email: data.email?.trim(),
      phone: data.phone.trim(),
      isGuest: false,
      loyaltyPoints: 100, // 100 Welcome Points!
      tier: 'Bronze Kaki',
      avatarEmoji: '🌟',
      registeredAt: new Date().toISOString()
    };

    // Add $5 Welcome voucher
    const welcomeVoucher: CustomerVoucher = {
      id: 'vouch-reg-' + Date.now(),
      code: 'WELCOME5',
      title: '$5.00 New Member Voucher',
      description: 'Welcome to HawkerFlow! $5 off any order above $10.',
      discountType: 'fixed',
      discountValue: 5.00,
      minSpend: 10.00,
      validUntil: '2026-12-31',
      isUsed: false,
      icon: 'sparkles'
    };

    this.vouchers.update(list => [welcomeVoucher, ...list]);
    this.currentCustomer.set(newUser);
    this.router.navigate(['/stalls']);
    return newUser;
  }

  logout(): void {
    this.currentCustomer.set(null);
    this.appliedVoucher.set(null);
    this.router.navigate(['/auth']);
  }

  applyVoucher(voucher: CustomerVoucher): void {
    this.appliedVoucher.set(voucher);
  }

  removeVoucher(): void {
    this.appliedVoucher.set(null);
  }

  recordCustomerOrder(order: Order, stallId: string, stallName: string, stallEmoji: string): void {
    // Save to customer's order history
    this.customerOrders.update(orders => [order, ...orders]);

    const cust = this.currentCustomer();
    if (!cust || cust.isGuest) return;

    // 1 Point per $1 spent
    const pointsEarned = Math.floor(order.total);
    const newTotalPoints = cust.loyaltyPoints + pointsEarned;
    
    // Tier calculation
    let newTier: CustomerTier = 'Bronze Kaki';
    if (newTotalPoints >= 300) newTier = 'Gold Kaki';
    else if (newTotalPoints >= 150) newTier = 'Silver Kaki';

    this.currentCustomer.set({
      ...cust,
      loyaltyPoints: newTotalPoints,
      tier: newTier
    });

    // Stamp Card progress (+1 stamp per order)
    this.stampCards.update(cards => {
      const existing = cards.find(c => c.stallId === stallId);
      if (existing) {
        const nextStamps = existing.currentStamps + 1;
        if (nextStamps >= existing.maxStamps) {
          // Card completed! Award voucher and reset stamps
          this.awardStampReward(existing);
          return cards.map(c =>
            c.id === existing.id
              ? { ...c, currentStamps: 0, claimedRewardsCount: c.claimedRewardsCount + 1 }
              : c
          );
        }
        return cards.map(c =>
          c.id === existing.id ? { ...c, currentStamps: nextStamps } : c
        );
      } else {
        // New stamp card
        const newCard: CustomerStampCard = {
          id: 'stamp-' + Date.now(),
          stallId,
          stallName,
          stallEmoji,
          currentStamps: 1,
          maxStamps: 10,
          rewardDescription: `Free Dish at ${stallName}`,
          claimedRewardsCount: 0
        };
        return [newCard, ...cards];
      }
    });

    // If a voucher was applied, mark it as used
    const applied = this.appliedVoucher();
    if (applied) {
      this.vouchers.update(vouchs =>
        vouchs.map(v => (v.id === applied.id ? { ...v, isUsed: true } : v))
      );
      this.appliedVoucher.set(null);
    }
  }

  private awardStampReward(card: CustomerStampCard): void {
    const rewardVoucher: CustomerVoucher = {
      id: 'vouch-reward-' + Date.now(),
      code: 'STAMPFREE',
      title: card.rewardDescription,
      description: `Completed 10 stamps at ${card.stallName}! Claim your free meal.`,
      discountType: 'fixed',
      discountValue: 6.00,
      minSpend: 0,
      applicableStallId: card.stallId,
      validUntil: '2026-12-31',
      isUsed: false,
      icon: 'sparkles'
    };
    this.vouchers.update(list => [rewardVoucher, ...list]);
  }

  redeemPointsForVoucher(pointsCost: number, voucherTitle: string, discountVal: number): boolean {
    const cust = this.currentCustomer();
    if (!cust || cust.loyaltyPoints < pointsCost) return false;

    this.currentCustomer.set({
      ...cust,
      loyaltyPoints: cust.loyaltyPoints - pointsCost
    });

    const newVoucher: CustomerVoucher = {
      id: 'vouch-redeem-' + Date.now(),
      code: 'POINTS' + Math.floor(100 + Math.random() * 900),
      title: voucherTitle,
      description: `Redeemed with ${pointsCost} HawkerKaki Points!`,
      discountType: 'fixed',
      discountValue: discountVal,
      minSpend: discountVal + 2,
      validUntil: '2026-12-31',
      isUsed: false,
      icon: 'sparkles'
    };

    this.vouchers.update(list => [newVoucher, ...list]);
    return true;
  }
}
