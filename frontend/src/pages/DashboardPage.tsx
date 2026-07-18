import { useMemo } from 'react';
import {
  Box, Grid, Card, CardContent, Typography,
  LinearProgress, Chip, Button, Alert,
} from '@mui/material';
import { People, CalendarMonth, AttachMoney, HowToReg, Refresh, TrendingUp } from '@mui/icons-material';
import StatCard from '@/components/StatCard';
import { LineChart } from '@mui/x-charts/LineChart';
import { BarChart } from '@mui/x-charts/BarChart';
import { PieChart } from '@mui/x-charts/PieChart';
import { useGetDashboardQuery, useGetRevenueReportQuery } from '@/features/api/apiSlice';
import { useAppSelector } from '@/app/hooks';
import { useSalon } from '@/context/SalonContext';
import dayjs from 'dayjs';

const SERVICE_COLORS = ['#6C3FC5', '#FF6B6B', '#4CAF50', '#FF9800', '#2196F3', '#E91E63'];

export default function DashboardPage() {
  const branchId = useAppSelector((s) => s.dashboard.selectedBranchId);
  const { data: dashboard, isLoading, isError, refetch } = useGetDashboardQuery({ branch_id: branchId || undefined });
  const { formatCurrency, formatDate, formatNumber } = useSalon();

  const dateFrom = dayjs().subtract(30, 'day').format('YYYY-MM-DD');
  const dateTo = dayjs().format('YYYY-MM-DD');
  const { data: revenueData } = useGetRevenueReportQuery({ date_from: dateFrom, date_to: dateTo });

  const revenueSlice = useMemo(() => revenueData?.data?.slice(-14) ?? [], [revenueData]);
  const revenueLabels = useMemo(() => revenueSlice.map((d) => formatDate(d.period)), [revenueSlice, formatDate]);
  const revenueValues = useMemo(() => revenueSlice.map((d) => d.revenue), [revenueSlice]);

  const serviceData = useMemo(() => [
    { id: 0, value: 35, label: 'Haircut', color: SERVICE_COLORS[0] },
    { id: 1, value: 22, label: 'Facial', color: SERVICE_COLORS[1] },
    { id: 2, value: 18, label: 'Hair Color', color: SERVICE_COLORS[2] },
    { id: 3, value: 12, label: 'Threading', color: SERVICE_COLORS[3] },
    { id: 4, value: 8, label: 'Spa', color: SERVICE_COLORS[4] },
    { id: 5, value: 5, label: 'Makeup', color: SERVICE_COLORS[5] },
  ], []);

  const weekLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const completedData = [24, 18, 22, 30, 28, 42, 15];
  const cancelledData = [2, 3, 1, 2, 4, 3, 1];

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Dashboard</Typography>
          <Typography variant="body2" color="text.secondary">{dayjs().format('dddd, MMMM D, YYYY')}</Typography>
        </Box>
        <Button startIcon={<Refresh />} variant="outlined" size="small" onClick={() => refetch()}>
          Refresh
        </Button>
      </Box>

      {/* API error banner */}
      {isError && !isLoading && (
        <Alert severity="warning" sx={{ mb: 2, borderRadius: 2 }} onClose={() => {}}>
          Could not load live data. Showing last known values or zeros. Check backend connection.
        </Alert>
      )}

      {/* Stat Cards */}
      <Grid container spacing={2.5} mb={3}>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard
            title="Today's Revenue"
            value={formatCurrency(dashboard?.today_revenue ?? 0)}
            subtitle={`Weekly: ${formatCurrency(dashboard?.weekly_revenue ?? 0)}`}
            icon={<AttachMoney />} color="#6C3FC5" trend={12} loading={isLoading}
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard
            title="Today's Appointments"
            value={dashboard?.today_appointments ?? 0}
            subtitle={`${dashboard?.pending_appointments ?? 0} pending`}
            icon={<CalendarMonth />} color="#2196F3" trend={5} loading={isLoading}
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard
            title="Total Customers"
            value={formatNumber(dashboard?.total_customers ?? 0)}
            subtitle={`+${dashboard?.new_customers_today ?? 0} today`}
            icon={<People />} color="#4CAF50" trend={8} loading={isLoading}
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard
            title="In Queue"
            value={dashboard?.in_queue ?? 0}
            subtitle="Currently waiting"
            icon={<HowToReg />} color="#FF9800" loading={isLoading}
          />
        </Grid>
      </Grid>

      {/* Charts */}
      <Grid container spacing={2.5} alignItems="stretch">
        {/* Revenue Trend — LineChart */}
        <Grid item xs={12} lg={8} sx={{ display: 'flex' }}>
          <Card sx={{ flex: 1 }}>
            <CardContent sx={{ p: 2.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="h6" fontWeight={600}>Revenue Trend</Typography>
                <Chip label="Last 14 days" size="small" color="primary" variant="outlined" />
              </Box>
              {revenueValues.length === 0 ? (
                <Box sx={{ height: 240, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1.5 }}>
                  <TrendingUp sx={{ fontSize: 48, color: 'text.disabled' }} />
                  <Typography variant="body2" color="text.secondary" fontWeight={500}>No revenue data yet</Typography>
                  <Typography variant="caption" color="text.disabled">Record payments in Billing / POS to see the trend</Typography>
                </Box>
              ) : (
                <LineChart
                  height={240}
                  xAxis={[{ data: revenueLabels, scaleType: 'point', tickLabelStyle: { fontSize: 11 } }]}
                  yAxis={[{ valueFormatter: (v: number | null) => v !== null ? formatCurrency(v) : '' }]}
                  series={[{
                    data: revenueValues,
                    area: true,
                    color: '#6C3FC5',
                    showMark: false,
                    label: 'Revenue',
                  }]}
                  margin={{ left: 80, right: 16, top: 16, bottom: 32 }}
                  sx={{ '& .MuiAreaElement-root': { fillOpacity: 0.12 } }}
                />
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Services — PieChart */}
        <Grid item xs={12} lg={4} sx={{ display: 'flex' }}>
          <Card sx={{ flex: 1 }}>
            <CardContent sx={{ p: 2.5 }}>
              <Typography variant="h6" fontWeight={600} mb={1}>Services</Typography>
              <PieChart
                height={240}
                series={[{
                  data: serviceData,
                  innerRadius: 55,
                  outerRadius: 95,
                  paddingAngle: 2,
                  cornerRadius: 4,
                  highlightScope: { fade: 'global', highlight: 'item' },
                }]}
                margin={{ top: 8, bottom: 8, left: 8, right: 8 }}
                sx={{ '& .MuiChartsLegend-root': { display: 'none' } }}
              />
            </CardContent>
          </Card>
        </Grid>

        {/* Weekly Appointments — BarChart */}
        <Grid item xs={12} lg={8} sx={{ display: 'flex' }}>
          <Card sx={{ flex: 1 }}>
            <CardContent sx={{ p: 2.5 }}>
              <Typography variant="h6" fontWeight={600} mb={1}>Weekly Appointments</Typography>
              <BarChart
                height={240}
                xAxis={[{ data: weekLabels, scaleType: 'band', tickLabelStyle: { fontSize: 11 } }]}
                series={[
                  { data: completedData, label: 'Completed', color: '#6C3FC5' },
                  { data: cancelledData, label: 'Cancelled', color: '#FF6B6B' },
                ]}
                margin={{ left: 40, right: 16, top: 16, bottom: 32 }}
                borderRadius={6}
              />
            </CardContent>
          </Card>
        </Grid>

        {/* Monthly Summary */}
        <Grid item xs={12} lg={4} sx={{ display: 'flex' }}>
          <Card sx={{ flex: 1 }}>
            <CardContent sx={{ p: 2.5 }}>
              <Typography variant="h6" fontWeight={600} mb={2}>Monthly Summary</Typography>
              {[
                { label: 'Revenue', value: formatCurrency(dashboard?.monthly_revenue ?? 0), progress: 72, color: '#6C3FC5' },
                { label: 'Appointments', value: '284', progress: 65, color: '#2196F3' },
                { label: 'New Customers', value: '48', progress: 48, color: '#4CAF50' },
                { label: 'Avg Invoice', value: formatCurrency(890), progress: 55, color: '#FF9800' },
              ].map((item) => (
                <Box key={item.label} mb={2}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography variant="body2" color="text.secondary">{item.label}</Typography>
                    <Typography variant="body2" fontWeight={600}>{item.value}</Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={item.progress}
                    sx={{
                      height: 6, borderRadius: 3,
                      bgcolor: `${item.color}20`,
                      '& .MuiLinearProgress-bar': { bgcolor: item.color, borderRadius: 3 },
                    }}
                  />
                </Box>
              ))}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
