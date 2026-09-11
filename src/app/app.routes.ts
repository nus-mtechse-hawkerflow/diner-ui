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
        path: 'order-tracker/:orderId',
        loadComponent: () => import('./features/order-tracker/customer-order-tracker.component').then(m => m.CustomerOrderTrackerComponent)
      },
      {
        path: 'orders',
        loadComponent: () => import('./features/profile/customer-profile.component').then(m => m.CustomerProfileComponent)
      },
      {
        path: 'rewards',
        loadComponent: () => import('./features/rewards/customer-rewards.component').then(m => m.CustomerRewardsComponent)
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
