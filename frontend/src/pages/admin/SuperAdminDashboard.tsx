import { Box, Grid, Card, CardContent, Typography, Chip, LinearProgress, Alert } from '@mui/material';
import { Store, AttachMoney, TrendingUp, People, Refresh } from '@mui/icons-material';
import { Button } from '@mui/material';
import StatCard from '@/components/StatCard';
import { LineChart } from '@mui/x-charts/LineChart';
import { PieChart } from '@mui/x-charts/PieChart';
import { BarChart } from '@mui/x-charts/BarChart';
import { useGetSuperAdminDashboardQuery } from '@/features/api/adminApiSlice';

const STATUS_COLORS: Record<string, string> = {
  Active: '#4CAF50',
  Trial: '#2196F3',
  Expired: '#FF9800',
  Cancelled: '#F44336',
  Suspended: '#9C27B0',
};

export default function SuperAdminDashboard() {
  const { data, isLoading, isError, refetch } = useGetSuperAdminDashboardQuery();

  const trendLabels = data?.monthly_trend?.map((d: any) => d.month) ?? [];
  const trendValues = data?.monthly_trend?.map((d: any) => d.revenue) ?? [];

  const pieData = (data?.status_breakdown ?? []).map((s: any, i: number) => ({
    id: i,
    value: s.count,
    label: s.status,
    color: STATUS_COLORS[s.status] ?? '#999',
  }));

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Super Admin Dashboard</Typography>
          <Typography variant="body2" color="text.secondary">SaaS platform overview — all salons</Typography>
        </Box>
        <Button startIcon={<Refresh />} variant="outlined" size="small" onClick={() => refetch()}>
          Refresh
        </Button>
      </Box>

      {isError && (
        <Alert severity="warning" sx={{ mb: 2 }}>Could not load live data. Backend may be offline.</Alert>
      )}

      {/* KPI Cards */}
      <Grid container spacing={2.5} mb={3}>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard
            title="Total Salons"
            value={data?.total_salons ?? 0}
            subtitle={`${data?.active_salons ?? 0} active · ${data?.trial_salons ?? 0} trial`}
            icon={<Store />} color="#E94560" trend={data?.new_salons_this_month ?? 0}
            loading={isLoading}
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard
            title="MRR"
            value={`$${(data?.mrr ?? 0).toLocaleString()}`}
            subtitle="Monthly Recurring Revenue"
            icon={<AttachMoney />} color="#4CAF50"
            trend={data?.revenue_growth_pct ?? 0}
            loading={isLoading}
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard
            title="Revenue This Month"
            value={`$${(data?.revenue_this_month ?? 0).toLocaleString()}`}
            subtitle={`Last month: $${(data?.revenue_last_month ?? 0).toLocaleString()}`}
            icon={<TrendingUp />} color="#2196F3"
            trend={data?.revenue_growth_pct ?? 0}
            loading={isLoading}
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard
            title="Total Platform Users"
            value={data?.total_users ?? 0}
            subtitle={`${(data?.total_customers ?? 0).toLocaleString()} customers`}
            icon={<People />} color="#9C27B0"
            loading={isLoading}
          />
        </Grid>
      </Grid>

      {/* Charts */}
      <Grid container spacing={2.5} alignItems="stretch">
        {/* Revenue Trend */}
        <Grid item xs={12} lg={8} sx={{ display: 'flex' }}>
          <Card sx={{ flex: 1 }}>
            <CardContent sx={{ p: 2.5 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="h6" fontWeight={600}>Subscription Revenue Trend</Typography>
                <Chip label="Last 6 months" size="small" color="error" variant="outlined" />
              </Box>
              {trendValues.length === 0 ? (
                <Box sx={{ height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Typography color="text.secondary" variant="body2">No subscription revenue yet</Typography>
                </Box>
              ) : (
                <LineChart
                  height={240}
                  xAxis={[{ data: trendLabels, scaleType: 'point', tickLabelStyle: { fontSize: 11 } }]}
                  yAxis={[{ valueFormatter: (v: number | null) => v !== null ? `$${v.toLocaleString()}` : '' }]}
                  series={[{ data: trendValues, area: true, color: '#E94560', showMark: false, label: 'Revenue' }]}
                  margin={{ left: 80, right: 16, top: 16, bottom: 32 }}
                  sx={{ '& .MuiAreaElement-root': { fillOpacity: 0.12 } }}
                />
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Salon Status Breakdown */}
        <Grid item xs={12} lg={4} sx={{ display: 'flex' }}>
          <Card sx={{ flex: 1 }}>
            <CardContent sx={{ p: 2.5 }}>
              <Typography variant="h6" fontWeight={600} mb={1}>Salon Status</Typography>
              {pieData.length === 0 ? (
                <Box sx={{ height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Typography color="text.secondary" variant="body2">No salons yet</Typography>
                </Box>
              ) : (
                <>
                  <PieChart
                    height={180}
                    series={[{
                      data: pieData, innerRadius: 45, outerRadius: 80, paddingAngle: 2, cornerRadius: 4,
                      highlightScope: { fade: 'global', highlight: 'item' },
                    }]}
                    margin={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    sx={{ '& .MuiChartsLegend-root': { display: 'none' } }}
                  />
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 1 }}>
                    {pieData.map((d: any) => (
                      <Chip key={d.label} label={`${d.label}: ${d.value}`} size="small"
                        sx={{ bgcolor: `${d.color}22`, color: d.color, fontWeight: 600, fontSize: 11 }} />
                    ))}
                  </Box>
                </>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* New Salons This Month Summary */}
        <Grid item xs={12} lg={4} sx={{ display: 'flex' }}>
          <Card sx={{ flex: 1 }}>
            <CardContent sx={{ p: 2.5 }}>
              <Typography variant="h6" fontWeight={600} mb={2}>Platform Health</Typography>
              {[
                { label: 'Active Salons', value: data?.active_salons ?? 0, max: data?.total_salons ?? 1, color: '#4CAF50' },
                { label: 'On Trial', value: data?.trial_salons ?? 0, max: data?.total_salons ?? 1, color: '#2196F3' },
                { label: 'New This Month', value: data?.new_salons_this_month ?? 0, max: Math.max(data?.total_salons ?? 1, 10), color: '#E94560' },
              ].map((item) => (
                <Box key={item.label} mb={2}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography variant="body2" color="text.secondary">{item.label}</Typography>
                    <Typography variant="body2" fontWeight={600}>{item.value}</Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={Math.round((item.value / item.max) * 100)}
                    sx={{ height: 6, borderRadius: 3, bgcolor: `${item.color}20`, '& .MuiLinearProgress-bar': { bgcolor: item.color, borderRadius: 3 } }}
                  />
                </Box>
              ))}
            </CardContent>
          </Card>
        </Grid>

        {/* Revenue by month bar */}
        <Grid item xs={12} lg={8} sx={{ display: 'flex' }}>
          <Card sx={{ flex: 1 }}>
            <CardContent sx={{ p: 2.5 }}>
              <Typography variant="h6" fontWeight={600} mb={1}>Monthly Revenue (6 months)</Typography>
              {trendValues.length === 0 ? (
                <Box sx={{ height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Typography color="text.secondary" variant="body2">No data yet</Typography>
                </Box>
              ) : (
                <BarChart
                  height={240}
                  xAxis={[{ data: trendLabels, scaleType: 'band', tickLabelStyle: { fontSize: 10 } }]}
                  series={[{ data: trendValues, label: 'Revenue', color: '#E94560' }]}
                  margin={{ left: 70, right: 16, top: 16, bottom: 32 }}
                  borderRadius={6}
                />
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
