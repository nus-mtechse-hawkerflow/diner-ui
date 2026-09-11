import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-icon',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './icon.component.html',
  styles: [`
    :host {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      line-height: 0;
      vertical-align: middle;
    }
  `]
})
export class IconComponent {
  @Input() name = 'circle';
  @Input() size = 20;
  @Input() strokeWidth = 2;
  @Input() class = '';
}
