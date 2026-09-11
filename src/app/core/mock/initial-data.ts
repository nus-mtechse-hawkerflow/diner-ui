import { Category, MenuItem } from '../models/menu.model';
import { Order } from '../models/order.model';
import { StallSettings } from '../models/settings.model';
import { StallAccount } from '../models/auth.model';

// --- Stall 1: Ah Huat Hainanese Delights ---
const AH_HUAT_CATEGORIES: Category[] = [
  { id: 'all', name: 'All Items', chineseName: '全部', icon: 'utensils', displayOrder: 0 },
  { id: 'mains', name: 'Signature Mains', chineseName: '招牌主食', icon: 'flame', displayOrder: 1 },
  { id: 'noodles', name: 'Noodles & Soups', chineseName: '面食汤类', icon: 'soup', displayOrder: 2 },
  { id: 'sides', name: 'Snacks & Sides', chineseName: '小吃配菜', icon: 'shopping-bag', displayOrder: 3 },
  { id: 'drinks', name: 'Kopi & Drinks', chineseName: '南洋饮料', icon: 'coffee', displayOrder: 4 },
  { id: 'desserts', name: 'Desserts', chineseName: '特色甜品', icon: 'sparkles', displayOrder: 5 }
];

const AH_HUAT_ITEMS: MenuItem[] = [
  {
    id: 'dish-1',
    name: 'Signature Hainanese Chicken Rice',
    chineseName: '招牌海南鸡饭',
    description: 'Fragrant jasmine rice steeped in chicken broth, tender poached chicken, and homemade chili & ginger sauce.',
    categoryId: 'mains',
    basePrice: 5.50,
    emoji: '🍗',
    isAvailable: true,
    popularBadge: 'Best Seller',
    preparationTimeMins: 3,
    modifierGroups: [
      {
        id: 'portion',
        name: 'Portion & Cut',
        required: true,
        maxSelections: 1,
        options: [
          { id: 'reg', name: 'Regular Breast/Thigh', priceDelta: 0, isDefault: true },
          { id: 'large', name: 'Large Meat (+50%)', priceDelta: 1.50 },
          { id: 'drumstick', name: 'Drumstick Cut', priceDelta: 2.50 }
        ]
      },
      {
        id: 'spice',
        name: 'Chili & Sauce',
        required: true,
        maxSelections: 1,
        options: [
          { id: 'chili-norm', name: 'Standard Chili & Ginger', priceDelta: 0, isDefault: true },
          { id: 'chili-extra', name: 'Extra Chili (Pedas)', priceDelta: 0 },
          { id: 'chili-none', name: 'No Chili / Soy Sauce Only', priceDelta: 0 }
        ]
      },
      {
        id: 'addons',
        name: 'Add-Ons',
        required: false,
        maxSelections: 4,
        options: [
          { id: 'addon-egg', name: 'Braised Lava Egg', priceDelta: 1.00 },
          { id: 'addon-tofu', name: 'Braised Tau Kwa (Tofu)', priceDelta: 1.00 },
          { id: 'addon-rice', name: 'Extra Fragrant Rice', priceDelta: 1.00 },
          { id: 'addon-gizzard', name: 'Chicken Gizzard / Liver', priceDelta: 1.50 }
        ]
      }
    ]
  },
  {
    id: 'dish-2',
    name: 'Supreme Singapore Laksa',
    chineseName: '老字号正宗叻沙',
    description: 'Rich coconut curry broth with thick bee hoon, fresh prawns, cockles, tau pok, and hard-boiled egg.',
    categoryId: 'noodles',
    basePrice: 6.00,
    emoji: '🍜',
    isAvailable: true,
    popularBadge: 'Must Try',
    preparationTimeMins: 4,
    modifierGroups: [
      {
        id: 'noodles',
        name: 'Noodle Choice',
        required: true,
        maxSelections: 1,
        options: [
          { id: 'thick-beehoon', name: 'Thick Bee Hoon', priceDelta: 0, isDefault: true },
          { id: 'yellow-noodles', name: 'Yellow Noodles', priceDelta: 0 },
          { id: 'mix-noodles', name: 'Mix (Bee Hoon + Yellow)', priceDelta: 0 }
        ]
      },
      {
        id: 'sambal',
        name: 'Sambal Chili Level',
        required: true,
        maxSelections: 1,
        options: [
          { id: 'sambal-normal', name: 'Normal Sambal', priceDelta: 0, isDefault: true },
          { id: 'sambal-more', name: 'Extra Sambal & Laksa Leaves', priceDelta: 0 },
          { id: 'sambal-less', name: 'Mild / Less Spicy', priceDelta: 0 }
        ]
      }
    ]
  },
  {
    id: 'dish-3',
    name: 'Wok-Hei Char Kway Teow',
    chineseName: '镬气鲜蛤炒粿条',
    description: 'Flat rice noodles stir-fried over high heat with lup cheong, fishcake, egg, and cockles.',
    categoryId: 'noodles',
    basePrice: 5.80,
    emoji: '🥢',
    isAvailable: true,
    preparationTimeMins: 5
  },
  {
    id: 'dish-8',
    name: 'Traditional Kopi-O',
    chineseName: '南洋古早味黑咖啡 (Kopi-O)',
    description: 'Robust caramelized robusta beans brewed through traditional cotton sock filter.',
    categoryId: 'drinks',
    basePrice: 1.60,
    emoji: '☕',
    isAvailable: true,
    preparationTimeMins: 1
  },
  {
    id: 'dish-11',
    name: 'Signature Nyonya Chendol',
    chineseName: '招牌娘惹煎蕊',
    description: 'Shaved ice infused with pure coconut milk, green pandan jelly, and Melaka palm sugar.',
    categoryId: 'desserts',
    basePrice: 3.80,
    emoji: '🍧',
    isAvailable: true,
    popularBadge: 'Popular Dessert',
    preparationTimeMins: 2
  }
];

const AH_HUAT_ORDERS: Order[] = [
  {
    id: 'ord-101',
    orderNumber: 'HF-101',
    dailySequence: 1,
    diningOption: 'dine_in',
    tableOrBuzzerNumber: 'Table 04',
    items: [
      {
        id: 'item-1',
        menuItemId: 'dish-1',
        name: 'Signature Hainanese Chicken Rice',
        chineseName: '招牌海南鸡饭',
        basePrice: 5.50,
        quantity: 2,
        selectedModifiers: [
          { groupId: 'portion', groupName: 'Portion & Cut', optionId: 'drumstick', optionName: 'Drumstick Cut', priceDelta: 2.50 }
        ],
        unitPriceWithModifiers: 8.00,
        totalPrice: 16.00,
        specialNotes: 'Less oily rice'
      }
    ],
    subtotal: 16.00,
    takeawayFee: 0,
    tax: 0,
    discount: 0,
    total: 16.00,
    paymentMethod: 'paynow',
    paymentStatus: 'paid',
    paynowRef: 'PN-88492019',
    status: 'completed',
    createdAt: new Date(Date.now() - 35 * 60 * 1000).toISOString(),
    completedAt: new Date(Date.now() - 25 * 60 * 1000).toISOString()
  },
  {
    id: 'ord-102',
    orderNumber: 'HF-102',
    dailySequence: 2,
    diningOption: 'takeaway',
    tableOrBuzzerNumber: 'Buzzer #08',
    items: [
      {
        id: 'item-3',
        menuItemId: 'dish-2',
        name: 'Supreme Singapore Laksa',
        chineseName: '老字号正宗叻沙',
        basePrice: 6.00,
        quantity: 1,
        selectedModifiers: [],
        unitPriceWithModifiers: 6.00,
        totalPrice: 6.00
      }
    ],
    subtotal: 6.00,
    takeawayFee: 0.30,
    tax: 0,
    discount: 0,
    total: 6.30,
    paymentMethod: 'cash',
    paymentStatus: 'paid',
    cashTendered: 10.00,
    cashChange: 3.70,
    status: 'ready',
    createdAt: new Date(Date.now() - 12 * 60 * 1000).toISOString()
  },
  {
    id: 'ord-103',
    orderNumber: 'HF-103',
    dailySequence: 3,
    diningOption: 'dine_in',
    tableOrBuzzerNumber: 'Table 12',
    items: [
      {
        id: 'item-5',
        menuItemId: 'dish-3',
        name: 'Wok-Hei Char Kway Teow',
        chineseName: '镬气鲜蛤炒粿条',
        basePrice: 5.80,
        quantity: 1,
        selectedModifiers: [],
        unitPriceWithModifiers: 5.80,
        totalPrice: 5.80
      }
    ],
    subtotal: 5.80,
    takeawayFee: 0,
    tax: 0,
    discount: 0,
    total: 5.80,
    paymentMethod: 'nets',
    paymentStatus: 'paid',
    status: 'preparing',
    createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString()
  }
];

// --- Stall 2: Uncle Lim's Traditional Kopi & Toast ---
const UNCLE_LIM_CATEGORIES: Category[] = [
  { id: 'all', name: 'All Items', chineseName: '全部', icon: 'utensils', displayOrder: 0 },
  { id: 'toast', name: 'Crispy Toast & Sets', chineseName: '南洋烤面包套餐', icon: 'flame', displayOrder: 1 },
  { id: 'kopi', name: 'Kopi & Tea Brews', chineseName: '现拉咖啡奶茶', icon: 'coffee', displayOrder: 2 },
  { id: 'breakfast', name: 'Local Breakfast', chineseName: '早市点心', icon: 'soup', displayOrder: 3 }
];

const UNCLE_LIM_ITEMS: MenuItem[] = [
  {
    id: 'lim-1',
    name: 'Traditional Kaya Butter Toast Set',
    chineseName: '传统咖椰牛油吐司套餐',
    description: 'Charcoal-grilled crispy toast with Hainanese coconut kaya and cold slab of butter, 2 soft-boiled eggs, and choice of hot drink.',
    categoryId: 'toast',
    basePrice: 5.20,
    emoji: '🍞',
    isAvailable: true,
    popularBadge: 'Signature Set',
    preparationTimeMins: 2,
    modifierGroups: [
      {
        id: 'bread',
        name: 'Bread Type',
        required: true,
        maxSelections: 1,
        options: [
          { id: 'white-crisp', name: 'White Thin Toast (Extra Crispy)', priceDelta: 0, isDefault: true },
          { id: 'brown-bread', name: 'Wholemeal Brown Bread', priceDelta: 0.30 },
          { id: 'steamed-bun', name: 'Steamed Fluffy Kaya Bun', priceDelta: 0.50 }
        ]
      },
      {
        id: 'drink-choice',
        name: 'Set Drink',
        required: true,
        maxSelections: 1,
        options: [
          { id: 'kopi-hot', name: 'Hot Kopi', priceDelta: 0, isDefault: true },
          { id: 'kopi-o-hot', name: 'Hot Kopi-O (No Milk)', priceDelta: 0 },
          { id: 'teh-hot', name: 'Hot Teh (Milk Tea)', priceDelta: 0 },
          { id: 'iced-kopi', name: 'Iced Kopi Peng', priceDelta: 0.60 }
        ]
      }
    ]
  },
  {
    id: 'lim-2',
    name: 'Kampung Soft-Boiled Eggs (2 pcs)',
    chineseName: '生熟半熟土鸡蛋 (两粒)',
    description: 'Fresh free-range eggs cooked with creamy molten yolks, served with dark soy sauce and white pepper.',
    categoryId: 'breakfast',
    basePrice: 1.80,
    emoji: '🥚',
    isAvailable: true,
    preparationTimeMins: 1
  },
  {
    id: 'lim-3',
    name: 'Nanyang Kopi Gu You (Butter Coffee)',
    chineseName: '南洋牛油咖啡 (Kopi Gu You)',
    description: 'Aromatic dark roast coffee with a melting slice of salted golden butter for a rich caramel flavor.',
    categoryId: 'kopi',
    basePrice: 2.20,
    emoji: '🧈',
    isAvailable: true,
    popularBadge: 'Heritage Special',
    preparationTimeMins: 1
  },
  {
    id: 'lim-4',
    name: 'Milo Dinosaur (Gao)',
    chineseName: '美禄恐龙 (浓郁可可冰)',
    description: 'Iced rich malt chocolate topped with a mountain of un-dissolved Milo powder.',
    categoryId: 'kopi',
    basePrice: 3.20,
    emoji: '🍫',
    isAvailable: true,
    preparationTimeMins: 1
  },
  {
    id: 'lim-5',
    name: 'Hong Kong Style Chee Cheong Fun',
    chineseName: '港式手工猪肠粉',
    description: 'Silky steamed rice noodle rolls drenched in savory sweet soy dressing, sesame seeds, and chili sambal.',
    categoryId: 'breakfast',
    basePrice: 3.50,
    emoji: '🥢',
    isAvailable: true,
    preparationTimeMins: 2
  }
];

const UNCLE_LIM_ORDERS: Order[] = [
  {
    id: 'lim-ord-1',
    orderNumber: 'UL-001',
    dailySequence: 1,
    diningOption: 'dine_in',
    tableOrBuzzerNumber: 'Table 02',
    items: [
      {
        id: 'item-lim-1',
        menuItemId: 'lim-1',
        name: 'Traditional Kaya Butter Toast Set',
        chineseName: '传统咖椰牛油吐司套餐',
        basePrice: 5.20,
        quantity: 2,
        selectedModifiers: [
          { groupId: 'bread', groupName: 'Bread Type', optionId: 'white-crisp', optionName: 'White Thin Toast', priceDelta: 0 },
          { groupId: 'drink-choice', groupName: 'Set Drink', optionId: 'kopi-hot', optionName: 'Hot Kopi', priceDelta: 0 }
        ],
        unitPriceWithModifiers: 5.20,
        totalPrice: 10.40
      }
    ],
    subtotal: 10.40,
    takeawayFee: 0,
    tax: 0,
    discount: 0,
    total: 10.40,
    paymentMethod: 'paynow',
    paymentStatus: 'paid',
    paynowRef: 'PN-11029482',
    status: 'completed',
    createdAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
    completedAt: new Date(Date.now() - 15 * 60 * 1000).toISOString()
  },
  {
    id: 'lim-ord-2',
    orderNumber: 'UL-002',
    dailySequence: 2,
    diningOption: 'takeaway',
    tableOrBuzzerNumber: 'Counter 1',
    items: [
      {
        id: 'item-lim-2',
        menuItemId: 'lim-4',
        name: 'Milo Dinosaur (Gao)',
        chineseName: '美禄恐龙',
        basePrice: 3.20,
        quantity: 1,
        selectedModifiers: [],
        unitPriceWithModifiers: 3.20,
        totalPrice: 3.20
      }
    ],
    subtotal: 3.20,
    takeawayFee: 0.30,
    tax: 0,
    discount: 0,
    total: 3.50,
    paymentMethod: 'cash',
    paymentStatus: 'paid',
    cashTendered: 5.00,
    cashChange: 1.50,
    status: 'pending',
    createdAt: new Date(Date.now() - 2 * 60 * 1000).toISOString()
  }
];

// --- Stall 3: Old Airport Road Famous Noodles ---
const OLD_AIRPORT_CATEGORIES: Category[] = [
  { id: 'all', name: 'All Items', chineseName: '全部', icon: 'utensils', displayOrder: 0 },
  { id: 'wonton', name: 'Wonton & Dumplings', chineseName: '云吞水饺面', icon: 'soup', displayOrder: 1 },
  { id: 'prawn', name: 'Prawn Noodles', chineseName: '浓郁虾面', icon: 'flame', displayOrder: 2 },
  { id: 'sides', name: 'Sides & Bites', chineseName: '小吃炸物', icon: 'shopping-bag', displayOrder: 3 }
];

const OLD_AIRPORT_ITEMS: MenuItem[] = [
  {
    id: 'oar-1',
    name: 'Signature Springy Wonton Mee',
    chineseName: '招牌爽口云吞面 (干捞/汤)',
    description: 'Q-texture handmade egg noodles tossed in lard oil, dark sauce, and sambal, served with caramelized char siu and plump wontons.',
    categoryId: 'wonton',
    basePrice: 5.50,
    emoji: '🍜',
    isAvailable: true,
    popularBadge: 'Michelin Plate',
    preparationTimeMins: 3,
    modifierGroups: [
      {
        id: 'style',
        name: 'Style',
        required: true,
        maxSelections: 1,
        options: [
          { id: 'dry-chili', name: 'Dry with Chili Sambal', priceDelta: 0, isDefault: true },
          { id: 'dry-tomato', name: 'Dry with Ketchup/Tomato Sauce', priceDelta: 0 },
          { id: 'soup', name: 'Soup Style in Broth', priceDelta: 0 }
        ]
      },
      {
        id: 'size',
        name: 'Portion Size',
        required: true,
        maxSelections: 1,
        options: [
          { id: 'regular', name: 'Regular Portion', priceDelta: 0, isDefault: true },
          { id: 'large', name: 'Large (+Extra Char Siu & Wonton)', priceDelta: 1.50 }
        ]
      }
    ]
  },
  {
    id: 'oar-2',
    name: 'Claypot Big Prawn Noodles Soup',
    chineseName: '砂煲特级大虾面',
    description: 'Deep amber broth simmered for 8 hours with prawn heads and pork ribs, served with jumbo sea prawns and yellow noodles.',
    categoryId: 'prawn',
    basePrice: 8.50,
    emoji: '🦐',
    isAvailable: true,
    popularBadge: 'Chef Recommendation',
    preparationTimeMins: 4
  },
  {
    id: 'oar-3',
    name: 'Crispy Deep-Fried Wontons (8 pcs)',
    chineseName: '酥炸鲜肉云吞 (8粒)',
    description: 'Golden fried wontons filled with seasoned pork mince and water chestnut, served with Thai sweet chili dip.',
    categoryId: 'sides',
    basePrice: 4.50,
    emoji: '🥟',
    isAvailable: true,
    preparationTimeMins: 3
  }
];

// --- Stall 4: Newton BBQ Seafood & Grill ---
const NEWTON_CATEGORIES: Category[] = [
  { id: 'all', name: 'All Items', chineseName: '全部', icon: 'utensils', displayOrder: 0 },
  { id: 'seafood', name: 'Charcoal BBQ Seafood', chineseName: '碳烤海鲜特产', icon: 'flame', displayOrder: 1 },
  { id: 'wok', name: 'Wok Fried Zi Char', chineseName: '热炒风味', icon: 'soup', displayOrder: 2 },
  { id: 'drinks', name: 'Chilled Drinks', chineseName: '解暑饮品', icon: 'coffee', displayOrder: 3 }
];

const NEWTON_ITEMS: MenuItem[] = [
  {
    id: 'newton-1',
    name: 'Signature Sambal BBQ Stingray (Banana Leaf)',
    chineseName: '招牌芭蕉叶碳烤魔鬼鱼',
    description: 'Fresh ray wing grilled over charcoal smothered in fragrant dried shrimp chili sambal and fresh calamansi limes.',
    categoryId: 'seafood',
    basePrice: 16.00,
    emoji: '🐟',
    isAvailable: true,
    popularBadge: 'Hawker Icon',
    preparationTimeMins: 8,
    modifierGroups: [
      {
        id: 'size',
        name: 'Stingray Size',
        required: true,
        maxSelections: 1,
        options: [
          { id: 'small', name: 'Small (approx 300g)', priceDelta: 0, isDefault: true },
          { id: 'medium', name: 'Medium (approx 450g)', priceDelta: 6.00 },
          { id: 'large', name: 'Large Feast (approx 650g)', priceDelta: 12.00 }
        ]
      }
    ]
  },
  {
    id: 'newton-2',
    name: 'Charcoal BBQ Chicken Wings (4 pcs)',
    chineseName: '蜜汁碳烤鸡翅 (4只)',
    description: 'Marinated in ginger, honey, and Chinese wine, charcoal-roasted till golden crispy skin.',
    categoryId: 'seafood',
    basePrice: 7.20,
    emoji: '🍗',
    isAvailable: true,
    preparationTimeMins: 6
  },
  {
    id: 'newton-3',
    name: 'Crispy Fried Baby Oyster Omelette',
    chineseName: '香脆鲜蚝煎蛋 (蚝煎)',
    description: 'Crisp tapioca starch and egg batter fried with plump oysters, fresh coriander, and fiery garlic chili.',
    categoryId: 'wok',
    basePrice: 8.00,
    emoji: '🦪',
    isAvailable: true,
    preparationTimeMins: 5
  },
  {
    id: 'newton-4',
    name: 'Jumbo Calamansi Sour Plum Juice (Pitcher)',
    chineseName: '大杯话梅金桔冰',
    description: 'Ice-cold freshly squeezed calamansi with salted sour plum.',
    categoryId: 'drinks',
    basePrice: 3.50,
    emoji: '🥤',
    isAvailable: true,
    preparationTimeMins: 1
  }
];

// --- All Preset Stalls Master List ---
export const PRESET_STALLS: StallAccount[] = [
  {
    id: 'stall-ah-huat',
    stallName: 'Ah Huat Hainanese Delights',
    hawkerCentreName: 'Maxwell Food Centre',
    unitNumber: '#01-28',
    uenNumber: '202319882K',
    contactNumber: '+65 9123 4567',
    ownerName: 'Ah Huat (Uncle Tan)',
    email: 'ahhuat@maxwell.sg',
    password: 'password123',
    emoji: '🍗',
    cuisineCategory: 'Hainanese & Hawker Classics',
    settings: {
      stallName: 'Ah Huat Hainanese Delights',
      hawkerCentreName: 'Maxwell Food Centre',
      unitNumber: '#01-28',
      uenNumber: '202319882K',
      contactNumber: '+65 9123 4567',
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
    initialCategories: AH_HUAT_CATEGORIES,
    initialMenuItems: AH_HUAT_ITEMS,
    initialOrders: AH_HUAT_ORDERS
  },
  {
    id: 'stall-uncle-lim',
    stallName: "Uncle Lim's Traditional Kopi & Toast",
    hawkerCentreName: 'Amoy Street Food Centre',
    unitNumber: '#02-12',
    uenNumber: '202108841M',
    contactNumber: '+65 9876 5432',
    ownerName: 'Uncle Lim',
    email: 'unclelim@amoy.sg',
    password: 'password123',
    emoji: '☕',
    cuisineCategory: 'Nanyang Breakfast, Toast & Kopi',
    settings: {
      stallName: "Uncle Lim's Traditional Kopi & Toast",
      hawkerCentreName: 'Amoy Street Food Centre',
      unitNumber: '#02-12',
      uenNumber: '202108841M',
      contactNumber: '+65 9876 5432',
      currencySymbol: 'SGD $',
      enableTakeawayFee: true,
      takeawayFeeAmount: 0.20,
      enableGst: false,
      gstRate: 0.09,
      isDarkTheme: false,
      soundAlertsEnabled: true,
      soundVolume: 0.9,
      kdsWarningThresholdMins: 3,
      kdsCriticalThresholdMins: 6
    },
    initialCategories: UNCLE_LIM_CATEGORIES,
    initialMenuItems: UNCLE_LIM_ITEMS,
    initialOrders: UNCLE_LIM_ORDERS
  },
  {
    id: 'stall-old-airport',
    stallName: 'Old Airport Road Famous Noodles',
    hawkerCentreName: 'Old Airport Road Food Centre',
    unitNumber: '#01-44',
    uenNumber: '201928374G',
    contactNumber: '+65 8234 5678',
    ownerName: 'Chef Wong',
    email: 'wonton@oldairport.sg',
    password: 'password123',
    emoji: '🍜',
    cuisineCategory: 'Handmade Wonton & Prawn Noodles',
    settings: {
      stallName: 'Old Airport Road Famous Noodles',
      hawkerCentreName: 'Old Airport Road Food Centre',
      unitNumber: '#01-44',
      uenNumber: '201928374G',
      contactNumber: '+65 8234 5678',
      currencySymbol: 'SGD $',
      enableTakeawayFee: true,
      takeawayFeeAmount: 0.30,
      enableGst: false,
      gstRate: 0.09,
      isDarkTheme: false,
      soundAlertsEnabled: true,
      soundVolume: 0.8,
      kdsWarningThresholdMins: 4,
      kdsCriticalThresholdMins: 8
    },
    initialCategories: OLD_AIRPORT_CATEGORIES,
    initialMenuItems: OLD_AIRPORT_ITEMS,
    initialOrders: []
  },
  {
    id: 'stall-newton-bbq',
    stallName: 'Newton BBQ Seafood & Grill',
    hawkerCentreName: 'Newton Food Centre',
    unitNumber: '#01-70',
    uenNumber: '202049103D',
    contactNumber: '+65 9345 6789',
    ownerName: 'Madam Koh',
    email: 'newtonbbq@newton.sg',
    password: 'password123',
    emoji: '🐟',
    cuisineCategory: 'Sambal Stingray & BBQ Zi Char',
    settings: {
      stallName: 'Newton BBQ Seafood & Grill',
      hawkerCentreName: 'Newton Food Centre',
      unitNumber: '#01-70',
      uenNumber: '202049103D',
      contactNumber: '+65 9345 6789',
      currencySymbol: 'SGD $',
      enableTakeawayFee: true,
      takeawayFeeAmount: 0.50,
      enableGst: true,
      gstRate: 0.09,
      isDarkTheme: false,
      soundAlertsEnabled: true,
      soundVolume: 0.8,
      kdsWarningThresholdMins: 8,
      kdsCriticalThresholdMins: 15
    },
    initialCategories: NEWTON_CATEGORIES,
    initialMenuItems: NEWTON_ITEMS,
    initialOrders: []
  }
];

export const INITIAL_CATEGORIES = AH_HUAT_CATEGORIES;
export const INITIAL_MENU_ITEMS = AH_HUAT_ITEMS;
export const INITIAL_ORDERS = AH_HUAT_ORDERS;
export const INITIAL_SETTINGS = PRESET_STALLS[0].settings;
