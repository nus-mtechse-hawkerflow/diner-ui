import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { CustomerService } from '../../core/services/customer.service';
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

  readonly currentCustomer = this.customerService.currentCustomer;
  readonly isGuest = this.customerService.isGuest;
  readonly isAuthenticated = this.customerService.isAuthenticated;
  readonly activeVouchersCount = this.customerService.activeVouchersCount;
  readonly customerOrders = this.customerService.customerOrders;
}
