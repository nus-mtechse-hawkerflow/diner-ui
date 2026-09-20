import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { IconComponent } from '../../shared/components/icon/icon.component';

@Component({
  selector: 'app-stall-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, IconComponent],
  templateUrl: './stall-list.component.html'
})
export class StallListComponent implements OnInit {
  private authService = inject(AuthService);
  private router = inject(Router);

  readonly allStalls = this.authService.allStalls;
  readonly isLoadingStalls = this.authService.isLoadingStalls;

  searchQuery = '';
  selectedCentre = signal<string>('All Food Centres');

  ngOnInit(): void {
    this.authService.loadStallsFromBackend();
  }

  readonly hawkerCentres = [
    'All Food Centres',
    'Maxwell Food Centre',
    'Amoy Street Food Centre',
    'Old Airport Road Food Centre',
    'Newton Food Centre'
  ];

  readonly filteredStalls = computed(() => {
    const list = this.allStalls();
    const query = this.searchQuery.trim().toLowerCase();
    const centre = this.selectedCentre();

    return list.filter(stall => {
      const matchCentre = centre === 'All Food Centres' || stall.hawkerCentreName.includes(centre) || centre.includes(stall.hawkerCentreName);
      const matchQuery = !query ||
        stall.stallName.toLowerCase().includes(query) ||
        stall.cuisineCategory.toLowerCase().includes(query) ||
        stall.hawkerCentreName.toLowerCase().includes(query);
      return matchCentre && matchQuery;
    });
  });

  goToStallMenu(stallId: string): void {
    this.router.navigate(['/order', stallId]);
  }
}
