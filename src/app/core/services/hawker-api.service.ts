import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import {
  BackendCreateOrderPayload,
  BackendCreateOrderResponse,
  BackendCustomerRegisterPayload,
  BackendCheckAccountPayload,
  BackendCheckAccountResponse,
  BackendStallItem,
  BackendStallsResponse
} from '../models/hawker-api.model';
import { StallAccount } from '../models/auth.model';
import { Category, MenuItem } from '../models/menu.model';
import { StallSettings } from '../models/settings.model';

export const HAWKER_STALLS_API_URL = 'http://localhost:8080/hawkerflow/v1/hawker/stalls';
export const ORDER_SUBMIT_API_URL = 'http://localhost:8082/hawkerflow/v1/order/orders';
export const CUSTOMER_REGISTER_API_URL = 'http://localhost:8081/hawkerflow/v1/customer/register';
export const CUSTOMER_CHECK_ACCOUNT_API_URL = 'http://localhost:8081/hawkerflow/v1/customer/check_account_exist';

@Injectable({
  providedIn: 'root'
})
export class HawkerApiService {
  private http = inject(HttpClient);

  /**
   * Checks if an account already exists with the given phone number or email.
   * POST http://localhost:8081/hawkerflow/v1/customer/check_account_exist
   */
  checkAccountExists(payload: BackendCheckAccountPayload): Observable<BackendCheckAccountResponse | any> {
    return this.http.post<BackendCheckAccountResponse | any>(CUSTOMER_CHECK_ACCOUNT_API_URL, payload);
  }

  /**
   * Register customer in backend Customer Service.
   * POST http://localhost:8081/hawkerflow/v1/customer/register
   */
  registerCustomer(payload: BackendCustomerRegisterPayload): Observable<any> {
    return this.http.post<any>(CUSTOMER_REGISTER_API_URL, payload);
  }

  /**
   * Fetch all hawker stalls and their menu items from the backend.
   * GET http://localhost:8080/hawkerflow/v1/hawker/stalls
   */
  getStalls(): Observable<StallAccount[]> {
    return this.http.get<BackendStallsResponse>(HAWKER_STALLS_API_URL).pipe(
      map(response => this.mapStallsResponse(response))
    );
  }

  /**
   * Submit a new customer order to the backend order service.
   * POST http://localhost:8082/hawkerflow/v1/order/orders
   */
  createOrder(payload: BackendCreateOrderPayload): Observable<BackendCreateOrderResponse> {
    return this.http.post<BackendCreateOrderResponse>(ORDER_SUBMIT_API_URL, payload);
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
