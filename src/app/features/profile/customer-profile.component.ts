import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { CustomerService } from '../../core/services/customer.service';
import { ReceiptModalComponent } from '../../shared/components/receipt-modal/receipt-modal.component';
import { Order } from '../../core/models/order.model';

@Component({
  selector: 'app-customer-profile',
  standalone: true,
  imports: [CommonModule, RouterLink, IconComponent, ReceiptModalComponent],
  templateUrl: './customer-profile.component.html',
})
export class CustomerProfileComponent {
  private customerService = inject(CustomerService);
  private router = inject(Router);

  currentCustomer = this.customerService.currentCustomer;
  isGuest = this.customerService.isGuest;
  customerOrders = this.customerService.customerOrders;

  selectedOrderForReceipt = signal<Order | null>(null);

  formatOrderDate(isoDate: string): string {
    try {
      const d = new Date(isoDate);
      return d.toLocaleDateString('en-SG', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoDate;
    }
  }

  onLogout(): void {
    this.customerService.logout();
    this.router.navigate(['/auth']);
  }
}
