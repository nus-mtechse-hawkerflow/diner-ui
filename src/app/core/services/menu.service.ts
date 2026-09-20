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
  }

  private loadCategories(): Category[] {
    const stall = this.authService.currentStall();
    if (!stall) return [];
    return stall.initialCategories || [];
  }

  private loadItems(): MenuItem[] {
    const stall = this.authService.currentStall();
    if (!stall) return [];
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
