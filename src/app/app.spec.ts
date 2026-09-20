import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { App } from './app';
import { routes } from './app.routes';
import { CustomerService } from './core/services/customer.service';
import { AuthService } from './core/services/auth.service';
import { HawkerApiService, HAWKER_STALLS_API_URL, ORDER_SUBMIT_API_URL } from './core/services/hawker-api.service';
import { OrderNotificationService, SNS_ORDER_STATUS_TOPIC_ARN } from './core/services/order-notification.service';
import { Order } from './core/models/order.model';
import { BackendCreateOrderPayload, BackendStallsResponse } from './core/models/hawker-api.model';

describe('HawkerFlow Diner App & Loyalty System', () => {
  let customerService: CustomerService;
  let authService: AuthService;
  let hawkerApiService: HawkerApiService;
  let orderNotificationService: OrderNotificationService;
  let httpMock: HttpTestingController;
  let router: Router;

  beforeEach(async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter(routes),
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    }).compileComponents();

    customerService = TestBed.inject(CustomerService);
    authService = TestBed.inject(AuthService);
    hawkerApiService = TestBed.inject(HawkerApiService);
    orderNotificationService = TestBed.inject(OrderNotificationService);
    httpMock = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);

    // Flush initial requests
    const initialReqs = httpMock.match(() => true);
    initialReqs.forEach(req => req.flush({}));
  });

  afterEach(() => {
    const remaining = httpMock.match(() => true);
    remaining.forEach(r => r.flush({}));
    httpMock.verify();
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

  it('should fetch hawker stalls from GET http://localhost:8080/hawkerflow/v1/hawker/stalls and map correctly', () => {
    const mockBackendResponse: BackendStallsResponse = {
      stalls: [
        {
          stall_name: 'Nasi Lemak Stall',
          stall_description: 'I sell fragrant Nasi Lemak',
          stall_menu: [
            {
              f_menu_name: 'Royal Nasi Lemak',
              f_menu_id: 101,
              f_menu_description: 'Rich coconut rice with sambal',
              f_menu_price: 5.5,
              f_stall_id: 1
            }
          ],
          stall_owner: [
            {
              f_stall_owner_phone: '+65 9123 0000',
              f_stall_owner_id: 1,
              f_stall_owner_name: 'Uncle Tan',
              f_stall_id: 1
            }
          ]
        }
      ]
    };

    hawkerApiService.getStalls().subscribe(stalls => {
      expect(stalls.length).toBe(1);
      expect(stalls[0].stallName).toBe('Nasi Lemak Stall');
      expect(stalls[0].numericId).toBe(1);
      expect(stalls[0].initialMenuItems?.length).toBe(1);
      expect(stalls[0].initialMenuItems?.[0].numericDishId).toBe(101);
      expect(stalls[0].initialMenuItems?.[0].basePrice).toBe(5.5);
    });

    const req = httpMock.expectOne(HAWKER_STALLS_API_URL);
    expect(req.request.method).toBe('GET');
    req.flush(mockBackendResponse);
  });

  it('should submit order to POST http://localhost:8082/hawkerflow/v1/order/orders with correct payload', () => {
    const payload: BackendCreateOrderPayload = {
      orders: [
        {
          stall_id: 1,
          dishes: [
            {
              dish_id: 101,
              quantity: 2,
              price: 11.0
            }
          ]
        }
      ],
      total_price: 11.0
    };

    const mockOrderResponse = {
      message: 'Order submitted',
      order_id: 42,
      total_price: 11.0,
      order_status: 'PENDING',
      order_created_at: '2026-09-20 14:50:00'
    };

    hawkerApiService.createOrder(payload).subscribe(res => {
      expect(res.order_id).toBe(42);
      expect(res.order_status).toBe('PENDING');
      expect(res.total_price).toBe(11.0);
    });

    const req = httpMock.expectOne(ORDER_SUBMIT_API_URL);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush(mockOrderResponse);
  });

  it('should process incoming AWS SNS order status notification and update order state', () => {
    // Setup an active order in customer service
    const testOrder: Order = {
      id: '42',
      orderNumber: 'HF-042',
      dailySequence: 42,
      diningOption: 'dine_in',
      tableOrBuzzerNumber: 'Table 01',
      items: [],
      subtotal: 10,
      takeawayFee: 0,
      tax: 0,
      discount: 0,
      total: 10,
      paymentMethod: 'paynow',
      paymentStatus: 'paid',
      status: 'pending',
      createdAt: new Date().toISOString()
    };
    customerService.customerOrders.set([testOrder]);

    const snsNotification = {
      Type: 'Notification',
      MessageId: 'msg-12345',
      TopicArn: SNS_ORDER_STATUS_TOPIC_ARN,
      Message: JSON.stringify({
        event_type: 'OrderReady',
        data: {
          order_id: 42,
          stall_id: 1,
          status: 'READY'
        }
      }),
      Timestamp: new Date().toISOString()
    };

    const event = orderNotificationService.processSqsMessage(JSON.stringify(snsNotification));

    expect(event).toBeDefined();
    expect(event?.orderId).toBe('42');
    expect(event?.status).toBe('ready');
    expect(event?.eventType).toBe('OrderReady');

    // Verify order in customer service was updated to 'ready'
    const updatedOrder = customerService.customerOrders().find(o => o.id === '42');
    expect(updatedOrder?.status).toBe('ready');

    // Verify active toast was triggered
    expect(orderNotificationService.activeToast()).toBeTruthy();
    expect(orderNotificationService.activeToast()?.orderNumber).toBe('HF-042');
    expect(orderNotificationService.activeToast()?.status).toBe('ready');
  });

  it('should process OrderAccepted status notification and display preparation toast', () => {
    const testOrder: Order = {
      id: '55',
      orderNumber: 'HF-055',
      dailySequence: 55,
      diningOption: 'dine_in',
      tableOrBuzzerNumber: 'Table 05',
      items: [],
      subtotal: 15,
      takeawayFee: 0,
      tax: 0,
      discount: 0,
      total: 15,
      paymentMethod: 'paynow',
      paymentStatus: 'paid',
      status: 'pending',
      createdAt: new Date().toISOString()
    };
    customerService.customerOrders.set([testOrder]);

    const snsNotification = {
      Type: 'Notification',
      MessageId: 'msg-67890',
      TopicArn: SNS_ORDER_STATUS_TOPIC_ARN,
      Message: JSON.stringify({
        event_type: 'OrderAccepted',
        data: {
          order_id: 55,
          stall_id: 1,
          status: 'ACCEPTED'
        }
      }),
      Timestamp: new Date().toISOString()
    };

    const event = orderNotificationService.processSqsMessage(JSON.stringify(snsNotification));

    expect(event).toBeDefined();
    expect(event?.orderId).toBe('55');
    expect(event?.status).toBe('preparing');
    expect(event?.eventType).toBe('OrderAccepted');

    // Verify order in customer service was updated to 'preparing'
    const updatedOrder = customerService.customerOrders().find(o => o.id === '55');
    expect(updatedOrder?.status).toBe('preparing');

    // Verify active toast reflects accepted status
    expect(orderNotificationService.activeToast()).toBeTruthy();
    expect(orderNotificationService.activeToast()?.message).toContain('ACCEPTED');
  });

  it('should process OrderCompleted notification and update customer order status to completed', () => {
    const testOrder: Order = {
      id: '88',
      orderNumber: 'HF-088',
      dailySequence: 88,
      diningOption: 'dine_in',
      tableOrBuzzerNumber: 'Table 08',
      items: [],
      subtotal: 20,
      takeawayFee: 0,
      tax: 0,
      discount: 0,
      total: 20,
      paymentMethod: 'paynow',
      paymentStatus: 'paid',
      status: 'ready',
      createdAt: new Date().toISOString()
    };
    customerService.customerOrders.set([testOrder]);

    const snsNotification = {
      Type: 'Notification',
      MessageId: 'msg-99999',
      TopicArn: SNS_ORDER_STATUS_TOPIC_ARN,
      Message: JSON.stringify({
        event_type: 'OrderCompleted',
        data: {
          order_id: 88,
          stall_id: 1,
          status: 'COMPLETED'
        }
      }),
      Timestamp: new Date().toISOString()
    };

    const event = orderNotificationService.processSqsMessage(JSON.stringify(snsNotification));

    expect(event).toBeDefined();
    expect(event?.orderId).toBe('88');
    expect(event?.status).toBe('completed');

    // Verify order in customer service was updated to 'completed' with completedAt
    const updatedOrder = customerService.customerOrders().find(o => o.id === '88');
    expect(updatedOrder?.status).toBe('completed');
    expect(updatedOrder?.completedAt).toBeDefined();
  });
});
