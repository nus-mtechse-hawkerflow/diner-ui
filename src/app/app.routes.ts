import { Routes } from '@angular/router';
import { CustomerLayoutComponent } from './features/layout/customer-layout.component';

export const routes: Routes = [
  {
    path: '',
    component: CustomerLayoutComponent,
    children: [
      {
        path: '',
        redirectTo: 'stalls',
        pathMatch: 'full'
      },
      {
        path: 'auth',
        loadComponent: () => import('./features/auth/customer-auth.component').then(m => m.CustomerAuthComponent)
      },
      {
        path: 'stalls',
        loadComponent: () => import('./features/stalls/stall-list.component').then(m => m.StallListComponent)
      },
      {
        path: 'order/:stallId',
        loadComponent: () => import('./features/order/customer-order.component').then(m => m.CustomerOrderComponent)
      },
      {
        path: 'tracking',
        loadComponent: () => import('./features/order-tracker/customer-order-tracker.component').then(m => m.CustomerOrderTrackerComponent)
      },
      {
        path: 'tracking/:orderId',
        loadComponent: () => import('./features/order-tracker/customer-order-tracker.component').then(m => m.CustomerOrderTrackerComponent)
      },
      {
        path: 'order-tracker/:orderId',
        redirectTo: 'tracking/:orderId',
        pathMatch: 'full'
      },
      {
        path: 'order-tracker',
        redirectTo: 'tracking',
        pathMatch: 'full'
      },
      {
        path: 'orders',
        loadComponent: () => import('./features/profile/customer-profile.component').then(m => m.CustomerProfileComponent)
      },
      {
        path: 'rewards',
        redirectTo: 'stalls',
        pathMatch: 'full'
      },
      {
        path: 'profile',
        loadComponent: () => import('./features/profile/customer-profile.component').then(m => m.CustomerProfileComponent)
      }
    ]
  },
  // Backward compatibility redirects for /customer/* paths
  {
    path: 'customer',
    redirectTo: '',
    pathMatch: 'prefix'
  },
  {
    path: '**',
    redirectTo: 'stalls'
  }
];
