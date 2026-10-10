import { Component, inject, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs';
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

  readonly currentUrl = signal<string>(this.router.url);

  readonly isOrdersPage = computed(() => {
    const url = this.currentUrl();
    return url.includes('/orders') || url.includes('/profile');
  });

  readonly showOrdersNotification = computed(() => {
    if (this.isOrdersPage()) return false;
    return this.customerService.hasUnseenOrders();
  });

  constructor() {
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd)
    ).subscribe(event => {
      const url = event.urlAfterRedirects || event.url;
      this.currentUrl.set(url);
      if (url.includes('/orders') || url.includes('/profile')) {
        this.customerService.markOrdersViewed();
      }
    });
  }

  dismissToast(): void {
    this.orderNotificationService.dismissToast();
  }

  viewTracker(orderId: string): void {
    this.dismissToast();
    this.router.navigate(['/tracking', orderId]);
  }
}
