export interface ModifierOption {
  id: string;
  name: string;
  priceDelta: number; // in SGD
  isDefault?: boolean;
}

export interface ModifierGroup {
  id: string;
  name: string;
  required: boolean;
  minSelections?: number;
  maxSelections?: number; // 1 for single-choice (radio), >1 for multi-choice (checkbox)
  options: ModifierOption[];
}

export interface MenuItem {
  id: string;
  name: string;
  chineseName?: string;
  description: string;
  categoryId: string;
  basePrice: number; // in SGD
  imageUrl?: string;
  emoji?: string;
  isAvailable: boolean; // 86 toggle (true = in stock, false = 86'd / sold out)
  modifierGroups?: ModifierGroup[];
  popularBadge?: string;
  preparationTimeMins?: number;
}

export interface Category {
  id: string;
  name: string;
  chineseName?: string;
  icon?: string;
  displayOrder: number;
}
