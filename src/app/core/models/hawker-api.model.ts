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
