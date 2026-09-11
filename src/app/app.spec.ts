import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { App } from './app';
import { routes } from './app.routes';
import { CustomerService } from './core/services/customer.service';
import { AuthService } from './core/services/auth.service';
import { Order } from './core/models/order.model';

describe('HawkerFlow Diner App & Loyalty System', () => {
  let customerService: CustomerService;
  let authService: AuthService;
  let router: Router;

  beforeEach(async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter(routes)]
    }).compileComponents();

    customerService = TestBed.inject(CustomerService);
    authService = TestBed.inject(AuthService);
    router = TestBed.inject(Router);
  });

  it('should create the diner app shell', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should support guest diner checkout mode', () => {
    customerService.continueAsGuest();
    expect(customerService.isGuest()).toBe(true);
    expect(customerService.currentCustomer()?.name).toContain('Guest');
  });

  it('should authenticate demo user and load points & vouchers', () => {
    const res = customerService.login('+65 9123 4567');
    expect(res.success).toBe(true);
    expect(customerService.isGuest()).toBe(false);
    expect(customerService.currentCustomer()?.name).toContain('Uncle Tan');
    expect(customerService.currentCustomer()?.loyaltyPoints).toBeGreaterThanOrEqual(300);
    expect(customerService.vouchers().length).toBeGreaterThan(0);
  });

  it('should register a new customer with welcome bonus and vouchers', () => {
    const newUser = customerService.register({
      name: 'Sarah Chen',
      phone: '+65 9876 5432',
      email: 'sarah.chen@gmail.com'
    });

    expect(newUser).toBeDefined();
    expect(customerService.currentCustomer()?.name).toBe('Sarah Chen');
    expect(customerService.currentCustomer()?.loyaltyPoints).toBe(100);
    expect(customerService.vouchers().some(v => v.code === 'WELCOME5')).toBe(true);
  });

  it('should earn loyalty points and stamps when completing a hawker order', () => {
    customerService.login('+65 9123 4567');
    const initialPts = customerService.currentCustomer()?.loyaltyPoints ?? 0;

    const mockOrder: Order = {
      id: 'cust-ord-99',
      orderNumber: 'HF-199',
      dailySequence: 199,
      diningOption: 'dine_in',
      tableOrBuzzerNumber: '14',
      items: [
        {
          id: 'item-1',
          menuItemId: 'chicken-rice-steamed',
          name: 'Signature Steamed Chicken Rice',
          basePrice: 6.50,
          quantity: 2,
          selectedModifiers: [],
          unitPriceWithModifiers: 6.50,
          totalPrice: 13.00
        }
      ],
      subtotal: 13.00,
      takeawayFee: 0,
      tax: 0,
      discount: 0,
      total: 13.00,
      paymentMethod: 'paynow',
      paymentStatus: 'paid',
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    customerService.recordCustomerOrder(
      mockOrder,
      'stall-ah-huat',
      'Ah Huat Hainanese Delights',
      '🍗'
    );

    // 13 dollars = 13 points
    expect(customerService.currentCustomer()?.loyaltyPoints).toBe(initialPts + 13);
    expect(customerService.customerOrders().length).toBeGreaterThan(0);
  });

  it('should redeem points for discount voucher', () => {
    customerService.login('+65 9123 4567');
    const prevPoints = customerService.currentCustomer()?.loyaltyPoints ?? 0;

    const redeemed = customerService.redeemPointsForVoucher(50, '$2 Off Any Dish', 2.00);
    expect(redeemed).toBe(true);
    expect(customerService.currentCustomer()?.loyaltyPoints).toBe(prevPoints - 50);
    expect(customerService.vouchers().some(v => v.title === '$2 Off Any Dish')).toBe(true);
  });

  it('should list all available hawker stalls for diners', () => {
    const stalls = authService.allStalls();
    expect(stalls.length).toBeGreaterThan(0);
  });
});
