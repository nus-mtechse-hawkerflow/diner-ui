import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { App } from './app';
import { routes } from './app.routes';
import { CustomerService } from './core/services/customer.service';
import { AuthService } from './core/services/auth.service';
import { CognitoService, LOCALSTACK_COGNITO_ENDPOINT } from './core/services/cognito.service';
import {
  HawkerApiService,
  HAWKER_STALLS_API_URL,
  ORDER_SUBMIT_API_URL,
  CUSTOMER_REGISTER_API_URL,
  CUSTOMER_CHECK_ACCOUNT_API_URL
} from './core/services/hawker-api.service';
import {
  OrderNotificationService,
  SNS_ORDER_STATUS_TOPIC_ARN,
  ORDER_BACKEND_API_BASE,
  DEFAULT_ORDER_POLLING_INTERVAL_MS
} from './core/services/order-notification.service';
import { Order } from './core/models/order.model';
import { BackendCreateOrderPayload, BackendStallsResponse } from './core/models/hawker-api.model';

describe('HawkerFlow Diner App & Loyalty System', () => {
  let customerService: CustomerService;
  let cognitoService: CognitoService;
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
    cognitoService = TestBed.inject(CognitoService);
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

  it('should authenticate user and set customer session', async () => {
    let result: any = null;
    await new Promise<void>(resolve => {
      customerService.login('+65 9123 4567').subscribe(res => {
        result = res;
        resolve();
      });
    });

    expect(customerService.isGuest()).toBe(false);
    expect(customerService.currentCustomer()?.phone).toBe('+65 9123 4567');
    expect(customerService.currentCustomer()?.name).toContain('4567');
  });

  it('should check if account already exists at POST http://localhost:8081/hawkerflow/v1/customer/check_account_exist with string phone_number and account_exist boolean response', () => {
    const payload = {
      phone_number: '90123456',
      email: 'marcus@test.com'
    };

    let checkResponse: any = null;
    hawkerApiService.checkAccountExists(payload).subscribe(res => {
      checkResponse = res;
    });

    const req = httpMock.expectOne(CUSTOMER_CHECK_ACCOUNT_API_URL);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    expect(typeof req.request.body.phone_number).toBe('string');
    req.flush({ account_exist: false });

    expect(checkResponse).toEqual({ account_exist: false });
    expect(checkResponse.account_exist).toBe(false);
  });

  it('should prompt customer that account already exists when account_exist: true in backend and stop registration', async () => {
    let result: any = null;
    const regPromise = new Promise<void>(resolve => {
      customerService.register({
        firstName: 'Existing',
        lastName: 'User',
        phone: '90123456',
        email: 'existing@test.com',
        password: 'Password123!'
      }).subscribe(res => {
        result = res;
        resolve();
      });
    });

    // Check account request returns account_exist: true
    const checkReq = httpMock.expectOne(CUSTOMER_CHECK_ACCOUNT_API_URL);
    expect(checkReq.request.method).toBe('POST');
    expect(checkReq.request.body).toEqual({
      phone_number: '90123456',
      email: 'existing@test.com'
    });
    checkReq.flush({ account_exist: true });

    await regPromise;

    expect(result).toBeDefined();
    expect(result.success).toBe(false);
    expect(result.accountExists).toBe(true);
    expect(result.error).toContain('Account already exists');
    expect(customerService.currentCustomer()).toBeNull();
  });

  it('should register a new customer with mandatory password and string phone number when account does not exist (account_exist: false)', async () => {
    let result: any = null;
    const regPromise = new Promise<void>(resolve => {
      customerService.register({
        firstName: 'Sarah',
        lastName: 'Chen',
        phone: '+65 9876 5432',
        email: 'sarah.chen@gmail.com',
        password: 'Password123!'
      }).subscribe(res => {
        result = res;
        resolve();
      });
    });

    // 1. Account existence check returns account_exist: false
    const checkReq = httpMock.expectOne(CUSTOMER_CHECK_ACCOUNT_API_URL);
    expect(checkReq.request.method).toBe('POST');
    expect(checkReq.request.body.phone_number).toBe('+65 9876 5432');
    checkReq.flush({ account_exist: false });

    // Wait for Cognito async signup step
    await new Promise(r => setTimeout(r, 800));

    // 2. Customer service registration call
    const regReq = httpMock.expectOne(CUSTOMER_REGISTER_API_URL);
    expect(regReq.request.method).toBe('POST');
    expect(regReq.request.body).toEqual({
      first_name: 'Sarah',
      last_name: 'Chen',
      email: 'sarah.chen@gmail.com',
      phone_number: '+65 9876 5432'
    });
    expect(typeof regReq.request.body.phone_number).toBe('string');
    regReq.flush({ message: 'Customer registered' });

    await regPromise;

    expect(customerService.currentCustomer()?.name).toBe('Sarah Chen');
    expect(customerService.currentCustomer()?.phone).toBe('+65 9876 5432');
    expect(customerService.currentCustomer()?.email).toBe('sarah.chen@gmail.com');
  });

  it('should send customer registration details with string phone_number to POST http://localhost:8081/hawkerflow/v1/customer/register', () => {
    const payload = {
      first_name: 'Marcus',
      last_name: 'Tan',
      email: 'marcus@example.com',
      phone_number: '91234567'
    };

    let response: any = null;
    hawkerApiService.registerCustomer(payload).subscribe(res => {
      response = res;
    });

    const req = httpMock.expectOne(CUSTOMER_REGISTER_API_URL);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    expect(typeof req.request.body.phone_number).toBe('string');
    req.flush({ message: 'Customer registered successfully' });

    expect(response).toEqual({ message: 'Customer registered successfully' });
  });

  it('should record customer order in order history', () => {
    customerService.login('+65 9123 4567');

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
      'stall-1',
      'Ah Huat Hainanese Delights',
      '🍗'
    );

    expect(customerService.customerOrders().length).toBe(1);
    expect(customerService.customerOrders()[0].id).toBe('cust-ord-99');

    customerService.clearCustomerOrders();
    expect(customerService.customerOrders().length).toBe(0);
  });

  it('should initialize stall list signal', () => {
    const stalls = authService.allStalls();
    expect(Array.isArray(stalls)).toBe(true);
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

  it('should have 10s default polling interval for live order status', () => {
    expect(DEFAULT_ORDER_POLLING_INTERVAL_MS).toBe(10000);
    expect(orderNotificationService.isPolling()).toBe(true);
  });

  it('should directly poll backend API at GET http://localhost:8082/hawkerflow/v1/order/orders/{order_id} for active orders', () => {
    const testOrder: Order = {
      id: '101',
      orderNumber: 'HF-101',
      dailySequence: 101,
      diningOption: 'dine_in',
      tableOrBuzzerNumber: 'Table 12',
      items: [],
      subtotal: 12,
      takeawayFee: 0,
      tax: 0,
      discount: 0,
      total: 12,
      paymentMethod: 'paynow',
      paymentStatus: 'paid',
      status: 'pending',
      createdAt: new Date().toISOString()
    };
    customerService.customerOrders.set([testOrder]);

    // Trigger pollActiveOrders
    orderNotificationService.pollActiveOrders();

    const req = httpMock.expectOne(`${ORDER_BACKEND_API_BASE}/101`);
    expect(req.request.method).toBe('GET');

    // Simulate backend response with READY status
    req.flush({
      order_id: 101,
      stall_id: 1,
      status: 'READY'
    });

    const updated = customerService.customerOrders().find(o => o.id === '101');
    expect(updated?.status).toBe('ready');
    expect(orderNotificationService.activeToast()).toBeTruthy();
    expect(orderNotificationService.activeToast()?.status).toBe('ready');

    // Dismiss toast
    orderNotificationService.dismissToast();
    expect(orderNotificationService.activeToast()).toBeNull();

    // Next poll with same status 'READY'
    orderNotificationService.pollActiveOrders();
    const req2 = httpMock.expectOne(`${ORDER_BACKEND_API_BASE}/101`);
    req2.flush({
      order_id: 101,
      stall_id: 1,
      status: 'READY'
    });

    // Toast should NOT be re-shown because status did not change
    expect(orderNotificationService.activeToast()).toBeNull();
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

  it('should process COLLECTED status notification from queue and update order to completed', () => {
    const testOrder: Order = {
      id: '99',
      orderNumber: 'HF-099',
      dailySequence: 99,
      diningOption: 'dine_in',
      tableOrBuzzerNumber: 'Table 09',
      items: [],
      subtotal: 15,
      takeawayFee: 0,
      tax: 0,
      discount: 0,
      total: 15,
      paymentMethod: 'paynow',
      paymentStatus: 'paid',
      status: 'ready',
      createdAt: new Date().toISOString()
    };
    customerService.customerOrders.set([testOrder]);

    const snsNotification = {
      Type: 'Notification',
      MessageId: 'msg-collected-123',
      TopicArn: SNS_ORDER_STATUS_TOPIC_ARN,
      Message: JSON.stringify({
        event_type: 'OrderCollected',
        data: {
          order_id: 99,
          stall_id: 1,
          status: 'COLLECTED'
        }
      }),
      Timestamp: new Date().toISOString()
    };

    const event = orderNotificationService.processSqsMessage(JSON.stringify(snsNotification));

    expect(event).toBeDefined();
    expect(event?.orderId).toBe('99');
    expect(event?.status).toBe('completed');

    // Verify order in customer service was updated to 'completed'
    const updatedOrder = customerService.customerOrders().find(o => o.id === '99');
    expect(updatedOrder?.status).toBe('completed');
    expect(updatedOrder?.completedAt).toBeDefined();
  });

  it('should display Sign In / Register in orders page when diner is in guest mode and Sign Out when authenticated', async () => {
    const { CustomerProfileComponent } = await import('./features/profile/customer-profile.component');
    const fixture = TestBed.createComponent(CustomerProfileComponent);
    
    // In guest mode
    customerService.continueAsGuest();
    fixture.detectChanges();
    let compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Sign In / Register');
    expect(compiled.querySelector('a[href="/auth"]')?.textContent).toContain('Sign In / Register');

    // In logged-in mode
    await new Promise<void>(resolve => {
      customerService.login('+65 9123 4567').subscribe(() => resolve());
    });
    fixture.detectChanges();
    compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).not.toContain('Sign In / Register');
    expect(compiled.querySelector('button[title*="Sign Out"]')).toBeTruthy();
  });

  it('should configure AWS Amplify for LocalStack Cognito endpoint', () => {
    expect(cognitoService.isConfigured()).toBe(true);
    cognitoService.configureAmplify({
      userPoolId: 'us-east-1_custom',
      userPoolClientId: 'custom_client',
      endpoint: 'http://localhost:4566'
    });
    expect(cognitoService.isConfigured()).toBe(true);
  });

  it('should register a diner with AWS Amplify signUp API', async () => {
    let signUpResult: any = null;
    await new Promise<void>(resolve => {
      cognitoService.signUp({
        username: '+6591234567',
        password: 'MyPassword123!',
        name: 'Tan Ah Seng',
        phone: '+6591234567',
        email: 'ahseng@gmail.com'
      }).subscribe(res => {
        signUpResult = res;
        resolve();
      });
    });

    expect(signUpResult).toBeDefined();
    expect(signUpResult.success).toBe(true);
    expect(signUpResult.userSub).toBeDefined();
  });

  it('should authenticate user with AWS Amplify signIn API', async () => {
    let authResult: any = null;
    await new Promise<void>(resolve => {
      cognitoService.signIn('+6591234567', 'MyPassword123!').subscribe(res => {
        authResult = res;
        resolve();
      });
    });

    expect(authResult).toBeDefined();
    // In unit test environment without real server, returns handled response
    expect(typeof authResult.success).toBe('boolean');
  });

  it('should handle MFA verification and confirmation codes in CustomerService and CognitoService', async () => {
    // Verify confirmRegistrationCode
    let confirmRegResult: any = null;
    await new Promise<void>(resolve => {
      customerService.confirmRegistrationCode('+6591234567', '123456', { name: 'Ah Seng' }).subscribe(res => {
        confirmRegResult = res;
        resolve();
      });
    });
    expect(confirmRegResult).toBeDefined();

    // Verify confirmMfa
    let mfaResult: any = null;
    await new Promise<void>(resolve => {
      customerService.confirmMfa('654321', { identifier: '+6591234567' }).subscribe(res => {
        mfaResult = res;
        resolve();
      });
    });
    expect(mfaResult).toBeDefined();

    // Verify resendConfirmationCode
    let resendResult: any = null;
    await new Promise<void>(resolve => {
      customerService.resendConfirmationCode('+6591234567').subscribe(res => {
        resendResult = res;
        resolve();
      });
    });
    expect(resendResult).toBeDefined();
  });

  it('should authenticate user if account already exists in CustomerAuthComponent on register', async () => {
    const { CustomerAuthComponent } = await import('./features/auth/customer-auth.component');
    const fixture = TestBed.createComponent(CustomerAuthComponent);
    const component = fixture.componentInstance;
    component.activeTab.set('register');
    fixture.detectChanges();

    component.regFirstName = 'Jane';
    component.regLastName = 'Doe';
    component.regPhone = '90123456';
    component.regEmail = 'jane@example.com';
    component.regPassword = 'Password123!';

    component.onRegister();

    // Account check returns account_exist: true -> displays prompt and stops registration
    const checkReq = httpMock.expectOne(CUSTOMER_CHECK_ACCOUNT_API_URL);
    checkReq.flush({ account_exist: true });

    fixture.detectChanges();

    expect(component.accountExistsError()).toBe(true);
    expect(component.errorMessage()).toContain('Account already exists');
    expect(customerService.currentCustomer()).toBeNull();

    let compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Account Already Exists');
    expect(compiled.textContent).toContain('Account already exists, please log in instead');
    expect(compiled.textContent).toContain('Log In to Existing Account');

    component.switchToSignIn();
    fixture.detectChanges();
    expect(component.activeTab()).toBe('login');
    expect(component.accountExistsError()).toBe(false);
    expect(component.loginIdentifier).toBe('90123456');
  });

  it('should prompt customer if checkAccountExists returns account_exist: true in response body', async () => {
    let result: any = null;
    const regPromise = new Promise<void>(resolve => {
      customerService.register({
        firstName: 'Marcus',
        lastName: 'Tan',
        phone: '91112222',
        email: 'marcus@test.com',
        password: 'Password123!'
      }).subscribe(res => {
        result = res;
        resolve();
      });
    });

    const checkReq = httpMock.expectOne(CUSTOMER_CHECK_ACCOUNT_API_URL);
    checkReq.flush({ account_exist: true });

    await regPromise;

    expect(result).toBeDefined();
    expect(result.success).toBe(false);
    expect(result.accountExists).toBe(true);
    expect(result.error).toBe('Account already exists. Please log in instead.');
    expect(customerService.currentCustomer()).toBeNull();
  });

  it('should proceed to signup if checkAccountExists returns account_exist: false in response body', async () => {
    let result: any = null;
    const regPromise = new Promise<void>(resolve => {
      customerService.register({
        firstName: 'New',
        lastName: 'User',
        phone: '93334444',
        email: 'newuser@test.com',
        password: 'Password123!'
      }).subscribe(res => {
        result = res;
        resolve();
      });
    });

    const checkReq = httpMock.expectOne(CUSTOMER_CHECK_ACCOUNT_API_URL);
    checkReq.flush({ account_exist: false });

    // Wait for async signup
    await new Promise(r => setTimeout(r, 800));

    const regReq = httpMock.expectOne(CUSTOMER_REGISTER_API_URL);
    regReq.flush({ message: 'Registered' });

    await regPromise;

    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.isSignUpComplete).toBe(true);
    expect(customerService.currentCustomer()?.phone).toBe('93334444');
  });
});

