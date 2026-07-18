import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { RootState } from '@/app/store';
import type {
  Customer, Staff, StaffUpdate, Appointment, CheckIn, Invoice, Product, Branch,
  InventoryItem, DashboardData, Service, ServiceCategory, PaginatedResponse,
  RevenueReport, StaffPerformanceReport, ServiceReport, Campaign,
  AppointmentFilters, CalendarEvent, TimeSlot, CheckInCreatePayload, StatusUpdatePayload,
  InvoiceCreatePayload, PaymentPayload, CouponValidatePayload, CouponResponse,
  Commission, CommissionSummary, MembershipPlan, CustomerMembership, GiftCard,
  LoyaltyTransaction, AIAppointmentSuggestion, AICampaign, RetentionAlerts,
  PublicService, PublicStaff, AvailableSlots,
  TerminalInitiatePayload, TerminalInitiateResult, TerminalStatusResult,
  StripeIntentPayload, StripeIntentResult, CheckInLookupResult, CampaignCreatePayload,
} from '@/types';

const BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';

export const apiSlice = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({
    baseUrl: BASE_URL,
    prepareHeaders: (headers, { getState }) => {
      const token = (getState() as RootState).auth.accessToken
        || localStorage.getItem('access_token');
      if (token) headers.set('Authorization', `Bearer ${token}`);
      return headers;
    },
  }),
  // Globally refetch stale data whenever the window regains focus or the
  // network reconnects — ensures pages never show stale snapshots after
  // switching tabs or recovering from a brief network drop.
  refetchOnFocus: true,
  refetchOnReconnect: true,
  tagTypes: ['Customer', 'Staff', 'Appointment', 'CheckIn', 'Invoice', 'Inventory', 'Service', 'Report', 'Commission', 'Membership', 'GiftCard', 'Package', 'Waitlist'],
  endpoints: (builder) => ({
    // Branches
    getBranches: builder.query<Branch[], void>({
      query: () => '/salon/branches',
    }),

    // Dashboard
    getDashboard: builder.query<DashboardData, { branch_id?: number }>({
      query: ({ branch_id } = {}) => ({
        url: '/reports/dashboard',
        params: branch_id ? { branch_id } : {},
      }),
      providesTags: ['Report'],
    }),

    // Customers
    getCustomers: builder.query<PaginatedResponse<Customer>, { search?: string; page?: number; page_size?: number }>({
      query: (params) => ({ url: '/customers', params }),
      providesTags: ['Customer'],
    }),
    getCustomer: builder.query<Customer, number>({
      query: (id) => `/customers/${id}`,
      providesTags: (_, __, id) => [{ type: 'Customer', id }],
    }),
    createCustomer: builder.mutation<Customer, Partial<Customer>>({
      query: (body) => ({ url: '/customers', method: 'POST', body }),
      invalidatesTags: ['Customer'],
    }),
    updateCustomer: builder.mutation<Customer, { id: number; data: Partial<Customer> }>({
      query: ({ id, data }) => ({ url: `/customers/${id}`, method: 'PUT', body: data }),
      invalidatesTags: (_, __, { id }) => [{ type: 'Customer', id }, 'Customer'],
    }),
    getCustomerHistory: builder.query<{ appointments: Appointment[]; invoices: Invoice[] }, number>({
      query: (id) => `/customers/${id}/history`,
    }),

    // Staff
    getStaff: builder.query<PaginatedResponse<Staff>, { branch_id?: number; search?: string; page?: number; page_size?: number }>({
      query: (params) => ({ url: '/staff', params }),
      providesTags: ['Staff'],
    }),
    getStaffMember: builder.query<Staff, number>({
      query: (id) => `/staff/${id}`,
      providesTags: (_, __, id) => [{ type: 'Staff', id }],
    }),
    createStaff: builder.mutation<Staff, Partial<Staff>>({
      query: (body) => ({ url: '/staff', method: 'POST', body }),
      invalidatesTags: ['Staff'],
    }),
    updateStaff: builder.mutation<{ staff_id: number; message: string }, { id: number; data: StaffUpdate }>({
      query: ({ id, data }) => ({ url: `/staff/${id}`, method: 'PUT', body: data }),
      invalidatesTags: (_, __, { id }) => ['Staff', { type: 'Staff', id }],
    }),

    // Services
    getServiceCategories: builder.query<ServiceCategory[], void>({
      query: () => '/services/categories',
      providesTags: ['Service'],
    }),
    createServiceCategory: builder.mutation<{ category_id: number; category_name: string }, { category_name: string; color_code?: string; description?: string }>({
      query: (body) => ({ url: '/services/categories', method: 'POST', body }),
      invalidatesTags: ['Service'],
    }),
    updateServiceCategory: builder.mutation<{ category_id: number; category_name: string }, { id: number; data: { category_name: string; color_code?: string; description?: string } }>({
      query: ({ id, data }) => ({ url: `/services/categories/${id}`, method: 'PUT', body: data }),
      invalidatesTags: ['Service'],
    }),
    deleteServiceCategory: builder.mutation<void, number>({
      query: (id) => ({ url: `/services/categories/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Service'],
    }),
    getServices: builder.query<Service[], { category_id?: number; gender_type?: string }>({
      query: (params) => ({ url: '/services', params }),
      providesTags: ['Service'],
    }),
    createService: builder.mutation<Service, Partial<Service>>({
      query: (body) => ({ url: '/services', method: 'POST', body }),
      invalidatesTags: ['Service'],
    }),
    updateService: builder.mutation<Service, { id: number; data: Partial<Service> }>({
      query: ({ id, data }) => ({ url: `/services/${id}`, method: 'PUT', body: data }),
      invalidatesTags: ['Service'],
    }),

    // Appointments
    getAppointments: builder.query<{ items: Appointment[]; total: number }, AppointmentFilters>({
      query: (params) => ({ url: '/appointments', params }),
      providesTags: ['Appointment'],
    }),
    getCalendarAppointments: builder.query<CalendarEvent[], AppointmentFilters>({
      query: (params) => ({ url: '/appointments/calendar', params }),
      providesTags: ['Appointment'],
    }),
    getAvailableSlots: builder.query<TimeSlot[], { branch_id: number; service_id: number; date: string; staff_id?: number }>({
      query: (params) => ({ url: '/appointments/slots', params }),
    }),
    createAppointment: builder.mutation<Appointment, Partial<Appointment>>({
      query: (body) => ({ url: '/appointments', method: 'POST', body }),
      invalidatesTags: ['Appointment'],
    }),
    updateAppointmentStatus: builder.mutation<Appointment, { id: number; data: StatusUpdatePayload }>({
      query: ({ id, data }) => ({ url: `/appointments/${id}/status`, method: 'PUT', body: data }),
      invalidatesTags: ['Appointment'],
    }),
    cancelAppointment: builder.mutation<Appointment, { id: number; reason?: string }>({
      query: ({ id, reason }) => ({ url: `/appointments/${id}/cancel`, method: 'POST', body: { cancellation_reason: reason } }),
      invalidatesTags: ['Appointment'],
    }),

    // Check-In
    getQueue: builder.query<{ queue: CheckIn[]; total: number }, number>({
      query: (branch_id) => ({ url: '/checkins/queue', params: { branch_id } }),
      providesTags: ['CheckIn'],
    }),
    createCheckIn: builder.mutation<CheckIn, CheckInCreatePayload>({
      query: (body) => ({ url: '/checkins', method: 'POST', body }),
      invalidatesTags: ['CheckIn', 'Appointment'],
    }),
    updateCheckInStatus: builder.mutation<CheckIn, { id: number; data: StatusUpdatePayload }>({
      query: ({ id, data }) => ({ url: `/checkins/${id}/status`, method: 'PUT', body: data }),
      invalidatesTags: ['CheckIn'],
    }),
    lookupCheckIn: builder.query<CheckInLookupResult, { phone: string; branch_id: number }>({
      query: ({ phone, branch_id }) => ({ url: '/checkins/lookup', params: { phone, branch_id } }),
    }),

    // Billing
    getInvoices: builder.query<PaginatedResponse<Invoice>, { branch_id?: number; page?: number; page_size?: number }>({
      query: (params) => ({ url: '/billing/invoices', params }),
      providesTags: ['Invoice'],
    }),
    getInvoice: builder.query<Invoice, number>({
      query: (id) => `/billing/invoices/${id}`,
      providesTags: (_, __, id) => [{ type: 'Invoice', id }],
    }),
    createInvoice: builder.mutation<Invoice, InvoiceCreatePayload>({
      query: (body) => ({ url: '/billing/invoices', method: 'POST', body }),
      invalidatesTags: ['Invoice'],
    }),
    recordPayment: builder.mutation<Invoice, PaymentPayload>({
      query: (body) => ({ url: '/billing/payments', method: 'POST', body }),
      invalidatesTags: ['Invoice'],
    }),
    validateCoupon: builder.mutation<CouponResponse, CouponValidatePayload>({
      query: (body) => ({ url: '/billing/coupons/validate', method: 'POST', body }),
    }),
    initiateTerminalPayment: builder.mutation<TerminalInitiateResult, TerminalInitiatePayload>({
      query: (body) => ({ url: '/billing/terminal/initiate', method: 'POST', body }),
    }),
    getTerminalStatus: builder.query<TerminalStatusResult, string>({
      query: (merchant_txn_id) => `/billing/terminal/status/${merchant_txn_id}`,
    }),
    createStripeIntent: builder.mutation<StripeIntentResult, StripeIntentPayload>({
      query: (body) => ({ url: '/billing/stripe/create-intent', method: 'POST', body }),
    }),

    // Inventory
    getProducts: builder.query<PaginatedResponse<Product>, { branch_id?: number; search?: string; page?: number; page_size?: number }>({
      query: (params) => ({ url: '/inventory/products', params }),
      providesTags: ['Inventory'],
    }),
    getStockLevels: builder.query<{ items: InventoryItem[]; total: number; low_stock_count: number }, number>({
      query: (branch_id) => ({ url: '/inventory/stock', params: { branch_id } }),
      providesTags: ['Inventory'],
    }),
    adjustStock: builder.mutation<InventoryItem, { product_id: number; branch_id: number; quantity: number; notes?: string }>({
      query: (body) => ({ url: '/inventory/stock/adjust', method: 'POST', body }),
      invalidatesTags: ['Inventory'],
    }),
    createProduct: builder.mutation<Product, {
      product_name: string; sku?: string; description?: string;
      cost_price: number; sale_price: number; tax_percent?: number;
      is_for_sale?: boolean; is_for_use?: boolean;
    }>({
      query: (body) => ({ url: '/inventory/products', method: 'POST', body }),
      invalidatesTags: ['Inventory'],
    }),

    // Reports
    getRevenueReport: builder.query<RevenueReport, { date_from: string; date_to: string; branch_id?: number }>({
      query: (params) => ({ url: '/reports/revenue', params }),
      providesTags: ['Report'],
    }),
    getStaffPerformance: builder.query<StaffPerformanceReport, { date_from?: string; date_to?: string; branch_id?: number }>({
      query: (params) => ({ url: '/reports/staff-performance', params }),
      providesTags: ['Report'],
    }),
    getServiceReport: builder.query<ServiceReport, { date_from?: string; date_to?: string; branch_id?: number }>({
      query: (params) => ({ url: '/reports/services', params }),
      providesTags: ['Report'],
    }),

    // Marketing / Campaigns
    getCampaigns: builder.query<Campaign[], void>({
      query: () => '/notifications/campaigns',
      providesTags: ['Report'],
    }),
    createCampaign: builder.mutation<{ campaign_id: number; total_recipients: number }, CampaignCreatePayload>({
      query: (body) => ({ url: '/notifications/campaigns', method: 'POST', body }),
      invalidatesTags: ['Report'],
    }),
    sendCampaign: builder.mutation<Campaign, number>({
      query: (id) => ({ url: `/notifications/campaigns/${id}/send`, method: 'POST' }),
      invalidatesTags: ['Report'],
    }),

    // Commissions
    getCommissions: builder.query<{ items: Commission[]; total: number }, { staff_id?: number; status?: string; date_from?: string; date_to?: string; page?: number }>({
      query: (params) => ({ url: '/commissions', params }),
      providesTags: ['Commission'],
    }),
    getCommissionSummary: builder.query<{ summary: CommissionSummary[] }, { date_from?: string; date_to?: string }>({
      query: (params) => ({ url: '/commissions/summary', params }),
      providesTags: ['Commission'],
    }),

    // Memberships
    getMembershipPlans: builder.query<MembershipPlan[], void>({
      query: () => '/memberships/plans',
      providesTags: ['Membership'],
    }),
    createMembershipPlan: builder.mutation<{ plan_id: number }, Partial<MembershipPlan>>({
      query: (body) => ({ url: '/memberships/plans', method: 'POST', body }),
      invalidatesTags: ['Membership'],
    }),
    updateMembershipPlan: builder.mutation<{ plan_id: number }, { id: number; data: Partial<MembershipPlan> }>({
      query: ({ id, data }) => ({ url: `/memberships/plans/${id}`, method: 'PUT', body: data }),
      invalidatesTags: ['Membership'],
    }),
    deleteMembershipPlan: builder.mutation<void, number>({
      query: (id) => ({ url: `/memberships/plans/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Membership'],
    }),
    getCustomerMemberships: builder.query<CustomerMembership[], { customer_id?: number; status?: string }>({
      query: (params) => ({ url: '/memberships', params }),
      providesTags: ['Membership'],
    }),
    assignMembership: builder.mutation<{ membership_id: number; end_date: string }, { customer_id: number; plan_id: number; start_date?: string }>({
      query: (body) => ({ url: '/memberships', method: 'POST', body }),
      invalidatesTags: ['Membership', 'Customer'],
    }),

    // Gift Cards
    getGiftCards: builder.query<GiftCard[], { active_only?: boolean }>({
      query: (params) => ({ url: '/gift-cards', params }),
      providesTags: ['GiftCard'],
    }),
    createGiftCard: builder.mutation<{ gift_card_id: number; code: string; balance: number }, { amount: number; purchased_by_customer_id?: number; recipient_name?: string; recipient_email?: string; expiry_date?: string }>({
      query: (body) => ({ url: '/gift-cards', method: 'POST', body }),
      invalidatesTags: ['GiftCard'],
    }),
    validateGiftCard: builder.query<{ is_valid: boolean; gift_card_id?: number; balance?: number; message?: string }, string>({
      query: (code) => `/gift-cards/validate/${code}`,
    }),
    redeemGiftCard: builder.mutation<{ redeemed_amount: number; remaining_balance: number }, { code: string; invoice_id: number; amount: number }>({
      query: (body) => ({ url: '/gift-cards/redeem', method: 'POST', body }),
      invalidatesTags: ['GiftCard'],
    }),

    // Loyalty
    getCustomerLoyalty: builder.query<{ transactions: LoyaltyTransaction[]; balance: number }, number>({
      query: (customerId) => `/customers/${customerId}/loyalty`,
      providesTags: ['Customer'],
    }),

    // AI Features
    getAIAppointmentSuggestion: builder.mutation<AIAppointmentSuggestion, { customer_name?: string; preferred_services?: string; date_preference?: string; special_requests?: string }>({
      query: (body) => ({ url: '/ai/appointment-assist', method: 'POST', body }),
    }),
    generateAICampaign: builder.mutation<AICampaign, { campaign_type: string; target_segment?: string; offer_details?: string; tone?: string }>({
      query: (body) => ({ url: '/ai/generate-campaign', method: 'POST', body }),
    }),
    getRetentionAlerts: builder.query<RetentionAlerts, { days_inactive?: number; limit?: number }>({
      query: (params) => ({ url: '/ai/retention-alerts', params }),
      providesTags: ['Customer'],
    }),
    getSmartSchedule: builder.query<{ ai_suggestion: string; total_appointments: number; peak_hour: string }, { date_requested: string; branch_id: number }>({
      query: (params) => ({ url: '/ai/smart-schedule', params }),
    }),

    // Branches (management)
    createBranch: builder.mutation<any, any>({
      query: (body) => ({ url: '/salon/branches', method: 'POST', body }),
    }),
    updateBranch: builder.mutation<any, { id: number; data: any }>({
      query: ({ id, data }) => ({ url: `/salon/branches/${id}`, method: 'PUT', body: data }),
    }),

    // Staff list (paginated alias)
    listStaff: builder.query<PaginatedResponse<Staff>, { search?: string; page?: number; page_size?: number }>({
      query: (params) => ({ url: '/staff', params }),
      providesTags: ['Staff'],
    }),

    // Services list — backend returns a plain array; it has no search/pagination params,
    // so callers that need a search box filter this list client-side.
    listServices: builder.query<Service[], { category_id?: number; gender_type?: string } | void>({
      query: (params) => ({ url: '/services', params: params ?? {} }),
      providesTags: ['Service'],
    }),

    // Payroll
    listPayroll: builder.query<any, { status?: string; staff_id?: number; page?: number; page_size?: number }>({
      query: (params) => ({ url: '/payroll', params }),
      providesTags: ['Commission'],
    }),
    generatePayroll: builder.mutation<any, any>({
      query: (body) => ({ url: '/payroll/generate', method: 'POST', body }),
      invalidatesTags: ['Commission'],
    }),
    approvePayroll: builder.mutation<any, number>({
      query: (id) => ({ url: `/payroll/${id}/approve`, method: 'POST' }),
      invalidatesTags: ['Commission'],
    }),
    markPayrollPaid: builder.mutation<any, number>({
      query: (id) => ({ url: `/payroll/${id}/mark-paid`, method: 'POST' }),
      invalidatesTags: ['Commission'],
    }),
    getPayrollSummary: builder.query<any, { pay_period_start: string; pay_period_end: string }>({
      query: (params) => ({ url: '/payroll/summary/period', params }),
    }),

    // Packages
    listPackages: builder.query<any, { search?: string; active_only?: boolean }>({
      query: (params) => ({ url: '/packages', params }),
      providesTags: ['Package'],
    }),
    createPackage: builder.mutation<any, any>({
      query: (body) => ({ url: '/packages', method: 'POST', body }),
      invalidatesTags: ['Package'],
    }),
    updatePackage: builder.mutation<any, { id: number; data: any }>({
      query: ({ id, data }) => ({ url: `/packages/${id}`, method: 'PUT', body: data }),
      invalidatesTags: ['Package'],
    }),
    deletePackage: builder.mutation<any, number>({
      query: (id) => ({ url: `/packages/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Package'],
    }),

    // Waitlist
    listWaitlist: builder.query<any, { preferred_date?: string; status?: string; page?: number; page_size?: number }>({
      query: (params) => ({ url: '/waitlist', params }),
      providesTags: ['Waitlist'],
    }),
    addToWaitlist: builder.mutation<any, any>({
      query: (body) => ({ url: '/waitlist', method: 'POST', body }),
      invalidatesTags: ['Waitlist'],
    }),
    updateWaitlist: builder.mutation<any, { id: number; body: any }>({
      query: ({ id, body }) => ({ url: `/waitlist/${id}`, method: 'PUT', body }),
      invalidatesTags: ['Waitlist'],
    }),
    removeFromWaitlist: builder.mutation<any, number>({
      query: (id) => ({ url: `/waitlist/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Waitlist'],
    }),
    bookFromWaitlist: builder.mutation<any, { id: number; body: any }>({
      query: ({ id, body }) => ({ url: `/waitlist/${id}/book`, method: 'POST', body }),
      invalidatesTags: ['Waitlist', 'Appointment'],
    }),

    // Public booking
    getPublicSalonInfo: builder.query<{ salon_id: number; salon_name: string; currency: string; branches: { branch_id: number; branch_name: string; address: string; city: string; phone: string; open_time: string; close_time: string }[] }, number>({
      query: (salonId) => `/booking/salon/${salonId}/info`,
    }),
    getPublicServices: builder.query<PublicService[], { salon_id: number; category_id?: number }>({
      query: ({ salon_id, ...params }) => ({ url: `/booking/salon/${salon_id}/services`, params }),
    }),
    getPublicStaff: builder.query<PublicStaff[], { salon_id: number; service_id?: number; branch_id?: number }>({
      query: ({ salon_id, ...params }) => ({ url: `/booking/salon/${salon_id}/staff`, params }),
    }),
    getPublicSlots: builder.query<AvailableSlots, { salon_id: number; branch_id: number; service_id: number; booking_date: string; staff_id?: number }>({
      query: ({ salon_id, ...params }) => ({ url: `/booking/salon/${salon_id}/slots`, params }),
    }),
    createPublicBooking: builder.mutation<{ appointment_id: number; confirmation_number: string; service_name: string; date: string; time: string }, any>({
      query: (body) => ({ url: '/booking/appointments', method: 'POST', body }),
    }),
  }),
});

export const {
  useGetBranchesQuery,
  useGetDashboardQuery,
  useGetCustomersQuery, useGetCustomerQuery, useCreateCustomerMutation, useUpdateCustomerMutation, useGetCustomerHistoryQuery,
  useGetStaffQuery, useGetStaffMemberQuery, useCreateStaffMutation, useUpdateStaffMutation,
  useGetServiceCategoriesQuery, useCreateServiceCategoryMutation, useUpdateServiceCategoryMutation, useDeleteServiceCategoryMutation, useGetServicesQuery, useCreateServiceMutation, useUpdateServiceMutation,
  useGetAppointmentsQuery, useGetCalendarAppointmentsQuery, useGetAvailableSlotsQuery,
  useCreateAppointmentMutation, useUpdateAppointmentStatusMutation, useCancelAppointmentMutation,
  useGetQueueQuery, useCreateCheckInMutation, useUpdateCheckInStatusMutation, useLazyLookupCheckInQuery,
  useGetInvoicesQuery, useGetInvoiceQuery, useCreateInvoiceMutation, useRecordPaymentMutation, useValidateCouponMutation,
  useInitiateTerminalPaymentMutation, useGetTerminalStatusQuery, useLazyGetTerminalStatusQuery,
  useCreateStripeIntentMutation,
  useGetProductsQuery, useGetStockLevelsQuery, useAdjustStockMutation, useCreateProductMutation,
  useGetRevenueReportQuery, useGetStaffPerformanceQuery, useGetServiceReportQuery,
  useGetCampaignsQuery, useCreateCampaignMutation, useSendCampaignMutation,
  useGetCommissionsQuery, useGetCommissionSummaryQuery,
  useGetMembershipPlansQuery, useCreateMembershipPlanMutation, useUpdateMembershipPlanMutation, useDeleteMembershipPlanMutation,
  useGetCustomerMembershipsQuery, useAssignMembershipMutation,
  useGetGiftCardsQuery, useCreateGiftCardMutation, useValidateGiftCardQuery, useRedeemGiftCardMutation,
  useGetCustomerLoyaltyQuery,
  useGetAIAppointmentSuggestionMutation, useGenerateAICampaignMutation, useGetRetentionAlertsQuery, useGetSmartScheduleQuery,
  useGetPublicSalonInfoQuery, useGetPublicServicesQuery, useGetPublicStaffQuery, useGetPublicSlotsQuery, useCreatePublicBookingMutation,
  useCreateBranchMutation, useUpdateBranchMutation,
  useListStaffQuery, useListServicesQuery,
  useListPayrollQuery, useGeneratePayrollMutation, useApprovePayrollMutation, useMarkPayrollPaidMutation, useGetPayrollSummaryQuery,
  useListPackagesQuery, useCreatePackageMutation, useUpdatePackageMutation, useDeletePackageMutation,
  useListWaitlistQuery, useAddToWaitlistMutation, useUpdateWaitlistMutation, useRemoveFromWaitlistMutation, useBookFromWaitlistMutation,
} = apiSlice;
