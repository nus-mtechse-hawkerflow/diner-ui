# HawkerFlow Diner UI (🍲 散客点餐与会员系统)

A mobile-first Singapore Hawker Self-Ordering & Loyalty Web App built with Angular standalone components, Signals, and Tailwind CSS.

---

## 🚀 Features

- **Food Centre & Stall Discovery**: Browse stalls across Maxwell, Amoy Street, Old Airport Road, and Newton Food Centres.
- **Dish Customization & Modifiers**: Customize chili level, rice/noodle portions, drink sweetness, and soup add-ons.
- **Guest Checkout & Member Auth**: Fast guest ordering or sign up with **100 bonus points** and **\$5.00 Welcome Voucher** (`WELCOME5`).
- **HawkerKaki Rewards & Digital Stamp Cards**: Collect 10-stamp punch cards per stall and redeem discount vouchers.
- **Live Order Tracker**: Real-time 3-step kitchen progress (*Received $\rightarrow$ Cooking $\rightarrow$ Ready*) with countdown and thermal e-receipts.
- **PayNow SGQR & NETS Pay**: Simulated frictionless payments.

---

## 🛠️ Getting Started

### Prerequisites
- Node.js 18+ / 20+
- npm 9+

### Installation & Run
```bash
# Install dependencies
npm install

# Start development server
npm start
# App will run on http://localhost:4200 (or http://localhost:4201)

# Run unit tests
npm test

# Build production bundle
npm run build
```

---

## 📂 Project Structure

```
src/app/
├── core/
│   ├── models/        # Customer, Order, Menu & Stall TypeScript models
│   ├── services/      # Signal-based customer state, menus, audio
│   └── mock/          # Preset stalls, menus, vouchers, and demo accounts
├── shared/
│   └── components/    # Lucide SVG IconComponent, ReceiptModal, Modifiers
└── features/
    ├── layout/        # Mobile-first shell with bottom navigation
    ├── auth/          # Guest mode, demo logins, registration bonus
    ├── stalls/        # Food centre stall directory & search
    ├── order/         # Menu browsing, modifiers modal, voucher drawer
    ├── order-tracker/ # Live 3-step kitchen progress & receipt viewer
    ├── rewards/       # HawkerKaki points, 10-stamp cards, voucher wallet
    └── profile/       # Order history, thermal receipts & account settings
```
