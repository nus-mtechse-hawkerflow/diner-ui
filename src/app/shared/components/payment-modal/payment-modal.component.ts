import { Component, Input, Output, EventEmitter, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SettingsService } from '../../../core/services/settings.service';
import { PaymentMethod } from '../../../core/models/order.model';
import { IconComponent } from '../../../shared/components/icon/icon.component';

@Component({
  selector: 'app-payment-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  templateUrl: './payment-modal.component.html'
})
export class PaymentModalComponent implements OnInit {
  @Input() totalAmount = 0;
  @Output() close = new EventEmitter<void>();
  @Output() paymentComplete = new EventEmitter<{
    method: PaymentMethod;
    cashTendered?: number;
    paynowRef?: string;
  }>();

  private settingsService = inject(SettingsService);
  readonly settings = this.settingsService.settings;

  selectedMethod: PaymentMethod = 'cash';
  cashTendered = 0;
  customKeypadInput = '';
  generatedPayNowRef = '';

  get changeDue(): number {
    return Number((this.cashTendered - this.totalAmount).toFixed(2));
  }

  ngOnInit(): void {
    this.cashTendered = this.totalAmount;
    this.generatedPayNowRef = 'PN-' + Math.floor(10000000 + Math.random() * 90000000);
  }

  setTendered(amount: number): void {
    this.cashTendered = amount;
    this.customKeypadInput = amount.toString();
  }

  onKeypadClick(key: string): void {
    if (key === 'C') {
      this.customKeypadInput = '';
      this.cashTendered = 0;
      return;
    }
    if (key === '.' && this.customKeypadInput.includes('.')) return;

    this.customKeypadInput += key;
    const parsed = parseFloat(this.customKeypadInput);
    this.cashTendered = isNaN(parsed) ? 0 : parsed;
  }

  onConfirmPayment(): void {
    if (this.selectedMethod === 'cash' && this.changeDue < 0) return;

    this.paymentComplete.emit({
      method: this.selectedMethod,
      cashTendered: this.selectedMethod === 'cash' ? this.cashTendered : undefined,
      paynowRef: this.selectedMethod === 'paynow' ? this.generatedPayNowRef : undefined
    });
  }
}
