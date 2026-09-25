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
  accountExistsError = signal<boolean>(false);

  // Guest input
  guestName = '';
  guestPhone = '';

  // Login input
  loginIdentifier = '';
  loginPassword = '';

  // Register inputs
  regFirstName = '';
  regLastName = '';
  regPhone = '';
  regEmail = '';
  regPassword = '';

  // Confirmation & MFA state
  confirmationCode = '';
  pendingUsername = '';
  pendingFirstName = '';
  pendingLastName = '';
  pendingName = '';
  pendingPhone = '';
  pendingEmail = '';
  pendingUserSub = '';
  mfaDestination = '';
  mfaDeliveryMedium = 'SMS';

  switchToSignIn(): void {
    this.loginIdentifier = this.regPhone || this.regEmail;
    this.accountExistsError.set(false);
    this.errorMessage.set(null);
    this.activeTab.set('login');
  }

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
    if (!this.regPhone || !this.regPassword || !this.regFirstName || !this.regLastName || !this.regEmail) {
      this.errorMessage.set('Please fill in all required fields (First Name, Last Name, Phone, Email, Password).');
      return;
    }
    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);
    this.accountExistsError.set(false);

    this.pendingFirstName = this.regFirstName;
    this.pendingLastName = this.regLastName;
    this.pendingName = `${this.regFirstName} ${this.regLastName}`.trim();
    this.pendingPhone = this.regPhone;
    this.pendingEmail = this.regEmail;

    this.customerService.register({
      firstName: this.regFirstName,
      lastName: this.regLastName,
      name: this.pendingName,
      phone: this.regPhone,
      email: this.regEmail,
      password: this.regPassword
    }).subscribe({
      next: (res) => {
        this.isLoading.set(false);
        if (!res.success && res.error) {
          if ((res as any).accountExists || res.error.toLowerCase().includes('already exist')) {
            this.accountExistsError.set(true);
          }
          this.errorMessage.set(res.error);
          return;
        }

        if (res.userSub || res.user?.cognitoSub) {
          this.pendingUserSub = res.userSub || res.user?.cognitoSub || '';
        }

        if (res.requiresMfa) {
          this.pendingUsername = this.regPhone;
          this.confirmationCode = '';
          this.mfaDestination = res.codeDeliveryDetails?.destination || this.regPhone;
          this.mfaDeliveryMedium = res.codeDeliveryDetails?.deliveryMedium || 'SMS';
          this.activeTab.set('confirm_mfa');
          return;
        }

        if (res.requiresConfirmation) {
          this.pendingUsername = res.username || this.regPhone;
          this.confirmationCode = '';
          this.mfaDestination = res.codeDeliveryDetails?.destination || this.regPhone || this.regEmail;
          this.mfaDeliveryMedium = res.codeDeliveryDetails?.deliveryMedium || 'SMS';
          this.activeTab.set('confirm_signup');
          return;
        }
      },
      error: (err) => {
        this.isLoading.set(false);
        const errStr = err?.message || 'Registration failed';
        if (errStr.toLowerCase().includes('already exist')) {
          this.accountExistsError.set(true);
        }
        this.errorMessage.set(errStr);
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
        firstName: this.pendingFirstName,
        lastName: this.pendingLastName,
        name: this.pendingName,
        phone: this.pendingPhone,
        email: this.pendingEmail,
        customer_sub: this.pendingUserSub,
        sub: this.pendingUserSub
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
