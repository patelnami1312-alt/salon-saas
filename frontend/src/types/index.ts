// Auth
export interface User {
  user_id: number;
  salon_id: number | null;
  branch_id: number | null;
  role_code: string;
  role_name: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  profile_picture_url: string | null;
  is_email_verified: boolean;
}

export interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isInitializing: boolean;
  isLoading: boolean;
  error: string | null;
}

// Customer
export interface Customer {
  customer_id: number;
  salon_id: number;
  first_name: string;
  last_name: string;
  full_name: string;
  gender: string | null;
  date_of_birth: string | null;
  mobile: string;
  email: string | null;
  address: string | null;
  city: string | null;
  profile_picture_url: string | null;
  loyalty_points: number;
  wallet_balance: number;
  referral_code: string | null;
  total_visits: number;
  total_spent: number;
  last_visit_date: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
}

// Staff
export interface Staff {
  staff_id: number;
  user_id: number;
  branch_id: number;
  staff_code?: string;
  first_name: string;
  last_name: string;
  full_name: string;
  email: string;
  phone: string | null;
  job_title: string | null;
  skills: string | null;
  experience: number;
  salary?: number;
  commission_percent: number;
  gender?: string | null;
  average_rating: number;
  total_serviced: number;
  is_active: boolean;
  profile_picture_url: string | null;
  service_ids: number[];
}

export interface StaffUpdate {
  first_name?: string;
  last_name?: string;
  phone?: string;
  job_title?: string;
  skills?: string;
  experience?: number;
  salary?: number;
  commission_percent?: number;
  gender?: string;
  service_ids?: number[];
}

// Service
export interface ServiceCategory {
  category_id: number;
  category_name: string;
  description: string | null;
  icon_url: string | null;
  color_code: string | null;
  sort_order: number;
}

export interface ServiceAddon {
  addon_id: number;
  addon_name: string;
  price: number;
  duration: number;
}

export interface Service {
  service_id: number;
  category_id: number;
  service_name: string;
  description: string | null;
  duration: number;
  price: number;
  tax_percent: number;
  gender_type: string;
  image_url: string | null;
  color_code: string | null;
  is_active: boolean;
  addons: ServiceAddon[];
}

// Appointment
export interface Appointment {
  appointment_id: number;
  salon_id: number;
  branch_id: number;
  customer_id: number;
  customer_name: string | null;
  customer_mobile: string | null;
  staff_id: number | null;
  staff_name: string | null;
  service_id: number;
  service_name: string | null;
  service_duration: number | null;
  appointment_date: string;
  start_time: string;
  end_time: string;
  status: AppointmentStatus;
  notes: string | null;
  booking_source: string;
  service_amount: number | null;
  created_at: string;
}

export type AppointmentStatus =
  | 'Scheduled'
  | 'Confirmed'
  | 'CheckedIn'
  | 'InService'
  | 'Completed'
  | 'Cancelled'
  | 'NoShow';

// Check-In
export interface CheckIn {
  checkin_id: number;
  branch_id: number;
  customer_id: number;
  customer_name: string | null;
  customer_mobile: string | null;
  service_id: number;
  service_name: string | null;
  staff_id: number | null;
  staff_name: string | null;
  queue_number: number | null;
  checkin_time: string;
  start_service_time: string | null;
  end_service_time: string | null;
  status: CheckInStatus;
  notes: string | null;
  appointment_id: number | null;
  wait_minutes: number | null;
}

export type CheckInStatus = 'Waiting' | 'CheckedIn' | 'InService' | 'Completed' | 'Cancelled';

// Invoice
export interface InvoiceItem {
  item_id: number;
  item_type: string;
  item_name: string;
  quantity: number;
  unit_price: number;
  tax_amount: number;
  discount_amount: number;
  total_price: number;
  staff_id: number | null;
  staff_name: string | null;
}

export interface Invoice {
  invoice_id: number;
  invoice_number: string;
  customer_name: string | null;
  customer_mobile: string | null;
  sub_total: number;
  tax_amount: number;
  discount_amount: number;
  wallet_used: number;
  total_amount: number;
  paid_amount: number;
  balance_amount: number;
  status: string;
  items: InvoiceItem[];
  notes: string | null;
  created_at: string;
}

// Product / Inventory
export interface Product {
  product_id: number;
  product_name: string;
  sku: string | null;
  barcode: string | null;
  cost_price: number;
  sale_price: number;
  tax_percent: number;
  unit: string | null;
  is_for_sale: boolean;
  is_for_use: boolean;
  is_active: boolean;
  image_url: string | null;
}

export interface InventoryItem {
  inventory_id: number;
  product_id: number;
  product_name: string;
  sku: string | null;
  current_stock: number;
  min_stock: number;
  reorder_point: number;
  is_low_stock: boolean;
  stock_value: number;
}

// Dashboard
export interface DashboardData {
  today_revenue: number;
  weekly_revenue: number;
  monthly_revenue: number;
  today_appointments: number;
  pending_appointments: number;
  total_customers: number;
  new_customers_today: number;
  in_queue: number;
  date: string;
}

// Common
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface Branch {
  branch_id: number;
  salon_id: number;
  branch_name: string;
  branch_code: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  is_active: boolean;
}

// Reports
export interface RevenueDataPoint {
  period: string;
  revenue: number;
  invoice_count: number;
  tax?: number;
  discount?: number;
}

export interface RevenueReport {
  data: RevenueDataPoint[];
  total_revenue: number;
  total_invoices: number;
}

export interface StaffPerformanceRow {
  staff_id: number;
  staff_name: string;
  name?: string;
  total_revenue: number;
  total_services: number;
  total_appointments?: number;
  average_rating: number;
}

export interface StaffPerformanceReport {
  staff: StaffPerformanceRow[];
}

export interface ServiceReportRow {
  service_id: number | null;
  service_name: string;
  revenue: number;
  count: number;
}

export interface ServiceReport {
  services: ServiceReportRow[];
}

// Marketing
export interface Campaign {
  campaign_id: number;
  campaign_name: string;
  type: string;
  target_audience: string;
  status: string;
  sent_count: number | null;
  total_recipients: number;
  scheduled_at?: string | null;
  // Not currently populated by the backend (no delivery/open tracking yet) — always undefined for now.
  total_delivered?: number;
  total_opened?: number;
}

export interface CampaignCreatePayload {
  campaign_name: string;
  type: string;
  subject?: string;
  message: string;
  target_audience?: string;
  scheduled_at?: string;
}

// Appointment query filters
export interface AppointmentFilters {
  branch_id?: number;
  date_from?: string;
  date_to?: string;
  start_date?: string;
  end_date?: string;
  status?: string;
  staff_id?: number;
  customer_id?: number;
  page?: number;
  page_size?: number;
}

// Calendar event from API
export interface CalendarEvent {
  id: number;
  title: string;
  start: string;
  end: string;
  status: string;
  customer_name: string | null;
  staff_name: string | null;
  service_name: string | null;
  color?: string;
}

// Available time slot
export interface TimeSlot {
  start_time: string;
  end_time: string;
  is_available: boolean;
}

// Billing payloads
export interface InvoiceLineItem {
  item_type: string; // Service, Product, Package, Addon
  item_ref_id?: number;
  item_name: string;
  quantity: number;
  unit_price: number;
  tax_percent?: number;
  discount_percent?: number;
  staff_id?: number;
}

export interface InvoiceCreatePayload {
  customer_id?: number;
  branch_id: number;
  appointment_id?: number;
  checkin_id?: number;
  items: InvoiceLineItem[];
  coupon_code?: string;
  wallet_amount?: number;
  notes?: string;
}

export interface PaymentPayload {
  invoice_id: number;
  amount: number;
  payment_method: string;
  transaction_id?: string;
  gateway_response?: string;
}

export interface TerminalInitiatePayload {
  amount: number;
  payment_mode: 'Card' | 'UPI';
}

export interface TerminalInitiateResult {
  merchant_txn_id: string;
  gateway_txn_id?: string;
  status: string;
}

export interface StripeIntentPayload {
  invoice_id: number;
  amount: number;
}

export interface StripeIntentResult {
  client_secret: string;
  payment_intent_id: string;
  publishable_key: string;
}

export interface TerminalStatusResult {
  done: boolean;
  success: boolean;
  transaction_id?: string;
  rrn?: string;
  approval_code?: string;
  card_last4?: string;
  response_message: string;
}

export interface CouponValidatePayload {
  coupon_code: string;
  order_amount: number;
}

export interface CouponResponse {
  is_valid: boolean;
  coupon_id?: number;
  discount_type?: string;
  discount_value?: number;
  discount_amount: number;
  message?: string;
}

// CheckIn payloads
export interface CheckInCreatePayload {
  branch_id: number;
  customer_id?: number;
  service_id: number;
  staff_id?: number;
  appointment_id?: number;
  notes?: string;
}

export interface CheckInLookupAppointment {
  appointment_id: number;
  service_id: number;
  service_name: string | null;
  service_price: number;
  staff_id: number | null;
  staff_name: string | null;
  start_time: string | null;
}

export interface CheckInLookupResult {
  customer: { customer_id: number; full_name: string; mobile: string } | null;
  appointments: CheckInLookupAppointment[];
}

export interface StatusUpdatePayload {
  status?: string;
  staff_id?: number;
  notes?: string;
  appointment_date?: string;
  start_time?: string;
}

// Commission
export interface Commission {
  commission_id: number;
  staff_id: number;
  staff_name: string;
  invoice_id: number;
  base_amount: number;
  commission_percent: number;
  amount: number;
  status: string;
  created_at: string;
}

export interface CommissionSummary {
  staff_id: number;
  staff_name: string;
  job_title: string | null;
  commission_percent: number;
  total_commission: number;
  total_revenue: number;
  service_count: number;
}

// Membership
export interface MembershipPlan {
  plan_id: number;
  plan_name: string;
  description: string | null;
  price: number;
  duration_days: number;
  discount_percent: number;
  loyalty_bonus: number;
  benefits: string | null;
  is_active: boolean;
}

export interface CustomerMembership {
  membership_id: number;
  customer_id: number;
  customer_name: string;
  plan_id: number;
  plan_name: string;
  start_date: string;
  end_date: string;
  status: string;
}

// Gift Card
export interface GiftCard {
  gift_card_id: number;
  code: string;
  initial_amount: number;
  balance: number;
  recipient_name: string | null;
  recipient_email: string | null;
  expiry_date: string | null;
  is_active: boolean;
  purchased_at: string;
}

// Loyalty
export interface LoyaltyTransaction {
  transaction_id: number;
  customer_id: number;
  invoice_id: number | null;
  points: number;
  transaction_type: string;
  description: string | null;
  balance_after: number;
  created_at: string;
}

// AI
export interface AIAppointmentSuggestion {
  suggestion: string;
}

export interface AICampaign {
  campaign: {
    subject_line: string;
    sms_message: string;
    email_body: string;
    cta_text: string;
    raw_response?: string;
  };
}

export interface AtRiskCustomer {
  customer_id: number;
  name: string;
  mobile: string;
  email: string | null;
  last_visit: string;
  days_since_visit: number;
  total_visits: number;
  total_spent: number;
  loyalty_points: number;
}

export interface RetentionAlerts {
  at_risk_customers: AtRiskCustomer[];
  ai_insight: string;
  total_at_risk: number;
}

// Public booking
export interface PublicService {
  service_id: number;
  service_name: string;
  category_id: number;
  category_name: string;
  duration_minutes: number;
  price: number;
  description: string | null;
  gender_type: string;
}

export interface PublicStaff {
  staff_id: number;
  name: string;
  job_title: string | null;
  rating: number;
}

export interface AvailableSlots {
  date: string;
  slots: string[];
  duration_minutes: number;
}
