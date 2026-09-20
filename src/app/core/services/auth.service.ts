import { Injectable, signal, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { StallAccount, UserSession } from '../models/auth.model';
import { HawkerApiService } from './hawker-api.service';

const DEFAULT_EMPTY_STALL: StallAccount = {
  id: '',
  stallName: 'Hawker Stall',
  hawkerCentreName: 'Hawker Centre',
  unitNumber: '#01-01',
  uenNumber: '',
  contactNumber: '',
  ownerName: '',
  email: '',
  emoji: '🍲',
  cuisineCategory: 'Hawker Food',
  settings: {
    stallName: 'Hawker Stall',
    hawkerCentreName: 'Hawker Centre',
    unitNumber: '#01-01',
    uenNumber: '',
    contactNumber: '',
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
  },
  initialCategories: [],
  initialMenuItems: [],
  initialOrders: []
};

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private router = inject(Router);
  private hawkerApiService = inject(HawkerApiService);

  readonly allStalls = signal<StallAccount[]>([]);
  readonly currentSession = signal<UserSession | null>(null);
  readonly isLoadingStalls = signal<boolean>(false);

  readonly isAuthenticated = computed(() => this.currentSession() !== null);

  readonly currentStall = computed<StallAccount>(() => {
    const session = this.currentSession();
    const stalls = this.allStalls();
    if (session) {
      const match = stalls.find(s => s.id === session.stallId || String(s.numericId) === session.stallId);
      if (match) return match;
    }
    return stalls[0] || DEFAULT_EMPTY_STALL;
  });

  constructor() {
    this.loadStallsFromBackend();
  }

  /**
   * Loads hawker stalls dynamically from the backend API:
   * GET http://localhost:8080/hawkerflow/v1/hawker/stalls
   */
  loadStallsFromBackend(): void {
    this.isLoadingStalls.set(true);
    this.hawkerApiService.getStalls().subscribe({
      next: (stalls) => {
        this.isLoadingStalls.set(false);
        if (stalls && stalls.length > 0) {
          this.allStalls.set(stalls);
        }
      },
      error: (err) => {
        this.isLoadingStalls.set(false);
        console.warn('Backend stalls API currently unreachable, using fallback dataset:', err);
      }
    });
  }

  login(identifier: string, password?: string): { success: boolean; error?: string } {
    const term = identifier.trim().toLowerCase();
    const stalls = this.allStalls();
    const match = stalls.find(
      s =>
        s.email.toLowerCase() === term ||
        s.stallName.toLowerCase().includes(term) ||
        s.ownerName.toLowerCase().includes(term) ||
        s.unitNumber.toLowerCase() === term
    );

    if (!match) {
      return { success: false, error: 'No stall account found matching these credentials.' };
    }

    if (password && match.password && match.password !== password && password !== 'password123') {
      return { success: false, error: 'Incorrect password. (Demo password: password123)' };
    }

    const session: UserSession = {
      stallId: match.id,
      email: match.email,
      ownerName: match.ownerName,
      role: 'owner',
      loggedInAt: new Date().toISOString()
    };

    this.currentSession.set(session);
    this.router.navigate(['/pos']);
    return { success: true };
  }

  quickLogin(stallId: string): void {
    const match = this.allStalls().find(s => s.id === stallId);
    if (!match) return;

    const session: UserSession = {
      stallId: match.id,
      email: match.email,
      ownerName: match.ownerName,
      role: 'owner',
      loggedInAt: new Date().toISOString()
    };

    this.currentSession.set(session);
    this.router.navigate(['/pos']);
  }

  registerStall(newStall: Omit<StallAccount, 'id'>): StallAccount {
    const id = 'stall-' + Date.now();
    const fullAccount: StallAccount = {
      ...newStall,
      id,
      settings: {
        stallName: newStall.stallName,
        hawkerCentreName: newStall.hawkerCentreName,
        unitNumber: newStall.unitNumber,
        uenNumber: newStall.uenNumber || '2024' + Math.floor(10000 + Math.random() * 90000) + 'X',
        contactNumber: newStall.contactNumber || '+65 9123 0000',
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
      },
      initialCategories: [
        { id: 'all', name: 'All Items', chineseName: '全部', icon: 'utensils', displayOrder: 0 },
        { id: 'mains', name: 'Signatures', chineseName: '招牌', icon: 'flame', displayOrder: 1 },
        { id: 'drinks', name: 'Beverages', chineseName: '饮料', icon: 'coffee', displayOrder: 2 }
      ],
      initialMenuItems: [
        {
          id: 'dish-sample-1',
          name: newStall.stallName + ' Signature Special',
          chineseName: '招牌推荐',
          description: 'Chef recommendation fresh specialty.',
          categoryId: 'mains',
          basePrice: 6.00,
          emoji: newStall.emoji || '🍲',
          isAvailable: true,
          popularBadge: 'Signature',
          preparationTimeMins: 4
        }
      ],
      initialOrders: []
    };

    this.allStalls.update(list => [fullAccount, ...list]);
    this.quickLogin(fullAccount.id);
    return fullAccount;
  }

  updateCurrentStall(updates: Partial<StallAccount>): void {
    const current = this.currentStall();
    if (!current) return;

    this.allStalls.update(list =>
      list.map(s => (s.id === current.id ? { ...s, ...updates } : s))
    );
  }

  logout(): void {
    this.currentSession.set(null);
    this.router.navigate(['/login']);
  }
}
