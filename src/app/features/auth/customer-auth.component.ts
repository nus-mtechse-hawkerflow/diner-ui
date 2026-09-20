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

  activeTab = signal<'guest' | 'login' | 'register' | 'confirm_signup' | 'confirm_mfa'>('guest');
  isLoading = signal<boolean>(false);
  errorMessage = signal<string | null>(null);
  successMessage = signal<string | null>(null);

  // Guest input
  guestName = '';
  guestPhone = '';

  // Login input
  loginIdentifier = '';
  loginPassword = '';

  // Register inputs
  regName = '';
  regPhone = '';
  regEmail = '';
  regPassword = '';

  // Confirmation & MFA state
  confirmationCode = '';
  pendingUsername = '';
  pendingName = '';
  pendingPhone = '';
  pendingEmail = '';
  mfaDestination = '';
  mfaDeliveryMedium = 'SMS';

  onGuestOrder(): void {
    this.customerService.continueAsGuest(this.guestName, this.guestPhone);
  }

  onFormLogin(): void {
    if (!this.loginIdentifier) return;
    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    this.customerService.login(this.loginIdentifier, this.loginPassword).subscribe({
      next: (res) => {
        this.isLoading.set(false);
        if (!res.success && res.error) {
          this.errorMessage.set(res.error);
          return;
        }

        if (res.requiresMfa) {
          this.pendingUsername = this.loginIdentifier;
          this.confirmationCode = '';
          this.mfaDestination = res.codeDeliveryDetails?.destination || this.loginIdentifier;
          this.mfaDeliveryMedium = res.codeDeliveryDetails?.deliveryMedium || 'SMS';
          this.activeTab.set('confirm_mfa');
        }
      },
      error: (err) => {
        this.isLoading.set(false);
        this.errorMessage.set(err?.message || 'Login failed');
      }
    });
  }

  onRegister(): void {
    if (!this.regName || !this.regPhone) return;
    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    this.pendingName = this.regName;
    this.pendingPhone = this.regPhone;
    this.pendingEmail = this.regEmail;

    this.customerService.register({
      name: this.regName,
      phone: this.regPhone,
      email: this.regEmail,
      password: this.regPassword
    }).subscribe({
      next: (res) => {
        this.isLoading.set(false);
        if (!res.success && res.error) {
          this.errorMessage.set(res.error);
          return;
        }

        if (res.requiresConfirmation) {
          this.pendingUsername = res.username || this.regPhone;
          this.confirmationCode = '';
          this.mfaDestination = res.codeDeliveryDetails?.destination || this.regPhone || this.regEmail;
          this.mfaDeliveryMedium = res.codeDeliveryDetails?.deliveryMedium || 'SMS';
          this.activeTab.set('confirm_signup');
        }
      },
      error: (err) => {
        this.isLoading.set(false);
        this.errorMessage.set(err?.message || 'Registration failed');
      }
    });
  }

  onConfirmRegistrationCode(): void {
    if (!this.confirmationCode) return;
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.customerService.confirmRegistrationCode(
      this.pendingUsername,
      this.confirmationCode,
      {
        name: this.pendingName,
        phone: this.pendingPhone,
        email: this.pendingEmail
      }
    ).subscribe({
      next: (res) => {
        this.isLoading.set(false);
        if (!res.success && res.error) {
          this.errorMessage.set(res.error);
        }
      },
      error: (err) => {
        this.isLoading.set(false);
        this.errorMessage.set(err?.message || 'Verification failed');
      }
    });
  }

  onConfirmMfa(): void {
    if (!this.confirmationCode) return;
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.customerService.confirmMfa(
      this.confirmationCode,
      {
        identifier: this.pendingUsername,
        name: this.pendingName
      }
    ).subscribe({
      next: (res) => {
        this.isLoading.set(false);
        if (!res.success && res.error) {
          this.errorMessage.set(res.error);
        }
      },
      error: (err) => {
        this.isLoading.set(false);
        this.errorMessage.set(err?.message || 'MFA code verification failed');
      }
    });
  }

  onResendCode(): void {
    if (!this.pendingUsername) return;
    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    this.customerService.resendConfirmationCode(this.pendingUsername).subscribe({
      next: (res) => {
        this.isLoading.set(false);
        if (res.success) {
          this.successMessage.set(`New confirmation code sent to ${res.destination || this.mfaDestination || this.pendingUsername}`);
        } else if (res.error) {
          this.errorMessage.set(res.error);
        }
      },
      error: (err) => {
        this.isLoading.set(false);
        this.errorMessage.set(err?.message || 'Failed to resend code');
      }
    });
  }

  onCancelCodeEntry(): void {
    this.confirmationCode = '';
    this.errorMessage.set(null);
    this.successMessage.set(null);
    this.activeTab.set('login');
  }
}
