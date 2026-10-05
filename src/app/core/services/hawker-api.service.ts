import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, map, catchError, exhaustMap, first, switchMap, timeout, timer } from 'rxjs';
import {
  BackendCreateOrderPayload,
  BackendCreateOrderResponse,
  BackendQueuedOrderMessage,
  BackendQueuedOrderStatus,
  BackendCustomerRegisterPayload,
  BackendCheckAccountPayload,
  BackendCheckAccountResponse,
  BackendCustomerDetailResponse,
  BackendUpdateCustomerOrderPayload,
  BackendStallItem,
  BackendStallsResponse
} from '../models/hawker-api.model';
import { StallAccount } from '../models/auth.model';
import { Category, MenuItem } from '../models/menu.model';
import { StallSettings } from '../models/settings.model';
import { environment } from '../../../environments/environment';

export const HAWKER_STALLS_API_URL = environment.api.hawkerStallsUrl;
export const ORDER_SUBMIT_API_URL = environment.api.orderSubmitUrl;
export const ORDER_QUEUE_API_URL = environment.api.orderQueueUrl;
export const ORDER_QUEUE_POLL_INTERVAL_MS = 500;
export const ORDER_QUEUE_TIMEOUT_MS = 30000;
export const CUSTOMER_REGISTER_API_URL = environment.api.customerRegisterUrl;
export const CUSTOMER_CHECK_ACCOUNT_API_URL = environment.api.customerCheckAccountUrl;
export const CUSTOMER_USER_API_BASE_URL = environment.api.customerUserBaseUrl;
export const CUSTOMER_UPDATE_ORDER_API_URL = environment.api.customerUpdateOrderUrl;

@Injectable({
  providedIn: 'root'
})
export class HawkerApiService {
  private http = inject(HttpClient);

  /**
   * Update customer order status and details in backend Customer Service.
   * POST /customer/v1/customer/user/update_order
   */
  updateCustomerOrder(payload: BackendUpdateCustomerOrderPayload): Observable<any> {
    if (
      !payload.cust_sub ||
      payload.cust_sub === 'guest' ||
      payload.cust_sub.startsWith('guest') ||
      payload.cust_sub.startsWith('cust-guest')
    ) {
      return of(null);
    }
    return this.http.post<any>(CUSTOMER_UPDATE_ORDER_API_URL, payload);
  }

  /**
   * Get customer details by customer sub from backend Customer Service.
   * GET /customer/v1/customer/user/{cust_sub}
   */
  getCustomerDetails(custSub: string): Observable<BackendCustomerDetailResponse> {
    if (!custSub || custSub === 'guest' || custSub.startsWith('guest-') || custSub.startsWith('cust-guest')) {
      return of({} as BackendCustomerDetailResponse);
    }
    const url = `${CUSTOMER_USER_API_BASE_URL}/${encodeURIComponent(custSub)}`;
    return this.http.get<BackendCustomerDetailResponse>(url);
  }

  /**
   * Checks if an account already exists with the given phone number or email.
   * POST /customer/v1/customer/check_account_exist
   */
  checkAccountExists(payload: BackendCheckAccountPayload): Observable<BackendCheckAccountResponse | any> {
    return this.http.post<BackendCheckAccountResponse | any>(CUSTOMER_CHECK_ACCOUNT_API_URL, payload);
  }

  /**
   * Register customer in backend Customer Service.
   * POST /customer/v1/customer/register
   */
  registerCustomer(payload: BackendCustomerRegisterPayload): Observable<any> {
    return this.http.post<any>(CUSTOMER_REGISTER_API_URL, payload);
  }

  /**
   * Fetch all hawker stalls and their menu items from the backend.
   * GET /hawker/v1/hawker/stalls
   */
  getStalls(): Observable<StallAccount[]> {
    return this.http.get<BackendStallsResponse>(HAWKER_STALLS_API_URL).pipe(
      map(response => this.mapStallsResponse(response))
    );
  }

  /**
   * Submit a new customer order to the backend order service.
   * POST /order/v1/order/orders
   */
  createOrder(payload: BackendCreateOrderPayload): Observable<BackendCreateOrderResponse> {
    return this.http.post<BackendCreateOrderResponse>(ORDER_SUBMIT_API_URL, payload);
  }

  /**
   * Place a diner order on the order queue.
   * POST /order/v1/order/orders/queue is answered by API Gateway, which puts
   * the body on the queue as it is, so the order is sent in the shape the
   * order worker reads, under an order_ref chosen here. It goes as plain
   * text with no extra headers so the browser posts it without a preflight
   * request: a preflight reaches the order service, and would stop diners
   * ordering while that service is down. GET
   * .../orders/queue/{order_ref} is then polled until the worker has created
   * the order. Emits the same shape as createOrder.
   *
   * An order the queue refuses is reported as an error and never sent another
   * way: it may have been queued all the same, and a second send would create
   * it twice.
   */
  placeOrder(payload: BackendCreateOrderPayload): Observable<BackendCreateOrderResponse> {
    const message: BackendQueuedOrderMessage = {
      event_type: 'ORDER_PLACED',
      order_ref: crypto.randomUUID(),
      data: payload
    };

    // The receipt is SQS's own XML, which says nothing the app needs
    return this.http.post(ORDER_QUEUE_API_URL, JSON.stringify(message), {
      headers: { 'Content-Type': 'text/plain' },
      responseType: 'text'
    }).pipe(
      switchMap(() => this.awaitQueuedOrder(message.order_ref, payload.total_price))
    );
  }

  private awaitQueuedOrder(orderRef: string, totalPrice: number): Observable<BackendCreateOrderResponse> {
    const lookupUrl = `${ORDER_QUEUE_API_URL}/${encodeURIComponent(orderRef)}`;
    return timer(0, ORDER_QUEUE_POLL_INTERVAL_MS).pipe(
      // A failed look-up is retried on the next tick: the order is already queued.
      exhaustMap(() => this.http.get<BackendQueuedOrderStatus>(lookupUrl).pipe(
        catchError(() => of(null))
      )),
      first(status => status?.status === 'CREATED' && status.order_id !== undefined),
      map(status => ({
        message: 'Order submitted',
        order_id: status!.order_id!,
        total_price: totalPrice,
        order_status: 'PENDING',
        order_created_at: new Date().toISOString()
      })),
      timeout(ORDER_QUEUE_TIMEOUT_MS)
    );
  }

  /**
   * Transforms raw backend stalls response into the application's StallAccount structure.
   */
  private mapStallsResponse(response: BackendStallsResponse): StallAccount[] {
    if (!response || !response.stalls || !Array.isArray(response.stalls)) {
      return [];
    }

    return response.stalls.map((stall, index) => this.mapStallItem(stall, index));
  }

  private mapStallItem(stall: BackendStallItem, index: number): StallAccount {
    const rawStallId = stall.stall_menu?.[0]?.f_stall_id ??
      stall.stall_owner?.[0]?.f_stall_id ??
      (index + 1);

    const stallIdStr = String(rawStallId);
    const owner = stall.stall_owner?.[0];
    const ownerName = owner?.f_stall_owner_name || 'Hawker Chef';
    const contactNumber = owner?.f_stall_owner_phone || '+65 9123 4567';

    const stallEmoji = this.resolveStallEmoji(stall.stall_name, stall.stall_description);

    const initialCategories: Category[] = [
      { id: 'all', name: 'All Items', chineseName: '全部', icon: 'utensils', displayOrder: 0 },
      { id: 'mains', name: 'Signatures', chineseName: '招牌', icon: 'flame', displayOrder: 1 }
    ];

    const initialMenuItems: MenuItem[] = (stall.stall_menu || []).map(dish => ({
      id: String(dish.f_menu_id),
      numericDishId: dish.f_menu_id,
      name: dish.f_menu_name,
      chineseName: undefined,
      description: dish.f_menu_description || `${dish.f_menu_name} prepared fresh daily.`,
      categoryId: 'mains',
      basePrice: Number(dish.f_menu_price) || 0,
      emoji: this.resolveDishEmoji(dish.f_menu_name),
      isAvailable: true,
      popularBadge: 'Popular',
      preparationTimeMins: 3
    }));

    const settings: StallSettings = {
      stallName: stall.stall_name,
      hawkerCentreName: 'Hawker Centre',
      unitNumber: `#01-${String(rawStallId).padStart(2, '0')}`,
      uenNumber: `2024${String(rawStallId).padStart(5, '0')}X`,
      contactNumber,
      currencySymbol: 'SGD $',
      enableTakeawayFee: true,
      takeawayFeeAmount: 0.30,
      enableGst: false,
      gstRate: 0.09,
      isDarkTheme: false,
      soundAlertsEnabled: true,
      soundVolume: 0.8,
      kdsWarningThresholdMins: 5,
      kdsCriticalThresholdMins: 10
    };

    return {
      id: stallIdStr,
      numericId: rawStallId,
      stallName: stall.stall_name,
      hawkerCentreName: 'Hawker Centre',
      unitNumber: `#01-${String(rawStallId).padStart(2, '0')}`,
      uenNumber: `2024${String(rawStallId).padStart(5, '0')}X`,
      contactNumber,
      ownerName,
      email: `stall${rawStallId}@hawkerflow.sg`,
      password: 'password123',
      emoji: stallEmoji,
      cuisineCategory: stall.stall_description || 'Authentic Local Hawker Delights',
      settings,
      initialCategories,
      initialMenuItems,
      initialOrders: []
    };
  }

  private resolveStallEmoji(name: string, desc?: string): string {
    const text = `${name} ${desc || ''}`.toLowerCase();
    if (text.includes('nasi') || text.includes('lemak') || text.includes('rice') || text.includes('chicken')) {
      return '🍛';
    }
    if (text.includes('noodle') || text.includes('laksa') || text.includes('mee') || text.includes('soup')) {
      return '🍜';
    }
    if (text.includes('kopi') || text.includes('toast') || text.includes('tea') || text.includes('drink')) {
      return '☕';
    }
    if (text.includes('seafood') || text.includes('fish') || text.includes('stingray') || text.includes('bbq')) {
      return '🐟';
    }
    return '🍲';
  }

  private resolveDishEmoji(dishName: string): string {
    const text = dishName.toLowerCase();
    if (text.includes('nasi') || text.includes('rice')) return '🍛';
    if (text.includes('chicken')) return '🍗';
    if (text.includes('babi') || text.includes('pork') || text.includes('char siu')) return '🥩';
    if (text.includes('mee') || text.includes('noodle') || text.includes('laksa') || text.includes('soup')) return '🍜';
    if (text.includes('kopi') || text.includes('tea') || text.includes('drink')) return '☕';
    if (text.includes('stingray') || text.includes('fish') || text.includes('seafood')) return '🐟';
    if (text.includes('egg') || text.includes('toast')) return '🍞';
    return '🍲';
  }
}
