import { Injectable, signal, computed, effect, inject } from '@angular/core';
import { Category, MenuItem } from '../models/menu.model';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class MenuService {
  private authService = inject(AuthService);

  readonly categories = signal<Category[]>(this.loadCategories());
  readonly items = signal<MenuItem[]>(this.loadItems());
  readonly selectedCategoryId = signal<string>('all');
  readonly searchQuery = signal<string>('');

  readonly filteredItems = computed(() => {
    const catId = this.selectedCategoryId();
    const query = this.searchQuery().trim().toLowerCase();
    const allItems = this.items();

    return allItems.filter(item => {
      const matchesCategory = catId === 'all' || item.categoryId === catId;
      const matchesSearch = !query ||
        item.name.toLowerCase().includes(query) ||
        (item.chineseName && item.chineseName.toLowerCase().includes(query)) ||
        (item.description && item.description.toLowerCase().includes(query));
      return matchesCategory && matchesSearch;
    });
  });

  // Sold out count
  readonly soldOutCount = computed(() => {
    return this.items().filter(i => !i.isAvailable).length;
  });

  constructor() {
    // When stall changes, reload menu items and categories for that specific stall
    effect(() => {
      const stall = this.authService.currentStall();
      if (stall) {
        this.categories.set(this.loadCategories());
        this.items.set(this.loadItems());
        this.selectedCategoryId.set('all');
        this.searchQuery.set('');
      }
    });

    // Auto-save changes to localStorage scoped by current stall id
    effect(() => {
      const stall = this.authService.currentStall();
      if (!stall) return;

      const itemsKey = `hawkerflow_menu_${stall.id}`;
      const catKey = `hawkerflow_categories_${stall.id}`;

      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(itemsKey, JSON.stringify(this.items()));
          window.localStorage.setItem(catKey, JSON.stringify(this.categories()));
        }
      } catch (e) {
        // fallback
      }
    });
  }

  private loadCategories(): Category[] {
    const stall = this.authService.currentStall();
    if (!stall) return [];

    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const stored = window.localStorage.getItem(`hawkerflow_categories_${stall.id}`);
        if (stored) return JSON.parse(stored);
      }
    } catch (e) {
      // fallback
    }

    return stall.initialCategories || [
      { id: 'all', name: 'All Items', chineseName: '全部', icon: 'utensils', displayOrder: 0 },
      { id: 'mains', name: 'Signatures', chineseName: '招牌', icon: 'flame', displayOrder: 1 }
    ];
  }

  private loadItems(): MenuItem[] {
    const stall = this.authService.currentStall();
    if (!stall) return [];

    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const stored = window.localStorage.getItem(`hawkerflow_menu_${stall.id}`);
        if (stored) return JSON.parse(stored);
      }
    } catch (e) {
      // fallback
    }

    return stall.initialMenuItems || [];
  }

  selectCategory(id: string): void {
    this.selectedCategoryId.set(id);
  }

  setSearchQuery(q: string): void {
    this.searchQuery.set(q);
  }

  toggle86(itemId: string): void {
    this.items.update(list =>
      list.map(item =>
        item.id === itemId ? { ...item, isAvailable: !item.isAvailable } : item
      )
    );
  }

  setItemAvailability(itemId: string, isAvailable: boolean): void {
    this.items.update(list =>
      list.map(item =>
        item.id === itemId ? { ...item, isAvailable } : item
      )
    );
  }

  updateItem(itemId: string, updates: Partial<MenuItem>): void {
    this.items.update(list =>
      list.map(item =>
        item.id === itemId ? { ...item, ...updates } : item
      )
    );
  }

  addItem(newItem: MenuItem): void {
    this.items.update(list => [newItem, ...list]);
  }

  deleteItem(itemId: string): void {
    this.items.update(list => list.filter(item => item.id !== itemId));
  }

  resetToDefaultMenu(): void {
    const stall = this.authService.currentStall();
    if (!stall) return;

    this.items.set(stall.initialMenuItems || []);
    this.categories.set(stall.initialCategories || []);
  }
}
