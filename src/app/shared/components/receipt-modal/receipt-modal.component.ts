import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Order } from '../../../core/models/order.model';
import { SettingsService } from '../../../core/services/settings.service';
import { IconComponent } from '../icon/icon.component';

@Component({
  selector: 'app-receipt-modal',
  standalone: true,
  imports: [CommonModule, IconComponent],
  templateUrl: './receipt-modal.component.html'
})
export class ReceiptModalComponent {
  @Input() order: Order | null = null;
  @Output() close = new EventEmitter<void>();

  private settingsService = inject(SettingsService);
  readonly settings = this.settingsService.settings;

  formatReceiptDate(isoString: string): string {
    return new Date(isoString).toLocaleDateString('en-SG', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  }

  formatReceiptTime(isoString: string): string {
    return new Date(isoString).toLocaleTimeString('en-SG', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }

  printReceipt(): void {
    window.print();
  }
}
