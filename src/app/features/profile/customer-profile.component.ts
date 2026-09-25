import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { CustomerService } from '../../core/services/customer.service';

@Component({
  selector: 'app-customer-profile',
  standalone: true,
  imports: [CommonModule, RouterLink, IconComponent],
  templateUrl: './customer-profile.component.html',
})
export class CustomerProfileComponent implements OnInit {
  private customerService = inject(CustomerService);
  private router = inject(Router);

  currentCustomer = this.customerService.currentCustomer;
  isGuest = this.customerService.isGuest;
  isAuthenticated = this.customerService.isAuthenticated;

  ngOnInit(): void {
    if (!this.isGuest()) {
      this.customerService.refreshCustomerDetails().subscribe();
    }
  }

  onLogout(): void {
    this.customerService.logout();
    this.router.navigate(['/auth']);
  }
}
