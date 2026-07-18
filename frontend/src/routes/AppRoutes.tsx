import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Suspense, lazy, Component, type ReactNode } from 'react';
import { CircularProgress, Box, Typography, Button } from '@mui/material';
import { Construction, ErrorOutline } from '@mui/icons-material';
import MainLayout from '@/components/layout/MainLayout';
import SuperAdminLayout from '@/components/layout/SuperAdminLayout';
import ProtectedRoute from './ProtectedRoute';

const LoginPage = lazy(() => import('@/pages/LoginPage'));
const DashboardPage = lazy(() => import('@/pages/DashboardPage'));
const CustomersPage = lazy(() => import('@/pages/CustomersPage'));
const CustomerProfilePage = lazy(() => import('@/pages/CustomerProfilePage'));
const StaffPage = lazy(() => import('@/pages/StaffPage'));
const StaffProfilePage = lazy(() => import('@/pages/StaffProfilePage'));
const AppointmentsPage = lazy(() => import('@/pages/AppointmentsPage'));
const CalendarPage = lazy(() => import('@/pages/CalendarPage'));
const CheckInPage = lazy(() => import('@/pages/CheckInPage'));
const BillingPOSPage = lazy(() => import('@/pages/BillingPOSPage'));
const InventoryPage = lazy(() => import('@/pages/InventoryPage'));
const ReportsPage = lazy(() => import('@/pages/ReportsPage'));
const ServicesPage = lazy(() => import('@/pages/ServicesPage'));
const SettingsPage = lazy(() => import('@/pages/SettingsPage'));
const MarketingPage = lazy(() => import('@/pages/MarketingPage'));
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'));

// New pages
const CommissionPage = lazy(() => import('@/pages/CommissionPage'));
const LoyaltyPage = lazy(() => import('@/pages/LoyaltyPage'));
const MembershipPage = lazy(() => import('@/pages/MembershipPage'));
const GiftCardsPage = lazy(() => import('@/pages/GiftCardsPage'));
const ServiceCategoriesPage = lazy(() => import('@/pages/ServiceCategoriesPage'));
const StaffAttendancePage = lazy(() => import('@/pages/StaffAttendancePage'));
const SuppliersPage = lazy(() => import('@/pages/SuppliersPage'));
const NotificationsPage = lazy(() => import('@/pages/NotificationsPage'));
const BookingPortalPage = lazy(() => import('@/pages/BookingPortalPage'));
const AIPage = lazy(() => import('@/pages/AIPage'));
const AutomationPage = lazy(() => import('@/pages/AutomationPage'));
const CustomerPortalPage = lazy(() => import('@/pages/CustomerPortalPage'));
const LandingPage = lazy(() => import('@/pages/LandingPage'));

// New pages
const PayrollPage = lazy(() => import('@/pages/PayrollPage'));
const PackagesPage = lazy(() => import('@/pages/PackagesPage'));
const WaitlistPage = lazy(() => import('@/pages/WaitlistPage'));
const MultiLocationPage = lazy(() => import('@/pages/MultiLocationPage'));

// Super Admin pages
const SuperAdminDashboard = lazy(() => import('@/pages/admin/SuperAdminDashboard'));
const SalonManagementPage = lazy(() => import('@/pages/admin/SalonManagementPage'));
const SubscriptionPlansPage = lazy(() => import('@/pages/admin/SubscriptionPlansPage'));
const FeatureTogglesPage = lazy(() => import('@/pages/admin/FeatureTogglesPage'));
const GlobalReportsPage = lazy(() => import('@/pages/admin/GlobalReportsPage'));
const AdminUsersPage = lazy(() => import('@/pages/admin/AdminUsersPage'));

const FullPageLoader = () => (
  <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', bgcolor: '#F8F5FF' }}>
    <CircularProgress color="primary" />
  </Box>
);

export const PageLoader = () => (
  <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
    <CircularProgress color="primary" />
  </Box>
);

function ComingSoon({ feature }: { feature: string }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '50vh', gap: 2 }}>
      <Construction sx={{ fontSize: 64, color: 'text.disabled' }} />
      <Typography variant="h5" fontWeight={700} color="text.secondary">{feature}</Typography>
      <Typography variant="body2" color="text.disabled">This feature is coming soon.</Typography>
      <Button variant="outlined" onClick={() => window.history.back()}>Go Back</Button>
    </Box>
  );
}

interface ErrorBoundaryState { hasError: boolean; error: Error | null }
interface ErrorBoundaryProps { children: ReactNode; locationKey: string }

class AppErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    console.error('[AppErrorBoundary] render error:', error.message);
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    if (this.state.hasError && prevProps.locationKey !== this.props.locationKey) {
      this.setState({ hasError: false, error: null });
    }
  }

  reset = () => {
    this.setState({ hasError: false, error: null });
    window.history.back();
  };

  render() {
    if (this.state.hasError) {
      return (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: 2, bgcolor: '#F8F5FF' }}>
          <ErrorOutline sx={{ fontSize: 64, color: 'error.main' }} />
          <Typography variant="h6" fontWeight={700}>Something went wrong loading this page</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 400, textAlign: 'center' }}>
            {this.state.error?.message || 'A page component failed to render.'}
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
            <Button variant="outlined" onClick={this.reset}>Go Back</Button>
            <Button variant="contained" onClick={() => window.location.reload()}>Refresh Page</Button>
          </Box>
        </Box>
      );
    }
    return this.props.children;
  }
}

function AppRoutesInner() {
  const { pathname } = useLocation();

  return (
    <AppErrorBoundary locationKey={pathname}>
      <Suspense fallback={<FullPageLoader />}>
        <Routes>
          {/* ── Public routes — no auth required ── */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/book" element={<BookingPortalPage />} />
          <Route path="/portal" element={<CustomerPortalPage />} />

          <Route element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
            <Route path="/dashboard" element={<DashboardPage />} />

            <Route path="/appointments" element={<AppointmentsPage />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/checkin" element={<CheckInPage />} />

            <Route path="/customers" element={<CustomersPage />} />
            <Route path="/customers/:id" element={<CustomerProfilePage />} />
            <Route path="/customers/memberships" element={<MembershipPage />} />

            <Route path="/loyalty" element={<LoyaltyPage />} />
            <Route path="/gift-cards" element={<GiftCardsPage />} />

            <Route path="/staff" element={<StaffPage />} />
            <Route path="/staff/attendance" element={<StaffAttendancePage />} />
            <Route path="/staff/commissions" element={<CommissionPage />} />
            <Route path="/staff/payroll" element={<PayrollPage />} />
            <Route path="/staff/:id" element={<StaffProfilePage />} />

            <Route path="/services" element={<ServicesPage />} />
            <Route path="/services/categories" element={<ServiceCategoriesPage />} />
            <Route path="/services/packages" element={<PackagesPage />} />

            <Route path="/billing" element={<BillingPOSPage />} />

            <Route path="/inventory" element={<Navigate to="/inventory/products" replace />} />
            <Route path="/inventory/products" element={<InventoryPage defaultTab={0} key="products" />} />
            <Route path="/inventory/stock" element={<InventoryPage defaultTab={1} key="stock" />} />
            <Route path="/inventory/orders" element={<InventoryPage defaultTab={2} key="orders" />} />
            <Route path="/inventory/suppliers" element={<SuppliersPage />} />

            <Route path="/marketing" element={<MarketingPage />} />
            <Route path="/automation" element={<AutomationPage />} />
            <Route path="/ai" element={<AIPage />} />

            <Route path="/reports" element={<Navigate to="/reports/revenue" replace />} />
            <Route path="/reports/revenue" element={<ReportsPage tab="revenue" key="revenue" />} />
            <Route path="/reports/staff" element={<ReportsPage tab="staff" key="staff" />} />
            <Route path="/reports/services" element={<ReportsPage tab="services" key="services" />} />
            <Route path="/reports/customers" element={<ReportsPage tab="customers" key="customers" />} />
            <Route path="/reports/inventory" element={<ReportsPage tab="inventory" key="inventory" />} />

            <Route path="/waitlist" element={<WaitlistPage />} />
            <Route path="/locations" element={<MultiLocationPage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>

          {/* ── Super Admin Portal ── */}
          <Route element={<ProtectedRoute roles={['super_admin']}><SuperAdminLayout /></ProtectedRoute>}>
            <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="/admin/dashboard" element={<SuperAdminDashboard />} />
            <Route path="/admin/salons" element={<SalonManagementPage />} />
            <Route path="/admin/plans" element={<SubscriptionPlansPage />} />
            <Route path="/admin/features" element={<FeatureTogglesPage />} />
            <Route path="/admin/reports" element={<GlobalReportsPage />} />
            <Route path="/admin/users" element={<AdminUsersPage />} />
            <Route path="/admin/notifications" element={<ComingSoon feature="Notification Config" />} />
            <Route path="/admin/settings" element={<ComingSoon feature="Platform Settings" />} />
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </AppErrorBoundary>
  );
}

export default function AppRoutes() {
  return <AppRoutesInner />;
}
