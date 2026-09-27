import { ApplicationConfig, inject, provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { routes } from './app.routes';
import { CustomerService } from './core/services/customer.service';

/**
 * Restores a signed-in diner before the first page renders, so a reload does
 * not briefly show them as signed out.
 */
export function restoreCustomerSession(): Promise<boolean> {
  return firstValueFrom(inject(CustomerService).restoreSession());
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withFetch()),
    provideAppInitializer(restoreCustomerSession)
  ],
};
