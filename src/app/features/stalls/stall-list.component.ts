import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { IconComponent } from '../../shared/components/icon/icon.component';

@Component({
  selector: 'app-stall-list',
  standalone: true,
  imports: [CommonModule, IconComponent],
  templateUrl: './stall-list.component.html'
})
export class StallListComponent implements OnInit {
  private authService = inject(AuthService);
  private router = inject(Router);

  readonly allStalls = this.authService.allStalls;
  readonly isLoadingStalls = this.authService.isLoadingStalls;

  ngOnInit(): void {
    this.authService.loadStallsFromBackend();
  }

  goToStallMenu(stallId: string): void {
    this.router.navigate(['/order', stallId]);
  }
}
