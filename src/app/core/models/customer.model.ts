export type CustomerTier = 'Bronze Kaki' | 'Silver Kaki' | 'Gold Kaki';

export interface CustomerUser {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  isGuest: boolean;
  loyaltyPoints: number;
  tier: CustomerTier;
  avatarEmoji?: string;
  registeredAt: string;
  cognitoSub?: string;
  cognitoUsername?: string;
  accessToken?: string;
  idToken?: string;
}

export type DiscountType = 'fixed' | 'percentage' | 'free_item';

export interface CustomerVoucher {
  id: string;
  code: string;
  title: string;
  description: string;
  discountType: DiscountType;
  discountValue: number; // e.g. 2.00 for $2 off, or 10 for 10%
  minSpend?: number;
  applicableStallId?: string; // specific stall or all
  validUntil: string;
  isUsed: boolean;
  icon: string;
}

export interface CustomerStampCard {
  id: string;
  stallId: string;
  stallName: string;
  stallEmoji: string;
  currentStamps: number;
  maxStamps: number; // usually 10
  rewardDescription: string;
  claimedRewardsCount: number;
}
