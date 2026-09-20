import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';
import { CustomerService } from '../../core/services/customer.service';
import { OrderNotificationService } from '../../core/services/order-notification.service';
import { IconComponent } from '../../shared/components/icon/icon.component';

@Component({
  selector: 'app-customer-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, IconComponent],
  templateUrl: './customer-layout.component.html',
  host: {
    class: 'flex-1 flex flex-col min-h-0 w-full'
  }
})
export class CustomerLayoutComponent {
  private customerService = inject(CustomerService);
  private orderNotificationService = inject(OrderNotificationService);
  private router = inject(Router);

  readonly currentCustomer = this.customerService.currentCustomer;
  readonly isGuest = this.customerService.isGuest;
  readonly isAuthenticated = this.customerService.isAuthenticated;
  readonly activeVouchersCount = this.customerService.activeVouchersCount;
  readonly customerOrders = this.customerService.customerOrders;
  readonly activeCustomerOrders = this.customerService.activeCustomerOrders;
  readonly activeOrdersCount = computed(() => this.customerService.activeCustomerOrders().length);

  readonly activeToast = this.orderNotificationService.activeToast;

  dismissToast(): void {
    this.orderNotificationService.dismissToast();
  }

  viewTracker(orderId: string): void {
    this.dismissToast();
    this.router.navigate(['/tracking', orderId]);
  }
}
