export interface BackendDishItem {
  f_menu_name: string;
  f_menu_id: number;
  f_menu_description: string;
  f_menu_price: number;
  f_stall_id: number;
}

export interface BackendStallOwner {
  f_stall_owner_phone: string;
  f_stall_owner_id: number;
  f_stall_owner_name: string;
  f_stall_id: number;
}

export interface BackendStallItem {
  stall_name: string;
  stall_description: string;
  stall_menu?: BackendDishItem[];
  stall_owner?: BackendStallOwner[];
}

export interface BackendStallsResponse {
  stalls: BackendStallItem[];
}

export interface BackendDishOrder {
  dish_id: number;
  dish_name?: string;
  quantity: number;
  price: number;
}

export interface BackendStallOrder {
  stall_id: number;
  dishes: BackendDishOrder[];
}

export interface BackendCreateOrderPayload {
  orders: BackendStallOrder[];
  total_price: number;
}

export interface BackendCreateOrderResponse {
  message: string;
  order_id: number;
  total_price: number;
  order_status: string;
  order_created_at: string;
}

export interface BackendCustomerRegisterPayload {
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string;
  customer_sub?: string;
  sub?: string;
}

export interface BackendCheckAccountPayload {
  phone_number: string;
  email: string;
}

export interface BackendCheckAccountResponse {
  account_exist: boolean;
  message?: string;
  [key: string]: any;
}

export interface BackendPastOrderDish {
  order_id: number;
  dish_id: number;
  dish_name: string;
  quantity: number;
  order_price: number;
  order_status: string;
  order_created_at?: string;
  created_at?: string;
  [key: string]: any;
}

export interface BackendPastOrdersWrapper {
  orders: BackendPastOrderDish[];
}

export interface BackendCustomerDetailResponse {
  cust_id?: string;
  customer_id?: string;
  cust_name?: string;
  customer_name?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone_number?: string;
  cust_sub?: string;
  customer_sub?: string;
  last_login?: string;
  past_orders?: BackendPastOrdersWrapper | BackendPastOrderDish[];
  [key: string]: any;
}

export interface BackendUpdateCustomerOrderPayload {
  order_id: number;
  cust_sub: string;
  orders: BackendStallOrder[];
  total_price: number;
  status: string;
}



