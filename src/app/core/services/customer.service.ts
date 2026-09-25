import { Injectable, signal, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, of, tap, catchError, map, switchMap } from 'rxjs';
import { CustomerUser, CustomerVoucher, CustomerStampCard, CustomerTier } from '../models/customer.model';
import { Order, OrderItem, OrderStatus } from '../models/order.model';
import { CognitoService } from './cognito.service';
import { HawkerApiService } from './hawker-api.service';
import {
  BackendCustomerRegisterPayload,
  BackendCheckAccountPayload,
  BackendUpdateCustomerOrderPayload,
  BackendDishOrder,
  BackendStallOrder,
  BackendCustomerDetailResponse,
  BackendPastOrderDish,
  BackendPastOrdersWrapper
} from '../models/hawker-api.model';

@Injectable({
  providedIn: 'root'
})
export class CustomerService {
  private router = inject(Router);
  private cognitoService = inject(CognitoService);
  private hawkerApiService = inject(HawkerApiService);

  readonly currentCustomer = signal<CustomerUser | null>(null);
  readonly vouchers = signal<CustomerVoucher[]>([]);
  readonly stampCards = signal<CustomerStampCard[]>([]);
  readonly appliedVoucher = signal<CustomerVoucher | null>(null);
  readonly customerOrders = signal<Order[]>([]);
  readonly hasUnseenOrders = signal<boolean>(false);

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
      switchMap(res => {
        if (!res.success || !res.isSignedIn) {
          if (res.requiresMfa) {
            return of({
              success: true,
              requiresMfa: true,
              isSignedIn: false,
              nextStep: res.nextStep,
              codeDeliveryDetails: res.codeDeliveryDetails
            });
          }
          return of({
            success: false,
            isSignedIn: false,
            error: res.error || 'Login failed. Please check your username and password.'
          });
        }

        const custSub = res.userSub || res.user?.userId || res.user?.sub || term;

        const user: CustomerUser = {
          id: custSub,
          cognitoSub: custSub,
          cognitoUsername: term,
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

        // Fetch customer details from endpoint: /customer/user/{cust_sub}
        return this.hawkerApiService.getCustomerDetails(custSub).pipe(
          map(detail => {
            if (detail) {
              if (detail.cust_id || detail.customer_id) {
                user.id = detail.cust_id || detail.customer_id || user.id;
              }
              if (detail.cust_name || detail.customer_name) {
                user.name = detail.cust_name || detail.customer_name || user.name;
              }
              if (detail.last_login) {
                user.lastLogin = detail.last_login;
              }
              if (detail.email) {
                user.email = detail.email;
              }
              if (detail.phone_number) {
                user.phone = detail.phone_number;
              }
              if (detail.past_orders) {
                const mappedOrders = this.mapPastOrders(detail.past_orders);
                this.customerOrders.set(mappedOrders);
              }
            }
            this.currentCustomer.set(user);
            this.router.navigate(['/stalls']);
            return {
              success: true,
              requiresMfa: false,
              isSignedIn: true,
              user
            };
          }),
          catchError(() => {
            this.currentCustomer.set(user);
            this.router.navigate(['/stalls']);
            return of({
              success: true,
              requiresMfa: false,
              isSignedIn: true,
              user
            });
          })
        );
      }),
      catchError(err => {
        const errorMsg = err?.message || 'Login failed';
        return of({ success: false, isSignedIn: false, error: errorMsg });
      })
    );
  }

  confirmMfa(code: string, userDetails?: { identifier?: string; name?: string; sub?: string }): Observable<{
    success: boolean;
    isSignedIn?: boolean;
    user?: CustomerUser;
    error?: string;
  }> {
    return this.cognitoService.confirmSignIn(code).pipe(
      switchMap(res => {
        if (!res.success && res.error) {
          return of({ success: false, error: res.error });
        }

        if (res.isSignedIn) {
          const term = userDetails?.identifier || 'User';
          const custSub = res.userSub || res.user?.userId || userDetails?.sub || term;
          const user: CustomerUser = {
            id: custSub,
            cognitoSub: custSub,
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

          return this.hawkerApiService.getCustomerDetails(custSub).pipe(
            map(detail => {
              if (detail) {
                if (detail.cust_id || detail.customer_id) {
                  user.id = detail.cust_id || detail.customer_id || user.id;
                }
                if (detail.cust_name || detail.customer_name) {
                  user.name = detail.cust_name || detail.customer_name || user.name;
                }
                if (detail.last_login) {
                  user.lastLogin = detail.last_login;
                }
                if (detail.email) {
                  user.email = detail.email;
                }
                if (detail.phone_number) {
                  user.phone = detail.phone_number;
                }
                if (detail.past_orders) {
                  const mappedOrders = this.mapPastOrders(detail.past_orders);
                  this.customerOrders.set(mappedOrders);
                }
              }
              this.currentCustomer.set(user);
              this.router.navigate(['/stalls']);
              return { success: true, isSignedIn: true, user };
            }),
            catchError(() => {
              this.currentCustomer.set(user);
              this.router.navigate(['/stalls']);
              return of({ success: true, isSignedIn: true, user });
            })
          );
        }

        return of({ success: false, error: 'MFA Verification was not completed' });
      }),
      catchError(err => of({ success: false, error: err?.message || 'MFA confirmation failed' }))
    );
  }

  register(data: {
    name?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    phone: string;
    password?: string;
  }): Observable<{
    success: boolean;
    accountExists?: boolean;
    isSignedIn?: boolean;
    requiresMfa?: boolean;
    requiresConfirmation?: boolean;
    isSignUpComplete?: boolean;
    userSub?: string;
    customerSub?: string;
    username?: string;
    user?: CustomerUser;
    nextStep?: any;
    codeDeliveryDetails?: any;
    error?: string;
  }> {
    const rawPhone = data.phone.trim();
    const username = rawPhone;

    // Parse first name & last name
    let firstName = data.firstName?.trim() || '';
    let lastName = data.lastName?.trim() || '';
    if (!firstName && !lastName && data.name) {
      const parts = data.name.trim().split(/\s+/);
      firstName = parts[0] || 'Diner';
      lastName = parts.slice(1).join(' ') || 'User';
    } else if (!firstName) {
      firstName = 'Diner';
    } else if (!lastName) {
      lastName = 'User';
    }
    const fullName = `${firstName} ${lastName}`.trim();
    const email = data.email?.trim() || `${rawPhone.replace(/\D/g, '')}@example.com`;

    const newUser: CustomerUser = {
      id: 'cust-' + Date.now(),
      name: fullName,
      email: data.email?.trim() || undefined,
      phone: rawPhone,
      isGuest: false,
      loyaltyPoints: 0,
      tier: 'Bronze Kaki',
      avatarEmoji: '🥢',
      registeredAt: new Date().toISOString(),
      cognitoUsername: username
    };

    const checkPayload: BackendCheckAccountPayload = {
      phone_number: rawPhone,
      email
    };

    // 1. Check if account already exists before AWS Cognito signup
    return this.hawkerApiService.checkAccountExists(checkPayload).pipe(
      catchError((err) => {
        if (err?.error && typeof err.error.account_exist === 'boolean') {
          return of({ account_exist: err.error.account_exist });
        }
        return of({ account_exist: false });
      }),
      switchMap(checkRes => {
        const isExisting = this.isAccountExisting(checkRes);

        // 2. If account exists, prompt customer that account already exists and stop registration
        if (isExisting) {
          return of({
            success: false,
            accountExists: true,
            error: 'Account already exists. Please log in instead.'
          });
        }

        // 3. If account does not exist, proceed with AWS Cognito signUp
        return this.cognitoService.signUp({
          username,
          password: data.password,
          name: fullName,
          phone: rawPhone,
          email: data.email?.trim()
        }).pipe(
          switchMap(res => {
            const errLower = (res.error || '').toLowerCase();
            const isUserExists = res.isUsernameExists || errLower.includes('already exists') || errLower.includes('usernameexistsexception');

            if (isUserExists) {
              return of({
                success: false,
                accountExists: true,
                error: 'Account already exists. Please log in instead.'
              });
            }

            if (!res.success && res.error) {
              return of({ success: false, error: res.error });
            }

            const customerSub = res.userSub || newUser.cognitoSub || newUser.id;
            if (res.userSub) {
              newUser.id = res.userSub;
              newUser.cognitoSub = res.userSub;
            }

            if (res.isSignUpComplete) {
              // Forward customer details to Backend Customer Service (localhost:8081) only when registration completes, including customer sub
              const backendPayload: BackendCustomerRegisterPayload = {
                first_name: firstName,
                last_name: lastName,
                email,
                phone_number: rawPhone,
                customer_sub: customerSub,
                sub: customerSub
              };
              this.hawkerApiService.registerCustomer(backendPayload).pipe(
                catchError(() => of(null))
              ).subscribe();

              this.currentCustomer.set(newUser);
              this.router.navigate(['/stalls']);
              return of({
                success: true,
                requiresConfirmation: false,
                isSignUpComplete: true,
                userSub: customerSub,
                user: newUser
              });
            }

            // Confirmation code is required by AWS Cognito -> Do NOT call registerCustomer yet, wait for confirmRegistrationCode
            return of({
              success: true,
              requiresConfirmation: true,
              isSignUpComplete: false,
              userSub: customerSub,
              username,
              user: newUser,
              codeDeliveryDetails: res.codeDeliveryDetails
            });
          }),
          catchError(err => of({ success: false, error: err?.message || 'Registration failed' }))
        );
      })
    );
  }

  private isAccountExisting(res: any): boolean {
    if (res === null || res === undefined) return false;
    if (typeof res === 'boolean') return res;
    if (typeof res === 'object') {
      if (typeof res.account_exist === 'boolean') {
        return res.account_exist;
      }
      if (res.data && typeof res.data.account_exist === 'boolean') {
        return res.data.account_exist;
      }
      if (typeof res.account_exists === 'boolean') {
        return res.account_exists;
      }
      if (typeof res.exists === 'boolean') {
        return res.exists;
      }
      if (typeof res.is_account_exist === 'boolean') {
        return res.is_account_exist;
      }
      if (typeof res.is_exist === 'boolean') {
        return res.is_exist;
      }
      if (res.account_exist !== undefined) return Boolean(res.account_exist);
      if (res.account_exists !== undefined) return Boolean(res.account_exists);
      if (res.exists !== undefined) return Boolean(res.exists);
    }
    return false;
  }

  confirmRegistrationCode(
    username: string,
    code: string,
    userDetails?: { name?: string; firstName?: string; lastName?: string; phone?: string; email?: string; sub?: string; customer_sub?: string }
  ): Observable<{
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

        let firstName = userDetails?.firstName?.trim() || '';
        let lastName = userDetails?.lastName?.trim() || '';
        if (!firstName && !lastName && userDetails?.name) {
          const parts = userDetails.name.trim().split(/\s+/);
          firstName = parts[0] || 'Diner';
          lastName = parts.slice(1).join(' ') || 'User';
        } else if (!firstName) {
          firstName = 'Diner';
        } else if (!lastName) {
          lastName = 'User';
        }
        const fullName = `${firstName} ${lastName}`.trim();
        const rawPhone = userDetails?.phone || username;
        const email = userDetails?.email?.trim() || `${rawPhone.replace(/\D/g, '')}@example.com`;
        const customerSub = userDetails?.customer_sub || userDetails?.sub || 'sub-' + Date.now();

        // Forward to backend customer service if not sent already with string phone_number and customer_sub
        const backendPayload: BackendCustomerRegisterPayload = {
          first_name: firstName,
          last_name: lastName,
          email,
          phone_number: rawPhone,
          customer_sub: customerSub,
          sub: customerSub
        };
        this.hawkerApiService.registerCustomer(backendPayload).pipe(
          catchError(() => of(null))
        ).subscribe();

        const confirmedUser: CustomerUser = {
          id: customerSub,
          name: fullName,
          email: userDetails?.email,
          phone: rawPhone,
          isGuest: false,
          loyaltyPoints: 0,
          tier: 'Bronze Kaki',
          avatarEmoji: '🥢',
          registeredAt: new Date().toISOString(),
          cognitoUsername: username,
          cognitoSub: customerSub
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
    this.hasUnseenOrders.set(false);
    this.router.navigate(['/auth']);
  }

  clearCustomerOrders(): void {
    this.customerOrders.set([]);
    this.hasUnseenOrders.set(false);
  }

  markOrdersViewed(): void {
    this.hasUnseenOrders.set(false);
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
    this.hasUnseenOrders.set(true);

    // Send POST /v1/customer/user/update_order upon successful payment / order placement
    this.syncCustomerOrder(order, stallId);

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

  /**
   * Updates order status and synchronizes the change to backend Customer Service:
   * POST http://localhost:8081/hawkerflow/v1/customer/user/update_order
   */
  updateOrderStatus(orderId: string | number, status: OrderStatus): void {
    const idStr = String(orderId);
    const numId = Number(orderId);
    const now = new Date().toISOString();
    let updatedOrder: Order | null = null;

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
          updatedOrder = updated;
          return updated;
        }
        return o;
      })
    );

    // Send POST /v1/customer/user/update_order on order state change
    if (updatedOrder) {
      this.syncCustomerOrder(updatedOrder);
    } else {
      const fallbackOrder: Order = {
        id: idStr,
        orderNumber: `HF-${idStr.padStart(3, '0')}`,
        dailySequence: numId || 0,
        diningOption: 'dine_in',
        items: [],
        subtotal: 0,
        takeawayFee: 0,
        tax: 0,
        discount: 0,
        total: 0,
        paymentMethod: 'paynow',
        paymentStatus: 'paid',
        status,
        createdAt: now
      };
      this.syncCustomerOrder(fallbackOrder);
    }
  }

  /**
   * Sends POST http://localhost:8081/hawkerflow/v1/customer/user/update_order
   * with the exact requested payload structure:
   * {
   *   "order_id": 0,
   *   "cust_sub": "string",
   *   "orders": [
   *     {
   *       "stall_id": 0,
   *       "dishes": [
   *         {
   *           "dish_id": 0,
   *           "quantity": 0,
   *           "price": 0
   *         }
   *       ]
   *     }
   *   ],
   *   "total_price": 0,
   *   "status": "string"
   * }
   */
  syncCustomerOrder(order: Order, stallId?: string | number): void {
    const cust = this.currentCustomer();
    if (!cust || cust.isGuest || cust.id?.startsWith('guest') || cust.cognitoSub === 'guest') {
      return;
    }
    const custSub = cust.cognitoSub || cust.id;
    if (!custSub || custSub === 'guest' || custSub.startsWith('guest')) {
      return;
    }
    const numOrderId = Number(order.dailySequence ?? parseInt(String(order.id).replace(/\D/g, ''), 10) ?? 0) || 0;

    const parsedStallId = Number(
      order.numericStallId ??
      (stallId !== undefined && stallId !== null ? parseInt(String(stallId).replace(/\D/g, ''), 10) : 1) ??
      1
    ) || 1;

    let dishes: BackendDishOrder[] = [];
    if (order.items && order.items.length > 0) {
      dishes = order.items.map(item => ({
        dish_id: Number(item.numericDishId ?? parseInt(String(item.menuItemId).replace(/\D/g, ''), 10) ?? 1) || 1,
        dish_name: item.name,
        quantity: Number(item.quantity) || 1,
        price: Number(item.totalPrice ?? item.unitPriceWithModifiers ?? 0)
      }));
    } else {
      dishes = [
        {
          dish_id: 1,
          dish_name: '',
          quantity: 1,
          price: Number(order.total) || 0
        }
      ];
    }

    const payload: BackendUpdateCustomerOrderPayload = {
      order_id: numOrderId,
      cust_sub: custSub,
      orders: [
        {
          stall_id: parsedStallId,
          dishes
        }
      ],
      total_price: Number(order.total) || 0,
      status: order.status
    };

    this.hawkerApiService.updateCustomerOrder(payload).pipe(
      catchError(() => of(null))
    ).subscribe();
  }

  /**
   * Refreshes customer profile details and past orders from backend
   * GET /v1/customer/user/{cust_sub}
   */
  refreshCustomerDetails(): Observable<BackendCustomerDetailResponse | null> {
    const cust = this.currentCustomer();
    if (!cust || cust.isGuest || cust.id?.startsWith('guest') || cust.cognitoSub === 'guest') {
      return of(null);
    }
    const custSub = cust.cognitoSub || cust.id;
    if (!custSub || custSub.startsWith('guest')) return of(null);

    return this.hawkerApiService.getCustomerDetails(custSub).pipe(
      tap(detail => {
        if (detail) {
          let updated = false;
          if ((detail.cust_id || detail.customer_id) && cust.id !== (detail.cust_id || detail.customer_id)) {
            cust.id = detail.cust_id || detail.customer_id || cust.id;
            updated = true;
          }
          if ((detail.cust_name || detail.customer_name) && cust.name !== (detail.cust_name || detail.customer_name)) {
            cust.name = detail.cust_name || detail.customer_name || cust.name;
            updated = true;
          }
          if (detail.last_login && cust.lastLogin !== detail.last_login) {
            cust.lastLogin = detail.last_login;
            updated = true;
          }
          if (detail.email && cust.email !== detail.email) {
            cust.email = detail.email;
            updated = true;
          }
          if (detail.phone_number && cust.phone !== detail.phone_number) {
            cust.phone = detail.phone_number;
            updated = true;
          }
          if (updated) {
            this.currentCustomer.set({ ...cust });
          }

          if (detail.past_orders) {
            const mappedOrders = this.mapPastOrders(detail.past_orders);
            this.customerOrders.set(mappedOrders);
          }
        }
      }),
      catchError(() => of(null))
    );
  }

  /**
   * Groups dishes by order_id from backend past_orders response and maps them into Order objects
   */
  mapPastOrders(pastOrdersData: BackendPastOrdersWrapper | BackendPastOrderDish[] | any): Order[] {
    if (!pastOrdersData) return [];

    let rawDishes: BackendPastOrderDish[] = [];
    if (Array.isArray(pastOrdersData)) {
      rawDishes = pastOrdersData;
    } else if (pastOrdersData && Array.isArray(pastOrdersData.orders)) {
      rawDishes = pastOrdersData.orders;
    } else {
      return [];
    }

    if (rawDishes.length === 0) return [];

    // Group dishes by order_id
    const orderGroups = new Map<number, BackendPastOrderDish[]>();
    for (const dish of rawDishes) {
      const orderId = Number(dish.order_id) || 0;
      if (!orderGroups.has(orderId)) {
        orderGroups.set(orderId, []);
      }
      orderGroups.get(orderId)!.push(dish);
    }

    const mappedOrders: Order[] = [];

    for (const [orderId, dishes] of orderGroups.entries()) {
      const firstDish = dishes[0];
      const totalPrice = dishes.reduce((sum, d) => sum + (Number(d.order_price) || 0), 0);
      const status = this.normalizeOrderStatus(firstDish?.order_status);

      const items: OrderItem[] = dishes.map((d, idx) => {
        const dishId = d.dish_id;
        const qty = Number(d.quantity) || 1;
        const price = Number(d.order_price) || 0;
        const unitPrice = qty > 0 ? Number((price / qty).toFixed(2)) : price;

        return {
          id: `item-${orderId}-${dishId}-${idx}`,
          menuItemId: String(dishId),
          numericDishId: Number(dishId),
          name: d.dish_name || `Dish #${dishId}`,
          basePrice: unitPrice,
          quantity: qty,
          selectedModifiers: [],
          unitPriceWithModifiers: unitPrice,
          totalPrice: price
        };
      });

      const createdAt = firstDish.order_created_at || firstDish.created_at || new Date().toISOString();

      const order: Order = {
        id: String(orderId),
        orderNumber: `HF-${String(orderId).padStart(3, '0')}`,
        dailySequence: orderId,
        diningOption: 'dine_in',
        items,
        subtotal: Number(totalPrice.toFixed(2)),
        takeawayFee: 0,
        tax: 0,
        discount: 0,
        total: Number(totalPrice.toFixed(2)),
        paymentMethod: 'paynow',
        paymentStatus: 'paid',
        status,
        createdAt,
        ...(status === 'completed' ? { completedAt: createdAt } : {})
      };

      mappedOrders.push(order);
    }

    // Sort descending by order_id (latest order first)
    return mappedOrders.sort((a, b) => b.dailySequence - a.dailySequence);
  }

  private normalizeOrderStatus(statusStr?: string): OrderStatus {
    const s = (statusStr || '').toLowerCase().trim();
    if (s === 'completed' || s === 'collected') return 'completed';
    if (s === 'ready') return 'ready';
    if (s === 'preparing' || s === 'accepted' || s === 'cooking') return 'preparing';
    if (s === 'cancelled' || s === 'canceled') return 'cancelled';
    return 'pending';
  }
}

