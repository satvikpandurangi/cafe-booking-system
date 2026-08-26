export type TableStatus = 
  | 'AVAILABLE' 
  | 'OCCUPIED' 
  | 'ORDER_PENDING' 
  | 'PAYMENT_PENDING' 
  | 'CLEANING' 
  | 'INACTIVE';

export type OrderStatus = 
  | 'PENDING' 
  | 'ACCEPTED' 
  | 'PREPARING' 
  | 'READY' 
  | 'SERVED' 
  | 'COMPLETED' 
  | 'CANCELLED';

export type PaymentMethod = 'UPI' | 'CASH';

export type PaymentStatus = 
  | 'PENDING' 
  | 'PAID' 
  | 'FAILED' 
  | 'REFUNDED' 
  | 'CANCELLED';

export type AdminRole = 'ADMIN' | 'STAFF';

// Customer User
export interface User {
  id: number;
  phone: string;
  created_at: string;
  updated_at: string;
}

// Admin User
export interface AdminUser {
  id: number;
  email: string;
  role: AdminRole;
  created_at: string;
  updated_at: string;
}

// Table (Internal Model in DB)
export interface TableRecord {
  id: number;
  internal_table_code: string;
  secure_token_hash: string;
  status: TableStatus;
  created_at: string;
  updated_at: string;
}

// Admin view of a Table (Includes internal ID, code, status, token info)
export interface AdminTable {
  id: number;
  internal_table_code: string;
  status: TableStatus;
  has_active_session: boolean;
  qr_entry_url?: string;
  created_at: string;
  updated_at: string;
}

// Safe Public Table Session for Customer (NEVER contains internal table_id or table_code)
export interface PublicTableSession {
  valid: boolean;
  message: string;
  session_active: boolean;
}

// Menu Category
export interface MenuCategory {
  id: number;
  name: string;
  display_order: number;
  created_at: string;
  updated_at: string;
}

// Menu Item
export interface MenuItem {
  id: number;
  category_id: number;
  category_name?: string;
  name: string;
  description: string;
  price: number; // in INR
  image_url: string;
  available: boolean;
  is_veg?: boolean;
  is_spicy?: boolean;
  tags?: string[];
  created_at: string;
  updated_at: string;
}

// Order Item Snapshot
export interface OrderItem {
  id: number;
  order_id: number;
  menu_item_id: number;
  item_name_snapshot: string;
  unit_price_snapshot: number;
  quantity: number;
  total: number;
}

// Order Record
export interface Order {
  id: number;
  public_order_number: string;
  user_id: number;
  table_id: number;
  subtotal: number;
  tax: number;
  total: number;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  order_status: OrderStatus;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  items?: OrderItem[];
  user_phone?: string;
  internal_table_code?: string; // Only populated for Admin responses!
}

// Customer safe order details (NO internal table ID or internal code)
export interface CustomerOrderView {
  public_order_number: string;
  subtotal: number;
  tax: number;
  total: number;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  order_status: OrderStatus;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  items: {
    item_name_snapshot: string;
    unit_price_snapshot: number;
    quantity: number;
    total: number;
  }[];
}

// Payment Record
export interface PaymentRecord {
  id: number;
  order_id: number;
  public_order_number?: string;
  method: PaymentMethod;
  amount: number;
  status: PaymentStatus;
  transaction_reference?: string | null;
  verified_by?: number | null;
  verified_at?: string | null;
  verifier_email?: string | null;
  created_at: string;
  updated_at: string;
}

// Cart Item in Frontend
export interface CartItem {
  menuItem: MenuItem;
  quantity: number;
  notes?: string;
}

// Order Creation Payload from Client
export interface CreateOrderPayload {
  items: {
    menu_item_id: number;
    quantity: number;
  }[];
  payment_method: PaymentMethod;
  notes?: string;
  idempotency_key?: string;
}

// Dashboard Summary for Admin
export interface DashboardStats {
  today_orders_count: number;
  pending_orders_count: number;
  preparing_orders_count: number;
  completed_orders_count: number;
  today_sales_total: number;
  pending_payments_total: number;
  active_tables_count: number;
}

// Report Analytics
export interface ReportData {
  total_revenue: number;
  total_orders: number;
  average_order_value: number;
  upi_revenue: number;
  cash_revenue: number;
  pending_payments_count: number;
  top_dishes: {
    name: string;
    quantity_sold: number;
    total_revenue: number;
  }[];
  daily_trends: {
    date: string;
    orders_count: number;
    revenue: number;
  }[];
}
