import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { RootState } from '@/app/store';

const BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';

export const adminApiSlice = createApi({
  reducerPath: 'adminApi',
  baseQuery: fetchBaseQuery({
    baseUrl: BASE_URL,
    prepareHeaders: (headers, { getState }) => {
      const token = (getState() as RootState).auth.accessToken
        || localStorage.getItem('access_token');
      if (token) headers.set('Authorization', `Bearer ${token}`);
      return headers;
    },
  }),
  tagTypes: ['AdminSalon', 'AdminPlan', 'AdminFeatures', 'AdminUser'],
  endpoints: (builder) => ({

    // ── Dashboard ───────────────────────────────────────────────────────────
    getSuperAdminDashboard: builder.query<any, void>({
      query: () => '/super-admin/dashboard',
    }),

    // ── Salons ──────────────────────────────────────────────────────────────
    listAdminSalons: builder.query<any, { search?: string; status?: string; page?: number; page_size?: number }>({
      query: (params) => ({ url: '/super-admin/salons', params }),
      providesTags: ['AdminSalon'],
    }),
    getAdminSalonDetail: builder.query<any, number>({
      query: (id) => `/super-admin/salons/${id}`,
      providesTags: (_, __, id) => [{ type: 'AdminSalon', id }],
    }),
    createAdminSalon: builder.mutation<any, any>({
      query: (body) => ({ url: '/super-admin/salons', method: 'POST', body }),
      invalidatesTags: ['AdminSalon'],
    }),
    updateAdminSalon: builder.mutation<any, { salonId: number; body: any }>({
      query: ({ salonId, body }) => ({ url: `/super-admin/salons/${salonId}`, method: 'PUT', body }),
      invalidatesTags: (_, __, { salonId }) => [{ type: 'AdminSalon', id: salonId }, 'AdminSalon'],
    }),
    suspendSalon: builder.mutation<any, number>({
      query: (id) => ({ url: `/super-admin/salons/${id}/suspend`, method: 'POST' }),
      invalidatesTags: (_, __, id) => [{ type: 'AdminSalon', id }, 'AdminSalon'],
    }),
    activateSalon: builder.mutation<any, number>({
      query: (id) => ({ url: `/super-admin/salons/${id}/activate`, method: 'POST' }),
      invalidatesTags: (_, __, id) => [{ type: 'AdminSalon', id }, 'AdminSalon'],
    }),
    assignPlan: builder.mutation<any, { salonId: number; body: any }>({
      query: ({ salonId, body }) => ({ url: `/super-admin/salons/${salonId}/assign-plan`, method: 'POST', body }),
      invalidatesTags: (_, __, { salonId }) => [{ type: 'AdminSalon', id: salonId }, 'AdminSalon'],
    }),

    // ── Subscription Plans ──────────────────────────────────────────────────
    listAdminPlans: builder.query<any, void>({
      query: () => '/super-admin/plans',
      providesTags: ['AdminPlan'],
    }),
    createAdminPlan: builder.mutation<any, any>({
      query: (body) => ({ url: '/super-admin/plans', method: 'POST', body }),
      invalidatesTags: ['AdminPlan'],
    }),
    updateAdminPlan: builder.mutation<any, { planId: number; body: any }>({
      query: ({ planId, body }) => ({ url: `/super-admin/plans/${planId}`, method: 'PUT', body }),
      invalidatesTags: ['AdminPlan'],
    }),
    deleteAdminPlan: builder.mutation<any, number>({
      query: (id) => ({ url: `/super-admin/plans/${id}`, method: 'DELETE' }),
      invalidatesTags: ['AdminPlan'],
    }),

    // ── Feature Flags ───────────────────────────────────────────────────────
    getFeatureFlags: builder.query<any, number>({
      query: (salonId) => `/super-admin/feature-flags/${salonId}`,
      providesTags: (_, __, id) => [{ type: 'AdminFeatures', id }],
    }),
    updateFeatureFlags: builder.mutation<any, { salonId: number; body: any }>({
      query: ({ salonId, body }) => ({ url: `/super-admin/feature-flags/${salonId}`, method: 'PUT', body }),
      invalidatesTags: (_, __, { salonId }) => [{ type: 'AdminFeatures', id: salonId }],
    }),

    // ── Global Reports ──────────────────────────────────────────────────────
    getGlobalReports: builder.query<any, string>({
      query: (period) => ({ url: '/super-admin/global-reports', params: { period } }),
    }),

    // ── Users ───────────────────────────────────────────────────────────────
    listAdminUsers: builder.query<any, { search?: string; role?: string; page?: number; page_size?: number }>({
      query: (params) => ({ url: '/super-admin/users', params }),
      providesTags: ['AdminUser'],
    }),
    createPlatformUser: builder.mutation<any, { first_name: string; last_name: string; email: string; phone?: string; role_code: string; salon_id?: number }>({
      query: (body) => ({ url: '/super-admin/users', method: 'POST', body }),
      invalidatesTags: ['AdminUser'],
    }),
    resetUserPassword: builder.mutation<{ temp_password: string; email: string; full_name: string }, number>({
      query: (userId) => ({ url: `/super-admin/users/${userId}/reset-password`, method: 'POST' }),
      invalidatesTags: ['AdminUser'],
    }),
    unlockUserAccount: builder.mutation<{ message: string }, number>({
      query: (userId) => ({ url: `/super-admin/users/${userId}/unlock`, method: 'POST' }),
      invalidatesTags: ['AdminUser'],
    }),
  }),
});

export const {
  useGetSuperAdminDashboardQuery,
  useListAdminSalonsQuery,
  useGetAdminSalonDetailQuery,
  useCreateAdminSalonMutation,
  useUpdateAdminSalonMutation,
  useSuspendSalonMutation,
  useActivateSalonMutation,
  useAssignPlanMutation,
  useListAdminPlansQuery,
  useCreateAdminPlanMutation,
  useUpdateAdminPlanMutation,
  useDeleteAdminPlanMutation,
  useGetFeatureFlagsQuery,
  useUpdateFeatureFlagsMutation,
  useGetGlobalReportsQuery,
  useListAdminUsersQuery,
  useCreatePlatformUserMutation,
  useResetUserPasswordMutation,
  useUnlockUserAccountMutation,
} = adminApiSlice;
