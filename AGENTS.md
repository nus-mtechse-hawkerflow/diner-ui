# AGENT.md — HawkerFlow Diner Self-Ordering App Guidelines

This document provides instructions, technical specifications, and guardrails for AI coding agents working on the **HawkerFlow Diner (`hawkerflow-diner-ui`)** codebase.

---

## 1. Tech Stack & Libraries

- **Framework**: Angular 22 (Modern Standalone Components, Signal-based reactivity)
- **Language**: TypeScript 6.0+ (Target: `ES2022`, strict typing, `module: preserve`)
- **Styling**: Tailwind CSS (with `@tailwindcss/postcss`, custom `hawker-*` color palette, Plus Jakarta Sans & JetBrains Mono typography)
- **Icons**: Lucide Icons (`@lucide/angular` / `lucide-angular` wrapped via `<app-icon>`)
- **Build System**: Angular Application Builder (`@angular/build:application` via Vite / esbuild)
- **State Management**: Angular Signals (`signal`, `computed`, `effect`) with `localStorage` persistence
- **Testing**: Vitest (`vitest: ^4.0.8`) with `@angular/build:unit-test` / JSDOM runner
- **Default Port**: `4201` (`http://localhost:4201`)

---

## 2. Architecture & Directory Layout

```
src/app/
├── core/
│   ├── mock/           # Preset stalls, default menus, vouchers, and stamp cards
│   ├── models/         # TypeScript interfaces & types (customer, order, menu, auth, settings)
│   └── services/       # Signal-based singletons (CustomerService, OrderService, MenuService, AudioService, AuthService)
├── shared/
│   └── components/     # Reusable UI widgets (IconComponent, ReceiptModalComponent, ModifierModalComponent, PaymentModalComponent)
└── features/
    ├── layout/         # Mobile-first shell with bottom navigation (customer-layout.component.ts & .html)
    ├── auth/           # Guest checkout mode, demo user logins, and registration bonus
    ├── stalls/         # Food centre directory, search, and stall cards
    ├── order/          # Dish customization, modifier modals, voucher drawer, and checkout
    ├── order-tracker/  # Real-time 3-step live kitchen status & digital receipts
    ├── rewards/        # HawkerKaki Points, tier progress, 10-stamp punch cards, and vouchers
    └── profile/        # Customer past order history, e-receipt viewer, and settings
```

---

## 3. Coding Standards & Style Guide

### A. Template Isolation Rule (Strict)
- **Every Angular component template must be in its own dedicated `.html` file** (linked via `templateUrl: './component-name.component.html'`).
- **Never** write inline templates (`template: \`...\``).

### B. Modern Angular & Reactive Signals
- Use **Standalone Components** (`standalone: true`) exclusively.
- Use `inject()` function for dependency injection.
- Use Angular's built-in control flow syntax: `@if`, `@for`, `@switch`.
- State must be exposed as Signals (`signal<T>()`, `computed<T>()`).

### C. Naming Conventions
- **Files & Folders**: `kebab-case` with descriptive suffixes (`customer-order.component.ts`, `customer.model.ts`).
- **Classes / Types / Interfaces**: `PascalCase` (`CustomerUser`, `CustomerService`, `OrderItem`).
- **Methods, Variables & Signals**: `camelCase` (`currentCustomer`, `activeVouchers`, `onApplyVoucher()`).
- **Constants**: `UPPER_SNAKE_CASE` (`INITIAL_PRESET_CUSTOMERS`, `INITIAL_VOUCHERS`).

### D. Mobile-First & Safe Clearance
- The customer layout features a fixed floating bottom navigation bar (`fixed bottom-0` / `md:bottom-3`).
- **Always ensure adequate bottom padding** (`pb-28` to `pb-36`) on pages so content, buttons, and voucher cards are never obscured behind the bottom navigation bar.

---

## 4. Testing Guidelines

- Run all unit tests:
  ```bash
  npm test -- --watch=false
  ```
- Build production bundle:
  ```bash
  npm run build
  ```

---

## 5. Workflow & Guardrails for AI Agents

1. **Verify Before Declaring Done**:
   - Always verify `npm test -- --watch=false` and `npm run build` succeed with 0 errors.
2. **Preserve Repository Separation**:
   - **`hawkerflow-diner-ui`** is strictly for the **Customer / Diner Self-Ordering App**.
   - Stall POS & kitchen KDS management belongs in `~/Documents/Development/hawkerflow-ui`.
3. **Port Consistency**:
   - Always maintain default port `4201` for the diner app in `angular.json` and `package.json`.
