import { Component, inject, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CustomerService } from '../../core/services/customer.service';
import { Order } from '../../core/models/order.model';
import { ReceiptModalComponent } from '../../shared/components/receipt-modal/receipt-modal.component';
import { IconComponent } from '../../shared/components/icon/icon.component';

@Component({
  selector: 'app-customer-order-tracker',
  standalone: true,
  imports: [CommonModule, RouterLink, ReceiptModalComponent, IconComponent],
  templateUrl: './customer-order-tracker.component.html'
})
export class CustomerOrderTrackerComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private customerService = inject(CustomerService);

  orderId = signal<string>('');
  order = signal<Order | null>(null);
  stallName = signal<string>('Hawker Stall');
  stallEmoji = signal<string>('🍲');

  showReceiptModal = signal<boolean>(false);
  stepLevel = signal<number>(1); // 1 = Received, 2 = Cooking, 3 = Ready
  estimatedMinutes = signal<number>(6);
  private statusInterval: any;

  ngOnInit(): void {
    const navState = history.state;
    if (navState && navState.order) {
      this.order.set(navState.order);
      if (navState.stallName) this.stallName.set(navState.stallName);
      if (navState.stallEmoji) this.stallEmoji.set(navState.stallEmoji);
    }

    this.route.paramMap.subscribe(params => {
      const id = params.get('orderId');
      if (id) {
        this.orderId.set(id);
        if (!this.order()) {
          const match = this.customerService.customerOrders().find(o => o.id === id);
          if (match) this.order.set(match);
        }
      }
    });

    // Simulate real kitchen progression for awesome customer UX
    this.statusInterval = setInterval(() => {
      if (this.stepLevel() < 3) {
        this.stepLevel.update(s => s + 1);
        if (this.estimatedMinutes() > 2) {
          this.estimatedMinutes.update(m => m - 2);
        }
      }
    }, 8000);
  }

  ngOnDestroy(): void {
    if (this.statusInterval) clearInterval(this.statusInterval);
  }

  readonly statusMessage = computed(() => {
    const step = this.stepLevel();
    if (step === 1) return 'Order received by chef! Getting ingredients ready...';
    if (step === 2) return 'Wok is sizzling! Food is currently cooking...';
    return '🔥 Food is READY! Please collect at stall counter or wait for server.';
  });
}
