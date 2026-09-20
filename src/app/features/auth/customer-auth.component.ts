import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CustomerService } from '../../core/services/customer.service';
import { IconComponent } from '../../shared/components/icon/icon.component';

@Component({
  selector: 'app-customer-auth',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  templateUrl: './customer-auth.component.html'
})
export class CustomerAuthComponent {
  private customerService = inject(CustomerService);

  activeTab = signal<'guest' | 'login' | 'register'>('guest');

  // Guest input
  guestName = '';
  guestPhone = '';

  // Login input
  loginIdentifier = '';

  // Register inputs
  regName = '';
  regPhone = '';
  regEmail = '';

  onGuestOrder(): void {
    this.customerService.continueAsGuest(this.guestName, this.guestPhone);
  }

  onFormLogin(): void {
    if (!this.loginIdentifier) return;
    this.customerService.login(this.loginIdentifier);
  }

  onRegister(): void {
    if (!this.regName || !this.regPhone) return;
    this.customerService.register({
      name: this.regName,
      phone: this.regPhone,
      email: this.regEmail
    });
  }
}
