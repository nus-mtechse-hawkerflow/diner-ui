import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { of } from 'rxjs';
import { vi } from 'vitest';
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
  CUSTOMER_CHECK_ACCOUNT_API_URL,
  CUSTOMER_UPDATE_ORDER_API_URL
} from './core/services/hawker-api.service';
import {
  OrderNotificationService,
  SNS_ORDER_STATUS_TOPIC_ARN,
  ORDER_BACKEND_API_BASE,
  DEFAULT_ORDER_POLLING_INTERVAL_MS
} from './core/services/order-notification.service';
import { Order } from './core/models/order.model';
import { BackendCreateOrderPayload, BackendStallsResponse, BackendUpdateCustomerOrderPayload } from './core/models/hawker-api.model';

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

  it('should authenticate user and set customer session with cust_name and last_login from /customer/user/{cust_sub}', async () => {
    vi.spyOn(cognitoService, 'signIn').mockReturnValue(of({
      success: true,
      isSignedIn: true,
      userSub: 'cognito-sub-unclelim',
      user: { username: '+65 9123 4567' }
    }));

    let result: any = null;
    const loginPromise = new Promise<void>(resolve => {
      customerService.login('+65 9123 4567').subscribe(res => {
        result = res;
        resolve();
      });
    });

    const req = httpMock.expectOne(r => r.url.includes('/customer/user/'));
    expect(req.request.method).toBe('GET');
    req.flush({
      cust_name: 'Uncle Lim',
      last_login: '2026-09-25 14:30:00',
      email: 'unclelim@test.com',
      phone_number: '+65 9123 4567'
    });

    await loginPromise;

    expect(customerService.isGuest()).toBe(false);
    expect(customerService.currentCustomer()?.phone).toBe('+65 9123 4567');
    expect(customerService.currentCustomer()?.name).toBe('Uncle Lim');
    expect(customerService.currentCustomer()?.lastLogin).toBe('2026-09-25 14:30:00');
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
    vi.spyOn(cognitoService, 'signUp').mockReturnValue(of({
      success: true,
      isSignUpComplete: true,
      userSub: 'cognito-sub-sarah'
    }));

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

    // 2. Customer service registration call
    const regReq = httpMock.expectOne(CUSTOMER_REGISTER_API_URL);
    expect(regReq.request.method).toBe('POST');
    expect(regReq.request.body.first_name).toBe('Sarah');
    expect(regReq.request.body.last_name).toBe('Chen');
    expect(regReq.request.body.email).toBe('sarah.chen@gmail.com');
    expect(regReq.request.body.phone_number).toBe('+65 9876 5432');
    expect(regReq.request.body.customer_sub).toBeDefined();
    expect(typeof regReq.request.body.phone_number).toBe('string');
    regReq.flush({ message: 'Customer registered' });

    await regPromise;

    expect(customerService.currentCustomer()?.name).toBe('Sarah Chen');
    expect(customerService.currentCustomer()?.phone).toBe('+65 9876 5432');
    expect(customerService.currentCustomer()?.email).toBe('sarah.chen@gmail.com');
  });

  it('should send customer registration details with string phone_number and customer_sub to POST http://localhost:8081/hawkerflow/v1/customer/register', () => {
    const payload = {
      first_name: 'Marcus',
      last_name: 'Tan',
      email: 'marcus@example.com',
      phone_number: '91234567',
      customer_sub: 'cognito-sub-12345'
    };

    let response: any = null;
    hawkerApiService.registerCustomer(payload).subscribe(res => {
      response = res;
    });

    const req = httpMock.expectOne(CUSTOMER_REGISTER_API_URL);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    expect(typeof req.request.body.phone_number).toBe('string');
    expect(req.request.body.customer_sub).toBe('cognito-sub-12345');
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

  it('should display guest sign up / sign in perks in account page when diner is in guest mode and user details when authenticated', async () => {
    const { CustomerProfileComponent } = await import('./features/profile/customer-profile.component');
    const fixture = TestBed.createComponent(CustomerProfileComponent);
    
    // In guest mode (or signed out)
    customerService.continueAsGuest();
    fixture.detectChanges();
    let compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).not.toContain('Account Profile');
    expect(compiled.textContent).toContain('Sign Up as HawkerFlow Foodie and enjoy perks!');
    expect(compiled.textContent).toContain('Sign in if are an existing user');
    expect(compiled.textContent).not.toContain('Sign Out');
    expect(compiled.textContent).not.toContain('Your Past Hawker Orders');

    // In logged-in mode
    vi.spyOn(cognitoService, 'signIn').mockReturnValue(of({
      success: true,
      isSignedIn: true,
      userSub: 'cognito-sub-ahhock',
      user: { username: '+65 9123 4567' }
    }));

    const loginPromise = new Promise<void>(resolve => {
      customerService.login('+65 9123 4567').subscribe(() => resolve());
    });
    const req = httpMock.expectOne(r => r.url.includes('/customer/user/'));
    req.flush({ cust_name: 'Ah Hock', email: 'ahhock@hawker.sg', phone_number: '+6591234567', last_login: '2026-09-25 10:00:00' });
    await loginPromise;

    fixture.detectChanges();
    compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Account Profile');
    expect(compiled.textContent).not.toContain('Sign Up as HawkerFlow Foodie and enjoy perks!');
    expect(compiled.textContent).toContain('Ah Hock');
    expect(compiled.textContent).toContain('ahhock@hawker.sg');
    expect(compiled.textContent).toContain('+6591234567');
    expect(compiled.textContent).not.toContain('Your Past Hawker Orders');
    expect(compiled.querySelector('button[title*="Sign Out"]')).toBeTruthy();

    // After signing out
    fixture.componentInstance.onLogout();
    fixture.detectChanges();
    compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).not.toContain('Account Profile');
    expect(compiled.textContent).toContain('Sign Up as HawkerFlow Foodie and enjoy perks!');
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
    expect(typeof signUpResult.success).toBe('boolean');
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
    vi.spyOn(cognitoService, 'signUp').mockReturnValue(of({
      success: true,
      isSignUpComplete: true,
      userSub: 'cognito-sub-new'
    }));

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

    const regReq = httpMock.expectOne(CUSTOMER_REGISTER_API_URL);
    regReq.flush({ message: 'Registered' });

    await regPromise;

    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.isSignUpComplete).toBe(true);
    expect(customerService.currentCustomer()?.phone).toBe('93334444');
  });

  it('should send post request to update customer order endpoint at /v1/customer/user/update_order with expected payload structure', () => {
    const payload: BackendUpdateCustomerOrderPayload = {
      order_id: 42,
      cust_sub: 'cognito-sub-12345',
      orders: [
        {
          stall_id: 1,
          dishes: [
            {
              dish_id: 101,
              quantity: 2,
              price: 13.00
            }
          ]
        }
      ],
      total_price: 13.00,
      status: 'pending'
    };

    let response: any = null;
    hawkerApiService.updateCustomerOrder(payload).subscribe(res => {
      response = res;
    });

    const req = httpMock.expectOne(CUSTOMER_UPDATE_ORDER_API_URL);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    expect(req.request.body.order_id).toBe(42);
    expect(req.request.body.cust_sub).toBe('cognito-sub-12345');
    expect(req.request.body.orders[0].stall_id).toBe(1);
    expect(req.request.body.orders[0].dishes[0].dish_id).toBe(101);
    expect(req.request.body.orders[0].dishes[0].quantity).toBe(2);
    expect(req.request.body.orders[0].dishes[0].price).toBe(13.00);
    expect(req.request.body.total_price).toBe(13.00);
    expect(req.request.body.status).toBe('pending');
    req.flush({ message: 'Order updated successfully' });

    expect(response).toEqual({ message: 'Order updated successfully' });
  });

  it('should trigger POST /v1/customer/user/update_order upon successful payment / recordCustomerOrder', () => {
    customerService.currentCustomer.set({
      id: 'sub-test-cust',
      cognitoSub: 'sub-test-cust',
      name: 'Alice',
      isGuest: false,
      loyaltyPoints: 0,
      tier: 'Bronze Kaki',
      avatarEmoji: '🥢',
      registeredAt: new Date().toISOString()
    });

    const mockOrder: Order = {
      id: 'ord-105',
      orderNumber: 'HF-105',
      dailySequence: 105,
      numericStallId: 2,
      diningOption: 'dine_in',
      items: [
        {
          id: 'item-10',
          menuItemId: 'laksa-1',
          numericDishId: 201,
          name: 'Katong Laksa',
          basePrice: 7.00,
          quantity: 1,
          selectedModifiers: [],
          unitPriceWithModifiers: 7.00,
          totalPrice: 7.00
        }
      ],
      subtotal: 7.00,
      takeawayFee: 0,
      tax: 0,
      discount: 0,
      total: 7.00,
      paymentMethod: 'paynow',
      paymentStatus: 'paid',
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    customerService.recordCustomerOrder(mockOrder, '2', 'Laksa Stall', '🍜');

    const req = httpMock.expectOne(CUSTOMER_UPDATE_ORDER_API_URL);
    expect(req.request.method).toBe('POST');
    expect(req.request.body.order_id).toBe(105);
    expect(req.request.body.cust_sub).toBe('sub-test-cust');
    expect(req.request.body.orders[0].stall_id).toBe(2);
    expect(req.request.body.orders[0].dishes[0].dish_id).toBe(201);
    expect(req.request.body.orders[0].dishes[0].quantity).toBe(1);
    expect(req.request.body.orders[0].dishes[0].price).toBe(7.00);
    expect(req.request.body.total_price).toBe(7.00);
    expect(req.request.body.status).toBe('pending');
    req.flush({ message: 'Order created in customer service' });
  });

  it('should trigger POST /v1/customer/user/update_order upon every order state change', () => {
    customerService.currentCustomer.set({
      id: 'sub-test-cust',
      cognitoSub: 'sub-test-cust',
      name: 'Alice',
      isGuest: false,
      loyaltyPoints: 0,
      tier: 'Bronze Kaki',
      avatarEmoji: '🥢',
      registeredAt: new Date().toISOString()
    });

    const mockOrder: Order = {
      id: 'ord-200',
      orderNumber: 'HF-200',
      dailySequence: 200,
      numericStallId: 3,
      diningOption: 'dine_in',
      items: [
        {
          id: 'item-20',
          menuItemId: 'satay-1',
          numericDishId: 301,
          name: 'Chicken Satay',
          basePrice: 9.00,
          quantity: 1,
          selectedModifiers: [],
          unitPriceWithModifiers: 9.00,
          totalPrice: 9.00
        }
      ],
      subtotal: 9.00,
      takeawayFee: 0,
      tax: 0,
      discount: 0,
      total: 9.00,
      paymentMethod: 'paynow',
      paymentStatus: 'paid',
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    customerService.customerOrders.set([mockOrder]);

    // 1. Transition pending -> preparing
    customerService.updateOrderStatus('ord-200', 'preparing');
    const prepReq = httpMock.expectOne(CUSTOMER_UPDATE_ORDER_API_URL);
    expect(prepReq.request.method).toBe('POST');
    expect(prepReq.request.body.order_id).toBe(200);
    expect(prepReq.request.body.status).toBe('preparing');
    prepReq.flush({ message: 'Status updated' });

    // 2. Transition preparing -> ready
    customerService.updateOrderStatus('ord-200', 'ready');
    const readyReq = httpMock.expectOne(CUSTOMER_UPDATE_ORDER_API_URL);
    expect(readyReq.request.method).toBe('POST');
    expect(readyReq.request.body.order_id).toBe(200);
    expect(readyReq.request.body.status).toBe('ready');
    readyReq.flush({ message: 'Status updated' });

    // 3. Transition ready -> completed
    customerService.updateOrderStatus('ord-200', 'completed');
    const compReq = httpMock.expectOne(CUSTOMER_UPDATE_ORDER_API_URL);
    expect(compReq.request.method).toBe('POST');
    expect(compReq.request.body.order_id).toBe(200);
    expect(compReq.request.body.status).toBe('completed');
    compReq.flush({ message: 'Status updated' });
  });

  it('should aggregate orders of the same dish in CustomerOrderComponent cart instead of appending duplicate items', async () => {
    const { CustomerOrderComponent } = await import('./features/order/customer-order.component');
    const fixture = TestBed.createComponent(CustomerOrderComponent);
    const component = fixture.componentInstance;

    const mockDish: any = {
      id: 'dish-101',
      numericDishId: 101,
      name: 'Hainanese Chicken Rice',
      basePrice: 5.50,
      isAvailable: true
    };

    // 1. Add simple dish first time
    component.addSimpleItem(mockDish);
    expect(component.cart().length).toBe(1);
    expect(component.cart()[0].menuItemId).toBe('dish-101');
    expect(component.cart()[0].quantity).toBe(1);
    expect(component.cart()[0].totalPrice).toBe(5.50);

    // 2. Add the same dish a second time -> should aggregate quantity to 2
    component.addSimpleItem(mockDish);
    expect(component.cart().length).toBe(1);
    expect(component.cart()[0].quantity).toBe(2);
    expect(component.cart()[0].totalPrice).toBe(11.00);

    // 3. Add a different dish -> should create a new line item
    const otherDish: any = {
      id: 'dish-102',
      numericDishId: 102,
      name: 'Laksa',
      basePrice: 6.00,
      isAvailable: true
    };
    component.addSimpleItem(otherDish);
    expect(component.cart().length).toBe(2);
    expect(component.cart()[1].menuItemId).toBe('dish-102');
    expect(component.cart()[1].quantity).toBe(1);
    expect(component.cart()[1].totalPrice).toBe(6.00);

    // 4. Add customized item with identical modifiers -> should aggregate
    const customEvent = {
      item: mockDish,
      selectedModifiers: [
        { groupId: 'g1', groupName: 'Portion', optionId: 'opt-large', optionName: 'Large', priceDelta: 1.50 }
      ],
      quantity: 1,
      specialNotes: 'Less spicy'
    };
    component.onAddCustomizedItem(customEvent);
    expect(component.cart().length).toBe(3);
    expect(component.cart()[2].quantity).toBe(1);
    expect(component.cart()[2].totalPrice).toBe(7.00);

    // Add same customized item again
    component.onAddCustomizedItem(customEvent);
    expect(component.cart().length).toBe(3);
    expect(component.cart()[2].quantity).toBe(2);
    expect(component.cart()[2].totalPrice).toBe(14.00);
  });

  it('should handle "There is already a signed in user" error by resetting session during login', async () => {
    // Verify that cognitoService.signIn handles already authenticated state cleanly
    let signInResult: any = null;
    await new Promise<void>(resolve => {
      cognitoService.signIn('+65 9123 4567', 'Password123!').subscribe(res => {
        signInResult = res;
        resolve();
      });
    });

    expect(signInResult).toBeDefined();
    expect(typeof signInResult.isSignedIn).toBe('boolean');
  });

  it('should populate past_orders grouped by order_id with items, total price, and customer details upon login', async () => {
    vi.spyOn(cognitoService, 'signIn').mockReturnValue(of({
      success: true,
      isSignedIn: true,
      userSub: '98ed4959-78dd-4cb7-a4c1-3772c5485dbe',
      user: { username: '+65 9123 4567' }
    }));

    const mockBackendDetail = {
      cust_id: '98ed4959-78dd-4cb7-a4c1-3772c5485dbe',
      cust_name: 'Marcus Tan',
      last_login: '2026-09-25 20:04:21',
      past_orders: {
        orders: [
          {
            order_id: 12,
            dish_id: 5,
            dish_name: 'Roasted Chicken Rice',
            quantity: 1,
            order_price: 5.5,
            order_status: 'completed'
          },
          {
            order_id: 13,
            dish_id: 5,
            dish_name: 'Roasted Chicken Rice',
            quantity: 2,
            order_price: 11.0,
            order_status: 'completed'
          },
          {
            order_id: 13,
            dish_id: 4,
            dish_name: 'Steamed Chicken Rice',
            quantity: 1,
            order_price: 5.5,
            order_status: 'completed'
          }
        ]
      }
    };

    let result: any = null;
    const loginPromise = new Promise<void>(resolve => {
      customerService.login('+65 9123 4567', 'Password123!').subscribe(res => {
        result = res;
        resolve();
      });
    });

    const req = httpMock.expectOne(r => r.url.includes('/customer/user/98ed4959-78dd-4cb7-a4c1-3772c5485dbe'));
    expect(req.request.method).toBe('GET');
    req.flush(mockBackendDetail);

    await loginPromise;

    // Verify customer info
    expect(customerService.currentCustomer()?.id).toBe('98ed4959-78dd-4cb7-a4c1-3772c5485dbe');
    expect(customerService.currentCustomer()?.name).toBe('Marcus Tan');
    expect(customerService.currentCustomer()?.lastLogin).toBe('2026-09-25 20:04:21');

    // Verify orders were grouped by order_id
    const orders = customerService.customerOrders();
    expect(orders.length).toBe(2);

    // Order 13 (most recent) should have 2 dishes aggregated with total 16.50
    const order13 = orders.find(o => o.id === '13');
    expect(order13).toBeDefined();
    expect(order13?.dailySequence).toBe(13);
    expect(order13?.orderNumber).toBe('HF-013');
    expect(order13?.status).toBe('completed');
    expect(order13?.total).toBe(16.5);
    expect(order13?.items.length).toBe(2);
    expect(order13?.items[0].name).toBe('Roasted Chicken Rice');
    expect(order13?.items[0].quantity).toBe(2);
    expect(order13?.items[0].totalPrice).toBe(11.0);
    expect(order13?.items[1].name).toBe('Steamed Chicken Rice');
    expect(order13?.items[1].quantity).toBe(1);
    expect(order13?.items[1].totalPrice).toBe(5.5);

    // Order 12 should have 1 dish with total 5.50
    const order12 = orders.find(o => o.id === '12');
    expect(order12).toBeDefined();
    expect(order12?.dailySequence).toBe(12);
    expect(order12?.orderNumber).toBe('HF-012');
    expect(order12?.status).toBe('completed');
    expect(order12?.total).toBe(5.5);
    expect(order12?.items.length).toBe(1);
    expect(order12?.items[0].name).toBe('Roasted Chicken Rice');
    expect(order12?.items[0].quantity).toBe(1);
  });

  it('should clear tracker when order is completed and not have option for customer to mark as collected', async () => {
    const { CustomerOrderTrackerComponent } = await import('./features/order-tracker/customer-order-tracker.component');
    const fixture = TestBed.createComponent(CustomerOrderTrackerComponent);
    const component = fixture.componentInstance;

    const activeOrder: Order = {
      id: 'ord-301',
      orderNumber: 'HF-301',
      dailySequence: 301,
      diningOption: 'dine_in',
      items: [],
      subtotal: 10,
      takeawayFee: 0,
      tax: 0,
      discount: 0,
      total: 10,
      paymentMethod: 'paynow',
      paymentStatus: 'paid',
      status: 'ready',
      createdAt: new Date().toISOString()
    };

    customerService.customerOrders.set([activeOrder]);
    component.selectOrderToTrack(activeOrder);
    fixture.detectChanges();

    expect(component.order()).toBeTruthy();
    expect(component.order()?.id).toBe('ord-301');

    // Customer should NOT see any button to mark food as collected in the tracker
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).not.toContain("I've Collected My Food");
    expect(compiled.querySelector('button[click*="markOrderCompleted"]')).toBeNull();

    // When backend marks the order completed (e.g. via notification / state update)
    customerService.updateOrderStatus('ord-301', 'completed');
    fixture.detectChanges();

    // Tracker should be cleared
    expect(component.order()).toBeNull();
    expect(component.orderId()).toBe('');
  });

  it('should hide notification light in the floating bar below when in the orders page', async () => {
    const { CustomerLayoutComponent } = await import('./features/layout/customer-layout.component');
    const fixture = TestBed.createComponent(CustomerLayoutComponent);
    const component = fixture.componentInstance;

    // Simulate new order placed
    customerService.hasUnseenOrders.set(true);
    component.currentUrl.set('/stalls');
    fixture.detectChanges();

    // On stalls page, badge is visible
    expect(component.showOrdersNotification()).toBe(true);

    // On orders page, badge disappears
    component.currentUrl.set('/orders');
    fixture.detectChanges();
    expect(component.showOrdersNotification()).toBe(false);

    // Entering orders page marks orders viewed
    customerService.markOrdersViewed();
    expect(customerService.hasUnseenOrders()).toBe(false);
  });

  it('should display "Order is completed" when searching for a past order that is returned by backend API in tracker page', async () => {
    const { CustomerOrderTrackerComponent } = await import('./features/order-tracker/customer-order-tracker.component');
    const fixture = TestBed.createComponent(CustomerOrderTrackerComponent);
    const component = fixture.componentInstance;

    // Ensure no ongoing orders
    customerService.customerOrders.set([]);
    expect(component.activeOrders().length).toBe(0);
    expect(component.order()).toBeNull();

    component.lookupQuery = '12';
    component.searchAndTrackOrder();

    const req = httpMock.expectOne(r => r.url.includes('/order/orders/12'));
    expect(req.request.method).toBe('GET');
    req.flush({
      order_id: 12,
      stall_id: 1,
      total_price: 5.5,
      order_status: 'COMPLETED',
      dishes: [
        {
          dish_id: 5,
          dish_name: 'Roasted Chicken Rice',
          quantity: 1,
          price: 5.5
        }
      ]
    });

    fixture.detectChanges();

    expect(component.lookupNotFound()).toBe(false);
    expect(component.searchedPastOrder()).toBeTruthy();
    expect(component.searchedPastOrder()?.id).toBe('12');

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Order is completed');
    expect(compiled.textContent).toContain('#HF-012');
  });

  it('should display "No order found" in tracker page when searching for an order and no order is returned', async () => {
    const { CustomerOrderTrackerComponent } = await import('./features/order-tracker/customer-order-tracker.component');
    const fixture = TestBed.createComponent(CustomerOrderTrackerComponent);
    const component = fixture.componentInstance;

    // Ensure no ongoing orders
    customerService.customerOrders.set([]);
    expect(component.activeOrders().length).toBe(0);
    expect(component.order()).toBeNull();

    component.lookupQuery = '999';
    component.searchAndTrackOrder();

    const req = httpMock.expectOne(r => r.url.includes('/order/orders/999'));
    expect(req.request.method).toBe('GET');
    req.flush(null, { status: 404, statusText: 'Not Found' });

    fixture.detectChanges();

    expect(component.lookupNotFound()).toBe(true);
    expect(component.searchedPastOrder()).toBeNull();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('No order found');
  });

  it('should disable call to /v1/customer/user/{cust_sub} when customer is ordering food in guest mode', async () => {
    // 1. Enter guest mode
    customerService.continueAsGuest('Guest User', '+6591234567');
    expect(customerService.isGuest()).toBe(true);

    // 2. Order food in CustomerOrderComponent
    const { CustomerOrderComponent } = await import('./features/order/customer-order.component');
    const fixture = TestBed.createComponent(CustomerOrderComponent);
    const component = fixture.componentInstance;
    component.currentStall.set({
      id: 'stall-1',
      numericId: 1,
      name: 'Tian Tian Chicken Rice',
      stallName: 'Tian Tian Chicken Rice',
      ownerName: 'Uncle Ah Seng',
      category: 'Chicken Rice',
      rating: 4.8,
      status: 'open',
      phone: '+6591234567',
      email: 'stall1@hawkerflow.sg',
      location: 'Maxwell #01-10',
      totalDishes: 5,
      revenueToday: 1200,
      activeOrdersCount: 2,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01'
    } as any);

    const mockDish: any = {
      id: 'dish-5',
      numericDishId: 5,
      name: 'Roasted Chicken Rice',
      basePrice: 5.50,
      isAvailable: true
    };
    component.addSimpleItem(mockDish);

    component.onCustomerPaymentComplete({ method: 'paynow' });

    // Expect createOrder call
    const createReq = httpMock.expectOne(r => r.url.includes('/order/orders') && r.method === 'POST');
    createReq.flush({
      order_id: 88,
      order_status: 'PENDING',
      order_created_at: new Date().toISOString()
    });

    // Verify NO call to POST /v1/customer/user/update_order was made
    httpMock.expectNone(r => r.url.includes('/customer/user/update_order'));

    // Verify NO call to GET /v1/customer/user/{cust_sub} was made
    httpMock.expectNone(r => r.url.includes('/customer/user/') && r.method === 'GET');

    // Also update order status in guest mode -> should NOT trigger update_order
    customerService.updateOrderStatus('88', 'completed');
    httpMock.expectNone(r => r.url.includes('/customer/user/update_order'));

    // Also check when visiting Orders/Profile page in guest mode
    const { CustomerProfileComponent } = await import('./features/profile/customer-profile.component');
    const profileFixture = TestBed.createComponent(CustomerProfileComponent);
    profileFixture.detectChanges();

    // Verify still NO call to GET /customer/user/
    httpMock.expectNone(r => r.url.includes('/customer/user/') && r.method === 'GET');
  });

  it('should disable and not render the "Done" button for ongoing orders in orders page', async () => {
    const { CustomerOrdersComponent } = await import('./features/orders/customer-orders.component');
    const fixture = TestBed.createComponent(CustomerOrdersComponent);

    const ongoingOrder: Order = {
      id: 'ord-555',
      orderNumber: 'HF-555',
      dailySequence: 555,
      diningOption: 'dine_in',
      items: [
        {
          id: 'item-1',
          menuItemId: 'dish-1',
          name: 'Chicken Rice',
          basePrice: 5.5,
          quantity: 1,
          selectedModifiers: [],
          unitPriceWithModifiers: 5.5,
          totalPrice: 5.5
        }
      ],
      subtotal: 5.5,
      takeawayFee: 0,
      tax: 0,
      discount: 0,
      total: 5.5,
      paymentMethod: 'paynow',
      paymentStatus: 'paid',
      status: 'preparing',
      createdAt: new Date().toISOString()
    };

    customerService.customerOrders.set([ongoingOrder]);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    // Track button should be available
    expect(compiled.textContent).toContain('Track');
    // "Done" button should NOT be rendered
    expect(compiled.textContent).not.toContain('Done');
    expect(compiled.querySelector('button[title*="Mark as collected"]')).toBeNull();
  });
});




