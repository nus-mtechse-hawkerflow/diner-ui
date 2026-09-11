import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { CustomerService } from '../../core/services/customer.service';
import { CustomerVoucher } from '../../core/models/customer.model';
import { IconComponent } from '../../shared/components/icon/icon.component';

interface RedeemItem {
  id: string;
  emoji: string;
  title: string;
  description: string;
  pointsCost: number;
  discountVal: number;
}

@Component({
  selector: 'app-customer-rewards',
  standalone: true,
  imports: [CommonModule, RouterLink, IconComponent],
  templateUrl: './customer-rewards.component.html'
})
export class CustomerRewardsComponent {
  private customerService = inject(CustomerService);

  readonly currentCustomer = this.customerService.currentCustomer;
  readonly vouchers = this.customerService.vouchers;
  readonly stampCards = this.customerService.stampCards;
  readonly appliedVoucher = this.customerService.appliedVoucher;

  activeRewardTab = signal<'vouchers' | 'stamps' | 'redeem'>('vouchers');

  readonly activeVouchers = computed(() => {
    return this.vouchers().filter(v => !v.isUsed);
  });

  readonly tierProgress = computed(() => {
    const pts = this.currentCustomer()?.loyaltyPoints || 0;
    return Math.min(100, Math.round((pts / 300) * 100));
  });

  readonly redeemCatalog: RedeemItem[] = [
    {
      id: 'red-2-voucher',
      emoji: '🎟️',
      title: '$2.00 Hawker Dining Credit',
      description: 'Deduct $2 off your next hawker meal. Valid across all stalls.',
      pointsCost: 100,
      discountVal: 2.00
    },
    {
      id: 'red-kopi-toast',
      emoji: '☕',
      title: 'Free Traditional Kopi & Toast Set',
      description: 'Redeem 1 hot beverage + kaya butter toast set (Worth $3.20).',
      pointsCost: 150,
      discountVal: 3.20
    },
    {
      id: 'red-5-voucher',
      emoji: '🍗',
      title: '$5.00 Signature Main Dish Voucher',
      description: 'Deduct $5 off any main dish across all participating stalls.',
      pointsCost: 250,
      discountVal: 5.00
    },
    {
      id: 'red-8-seafood',
      emoji: '🦞',
      title: '$8.00 Newton BBQ Seafood Feast Credit',
      description: 'Enjoy $8 off any BBQ Sambal Stingray or Cereal Prawns order.',
      pointsCost: 350,
      discountVal: 8.00
    }
  ];

  onApplyVoucher(vouch: CustomerVoucher): void {
    this.customerService.applyVoucher(vouch);
  }

  onRedeemReward(item: RedeemItem): void {
    const success = this.customerService.redeemPointsForVoucher(
      item.pointsCost,
      item.title,
      item.discountVal
    );
    if (success) {
      alert(`🎉 Success! "${item.title}" voucher added to your wallet!`);
      this.activeRewardTab.set('vouchers');
    }
  }
}
