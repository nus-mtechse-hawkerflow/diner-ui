# AGENT.md - HawkerFlow Diner UI

This document provides operational guidelines, architecture rules, and conventions for AI agents working in this repository.

---

## 1. Tech Stack & Libraries

- **Language**: TypeScript (`~6.0.2`, target `ES2022`)
- **Framework**: Angular 22 (`@angular/core`, `@angular/common`, `@angular/router`, `@angular/forms`)
  - Standalone Component architecture (no `NgModule`)
  - Signal-based state management (`signal`, `computed`, `effect`)
  - Modern built-in template control flow (`@if`, `@for`, `@switch`)
  - Dependency injection via `inject()`
- **Styling**:
  - Tailwind CSS (`tailwindcss`, `@tailwindcss/postcss`, `autoprefixer`)
  - Mobile-first, dark slate theme (`#020617` background, vibrant orange/amber accents)
  - Custom CSS animations (`animate-fade-in`, `animate-slide-up` in `src/styles.css`)
- **Icons**: Lucide Angular (`lucide-angular`, `@lucide/angular`) via shared `<app-icon>` wrapper component
- **Reactivity & Async**: Angular Signals + RxJS (`~7.8.0`)
- **Testing**: Vitest (`^4.0.8`) with `jsdom` runner via `@angular/build:unit-test`
- **Build System**: Angular Application Builder (`@angular/build:application`, `@angular/cli`)

---

## 2. Coding Standards & Style Guide

### 2.1 File & Directory Structure
```
src/app/
├── core/            # Domain models, Signal services, mock data, persistence
│   ├── mock/        # Initial seed data for stalls, menus, vouchers
│   ├── models/      # TypeScript types and interfaces (*.model.ts)
│   └── services/    # Injectable singletons (*.service.ts)
├── features/        # Feature domain pages and smart components
│   ├── auth/        # Guest mode, login & registration
│   ├── layout/      # Mobile viewport wrapper & bottom navigation bar
│   ├── order/       # Menu selection, modifiers modal, cart drawer
│   ├── order-tracker/ # Real-time kitchen progress & thermal receipts
│   ├── profile/     # Customer profile, past order history, thermal e-receipts
│   ├── rewards/     # HawkerKaki loyalty points, stamp cards, voucher wallet
│   └── stalls/      # Hawker centre and stall directory
└── shared/          # Reusable dumb/UI components (*.component.ts)
    └── components/  # IconComponent, ReceiptModal, ModifiersModal, etc.
```

### 2.2 Naming Conventions
- **Files**: kebab-case with descriptive suffix:
  - Components: `name.component.ts`, `name.component.html`
  - Services: `name.service.ts`
  - Models: `name.model.ts`
  - Specs: `name.spec.ts`
- **Classes / Types / Interfaces**: PascalCase (`CustomerProfileComponent`, `CustomerService`, `Order`, `CustomerUser`)
- **Signals / Variables / Functions**: camelCase (`currentCustomer`, `selectedOrderForReceipt`, `formatOrderDate()`, `redeemPointsForVoucher()`)
- **Constants / Storage Keys**: UPPER_SNAKE_CASE (`CUSTOMER_SESSION_KEY`, `INITIAL_PRESET_CUSTOMERS`)

### 2.3 Angular & TypeScript Guidelines
- **Standalone Only**: Always define components as standalone with explicit `imports: [...]`.
- **Injection**: Use `inject(Service)` instead of constructor parameter injection.
- **Signals First**: Use Angular Signals (`signal<T>()`, `computed()`) for local and shared state. Persist state changes via `effect()` and `localStorage` where applicable.
- **Template Control Flow**: Use built-in control flow (`@if (...)`, `@for (item of items; track item.id)`, `@switch (...)`). Do NOT use deprecated structural directives like `*ngIf` or `*ngFor`.
- **Mobile-First UX**: Ensure UI containers remain constrained (`max-w-md mx-auto`), touch-friendly, and responsive.

---

## 3. Testing Guidelines

- **Framework**: Vitest integrated into the Angular test builder (`@angular/build:unit-test`).
- **Test Structure**:
  - Group related behavior inside `describe('Feature / Service Name', () => { ... })`.
  - Use `beforeEach(async () => { ... })` with `TestBed.configureTestingModule` and `provideRouter(routes)` when routing is needed.
  - Inject services using `TestBed.inject(ServiceName)`.
- **Commands**:
  - Run all unit tests: `npm test`
  - Run production build check: `npm run build`
- **Quality Gates**:
  - Always verify that all unit tests pass (`npm test`) after modifying core services or data models.
  - Ensure zero compilation and type errors on `npm run build`.

---

## 4. Workflow & Guardrails

1. **Verify Before Modifying Critical Configs**:
   - Do not edit `package.json`, `angular.json`, `tsconfig.json`, or Tailwind configurations unless explicitly requested or required for a dependency/build fix.
2. **Preserve Modern Angular Patterns**:
   - Never revert code back to `NgModule` architectures or legacy `*ngIf`/`*ngFor` syntax.
   - Maintain signal-based reactivity and avoid introducing unnecessary RxJS subjects/subscriptions when a Signal suffices.
3. **Domain Integrity (Singapore Hawker Context)**:
   - Respect Singapore currency formatting (SGD `$` or `S$`, `.toFixed(2)`).
   - Maintain local terminology (e.g., Kaki loyalty tiers, Stall / Food Centre nomenclature, PayNow / NETS payment options, Dine-In / Takeaway handling).
4. **Execution & Verification**:
   - Run `npm test` and `npm run build` after substantial refactoring to confirm nothing is broken.
5. **Concise Communication**:
   - Keep answers, explanations, and commit summaries direct, technical, and concise. Avoid unnecessary preamble.
