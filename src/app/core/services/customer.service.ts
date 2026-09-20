import { Injectable, signal, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, of, tap, catchError, map } from 'rxjs';
import { CustomerUser, CustomerVoucher, CustomerStampCard, CustomerTier } from '../models/customer.model';
import { Order, OrderStatus } from '../models/order.model';
import { CognitoService } from './cognito.service';

@Injectable({
  providedIn: 'root'
})
export class CustomerService {
  private router = inject(Router);
  private cognitoService = inject(CognitoService);

  readonly currentCustomer = signal<CustomerUser | null>(null);
  readonly vouchers = signal<CustomerVoucher[]>([]);
  readonly stampCards = signal<CustomerStampCard[]>([]);
  readonly appliedVoucher = signal<CustomerVoucher | null>(null);
  readonly customerOrders = signal<Order[]>([]);

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

  readonly activeCustomerOrders = computed(() => {
    return this.customerOrders().filter(o => o.status === 'pending' || o.status === 'preparing' || o.status === 'ready');
  });

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

  login(identifier: string, password?: string): Observable<{
    success: boolean;
    requiresMfa?: boolean;
    isSignedIn?: boolean;
    nextStep?: any;
    codeDeliveryDetails?: any;
    user?: CustomerUser;
    error?: string;
  }> {
    const term = identifier.trim();
    if (!term) return of({ success: false, error: 'Identifier required' });

    return this.cognitoService.signIn(term, password).pipe(
      map(res => {
        if (!res.success && res.error) {
          return { success: false, error: res.error };
        }

        const user: CustomerUser = {
          id: res.user?.userId || 'cust-' + Date.now(),
          name: term.includes('@') ? term.split('@')[0] : 'Diner ' + term.slice(-4),
          email: term.includes('@') ? term : undefined,
          phone: !term.includes('@') ? term : undefined,
          isGuest: false,
          loyaltyPoints: 0,
          tier: 'Bronze Kaki',
          avatarEmoji: '🥢',
          registeredAt: new Date().toISOString(),
          accessToken: res.tokens?.accessToken,
          idToken: res.tokens?.idToken
        };

        if (res.isSignedIn) {
          this.currentCustomer.set(user);
          this.router.navigate(['/stalls']);
          return {
            success: true,
            requiresMfa: false,
            isSignedIn: true,
            user
          };
        }

        // MFA or additional challenge required
        return {
          success: true,
          requiresMfa: true,
          isSignedIn: false,
          nextStep: res.nextStep,
          codeDeliveryDetails: res.codeDeliveryDetails,
          user
        };
      }),
      catchError(err => {
        const errorMsg = err?.message || 'Login failed';
        return of({ success: false, error: errorMsg });
      })
    );
  }

  confirmMfa(code: string, userDetails?: { identifier?: string; name?: string }): Observable<{
    success: boolean;
    isSignedIn?: boolean;
    user?: CustomerUser;
    error?: string;
  }> {
    return this.cognitoService.confirmSignIn(code).pipe(
      map(res => {
        if (!res.success && res.error) {
          return { success: false, error: res.error };
        }

        if (res.isSignedIn) {
          const term = userDetails?.identifier || 'User';
          const user: CustomerUser = {
            id: res.user?.userId || 'cust-' + Date.now(),
            name: userDetails?.name || (term.includes('@') ? term.split('@')[0] : 'Diner ' + term.slice(-4)),
            email: term.includes('@') ? term : undefined,
            phone: !term.includes('@') ? term : undefined,
            isGuest: false,
            loyaltyPoints: 0,
            tier: 'Bronze Kaki',
            avatarEmoji: '🥢',
            registeredAt: new Date().toISOString(),
            accessToken: res.tokens?.accessToken,
            idToken: res.tokens?.idToken
          };
          this.currentCustomer.set(user);
          this.router.navigate(['/stalls']);
          return { success: true, isSignedIn: true, user };
        }

        return { success: false, error: 'MFA Verification was not completed' };
      }),
      catchError(err => of({ success: false, error: err?.message || 'MFA confirmation failed' }))
    );
  }

  register(data: { name: string; email?: string; phone: string; password?: string }): Observable<{
    success: boolean;
    requiresConfirmation?: boolean;
    isSignUpComplete?: boolean;
    username?: string;
    user?: CustomerUser;
    codeDeliveryDetails?: any;
    error?: string;
  }> {
    const username = data.phone.trim() || data.email?.trim() || data.name.trim().toLowerCase().replace(/\s+/g, '_');

    const newUser: CustomerUser = {
      id: 'cust-' + Date.now(),
      name: data.name.trim(),
      email: data.email?.trim() || undefined,
      phone: data.phone.trim(),
      isGuest: false,
      loyaltyPoints: 0,
      tier: 'Bronze Kaki',
      avatarEmoji: '🥢',
      registeredAt: new Date().toISOString(),
      cognitoUsername: username
    };

    return this.cognitoService.signUp({
      username,
      password: data.password,
      name: data.name.trim(),
      phone: data.phone.trim(),
      email: data.email?.trim()
    }).pipe(
      map(res => {
        if (!res.success && res.error) {
          return { success: false, error: res.error };
        }

        if (res.userSub) {
          newUser.id = res.userSub;
          newUser.cognitoSub = res.userSub;
        }

        if (res.isSignUpComplete) {
          this.currentCustomer.set(newUser);
          this.router.navigate(['/stalls']);
          return {
            success: true,
            requiresConfirmation: false,
            isSignUpComplete: true,
            user: newUser
          };
        }

        // Confirmation code is required by AWS Cognito
        return {
          success: true,
          requiresConfirmation: true,
          isSignUpComplete: false,
          username,
          user: newUser,
          codeDeliveryDetails: res.codeDeliveryDetails
        };
      }),
      catchError(err => of({ success: false, error: err?.message || 'Registration failed' }))
    );
  }

  confirmRegistrationCode(username: string, code: string, userDetails?: { name?: string; phone?: string; email?: string }): Observable<{
    success: boolean;
    isSignUpComplete?: boolean;
    user?: CustomerUser;
    error?: string;
  }> {
    return this.cognitoService.confirmSignUp(username, code).pipe(
      map(res => {
        if (!res.success && res.error) {
          return { success: false, error: res.error };
        }

        const confirmedUser: CustomerUser = {
          id: 'cust-' + Date.now(),
          name: userDetails?.name || 'Diner',
          email: userDetails?.email,
          phone: userDetails?.phone || username,
          isGuest: false,
          loyaltyPoints: 0,
          tier: 'Bronze Kaki',
          avatarEmoji: '🥢',
          registeredAt: new Date().toISOString(),
          cognitoUsername: username
        };
        this.currentCustomer.set(confirmedUser);
        this.router.navigate(['/stalls']);
        return { success: true, isSignUpComplete: true, user: confirmedUser };
      }),
      catchError(err => of({ success: false, error: err?.message || 'Confirmation code invalid' }))
    );
  }

  resendConfirmationCode(username: string): Observable<{ success: boolean; destination?: string; error?: string }> {
    return this.cognitoService.resendSignUpCode(username);
  }

  logout(): void {
    this.cognitoService.signOut().subscribe();
    this.currentCustomer.set(null);
    this.appliedVoucher.set(null);
    this.customerOrders.set([]);
    this.router.navigate(['/auth']);
  }

  clearCustomerOrders(): void {
    this.customerOrders.set([]);
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

  updateOrderStatus(orderId: string | number, status: OrderStatus): void {
    const idStr = String(orderId);
    const numId = Number(orderId);
    const now = new Date().toISOString();

    this.customerOrders.update(orders =>
      orders.map(o => {
        const isMatch = o.id === idStr || o.id === `ord-${idStr}` || (numId && o.dailySequence === numId);
        if (isMatch) {
          const updated: Order = { ...o, status };
          if (status === 'completed' && !o.completedAt) {
            updated.completedAt = now;
          } else if (status === 'ready' && !o.readyAt) {
            updated.readyAt = now;
          } else if (status === 'preparing' && !o.startedPrepAt) {
            updated.startedPrepAt = now;
          }
          return updated;
        }
        return o;
      })
    );
  }
}
