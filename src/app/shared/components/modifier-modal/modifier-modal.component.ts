import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MenuItem, ModifierGroup, ModifierOption } from '../../../core/models/menu.model';
import { SelectedModifier } from '../../../core/models/order.model';
import { IconComponent } from '../../../shared/components/icon/icon.component';

@Component({
  selector: 'app-modifier-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  templateUrl: './modifier-modal.component.html'
})
export class ModifierModalComponent implements OnInit, OnChanges {
  @Input() item: MenuItem | null = null;
  @Output() close = new EventEmitter<void>();
  @Output() add = new EventEmitter<{
    item: MenuItem;
    selectedModifiers: SelectedModifier[];
    quantity: number;
    specialNotes: string;
  }>();

  quantity = 1;
  specialNotes = '';
  selectedModifiers: SelectedModifier[] = [];

  ngOnInit(): void {
    this.resetForm();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['item'] && this.item) {
      this.resetForm();
    }
  }

  resetForm(): void {
    this.quantity = 1;
    this.specialNotes = '';
    this.selectedModifiers = [];

    if (!this.item || !this.item.modifierGroups) return;

    this.item.modifierGroups.forEach(group => {
      const defaultOpt = group.options.find(o => o.isDefault) || group.options[0];
      if (group.required && defaultOpt) {
        this.selectedModifiers.push({
          groupId: group.id,
          groupName: group.name,
          optionId: defaultOpt.id,
          optionName: defaultOpt.name,
          priceDelta: defaultOpt.priceDelta
        });
      }
    });
  }

  isOptionSelected(groupId: string, optionId: string): boolean {
    return this.selectedModifiers.some(m => m.groupId === groupId && m.optionId === optionId);
  }

  selectSingleOption(group: ModifierGroup, opt: ModifierOption): void {
    this.selectedModifiers = this.selectedModifiers.filter(m => m.groupId !== group.id);
    this.selectedModifiers.push({
      groupId: group.id,
      groupName: group.name,
      optionId: opt.id,
      optionName: opt.name,
      priceDelta: opt.priceDelta
    });
  }

  toggleMultiOption(group: ModifierGroup, opt: ModifierOption): void {
    const exists = this.isOptionSelected(group.id, opt.id);
    if (exists) {
      this.selectedModifiers = this.selectedModifiers.filter(
        m => !(m.groupId === group.id && m.optionId === opt.id)
      );
    } else {
      this.selectedModifiers.push({
        groupId: group.id,
        groupName: group.name,
        optionId: opt.id,
        optionName: opt.name,
        priceDelta: opt.priceDelta
      });
    }
  }

  increaseQty(): void {
    this.quantity++;
  }

  decreaseQty(): void {
    if (this.quantity > 1) this.quantity--;
  }

  calculateTotal(): number {
    if (!this.item) return 0;
    const modTotal = this.selectedModifiers.reduce((sum, m) => sum + m.priceDelta, 0);
    return (this.item.basePrice + modTotal) * this.quantity;
  }

  onConfirmAdd(): void {
    if (!this.item) return;
    this.add.emit({
      item: this.item,
      selectedModifiers: [...this.selectedModifiers],
      quantity: this.quantity,
      specialNotes: this.specialNotes.trim()
    });
    this.close.emit();
  }
}
