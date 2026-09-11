import { Injectable, signal, computed, effect, inject } from '@angular/core';
import { Router } from '@angular/router';
import { StallAccount, UserSession } from '../models/auth.model';
import { PRESET_STALLS } from '../mock/initial-data';

const STALLS_STORAGE_KEY = 'hawkerflow_stalls_v1';
const SESSION_STORAGE_KEY = 'hawkerflow_session_v1';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private router = inject(Router);

  readonly allStalls = signal<StallAccount[]>(this.loadStalls());
  readonly currentSession = signal<UserSession | null>(this.loadSession());

  readonly isAuthenticated = computed(() => this.currentSession() !== null);

  readonly currentStall = computed<StallAccount>(() => {
    const session = this.currentSession();
    const stalls = this.allStalls();
    if (session) {
      const match = stalls.find(s => s.id === session.stallId);
      if (match) return match;
    }
    return stalls[0] || PRESET_STALLS[0];
  });

  constructor() {
    effect(() => {
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(STALLS_STORAGE_KEY, JSON.stringify(this.allStalls()));
          if (this.currentSession()) {
            window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(this.currentSession()));
          } else {
            window.localStorage.removeItem(SESSION_STORAGE_KEY);
          }
        }
      } catch (e) {
        // storage fallback
      }
    });
  }

  private loadStalls(): StallAccount[] {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const stored = window.localStorage.getItem(STALLS_STORAGE_KEY);
        if (stored) {
          const parsed: StallAccount[] = JSON.parse(stored);
          if (parsed && parsed.length > 0) return parsed;
        }
      }
    } catch (e) {
      // fallback
    }
    return PRESET_STALLS;
  }

  private loadSession(): UserSession | null {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const stored = window.localStorage.getItem(SESSION_STORAGE_KEY);
        if (stored) {
          return JSON.parse(stored);
        }
      }
    } catch (e) {
      // fallback
    }
    // Default to first preset stall session on initial load
    return {
      stallId: PRESET_STALLS[0].id,
      email: PRESET_STALLS[0].email,
      ownerName: PRESET_STALLS[0].ownerName,
      role: 'owner',
      loggedInAt: new Date().toISOString()
    };
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
