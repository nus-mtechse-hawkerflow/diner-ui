import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { CustomerService } from '../../core/services/customer.service';
import { ReceiptModalComponent } from '../../shared/components/receipt-modal/receipt-modal.component';
import { Order } from '../../core/models/order.model';

@Component({
  selector: 'app-customer-orders',
  standalone: true,
  imports: [CommonModule, RouterLink, IconComponent, ReceiptModalComponent],
  templateUrl: './customer-orders.component.html',
})
export class CustomerOrdersComponent implements OnInit {
  private customerService = inject(CustomerService);
  private router = inject(Router);

  currentCustomer = this.customerService.currentCustomer;
  isGuest = this.customerService.isGuest;
  customerOrders = this.customerService.customerOrders;

  selectedOrderForReceipt = signal<Order | null>(null);

  ngOnInit(): void {
    this.customerService.markOrdersViewed();
    if (!this.isGuest()) {
      this.customerService.refreshCustomerDetails().subscribe();
    }
  }

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

  trackOrder(orderId: string): void {
    this.router.navigate(['/tracking', orderId]);
  }

  onClearOrders(): void {
    this.customerService.clearCustomerOrders();
  }
}
