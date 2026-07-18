import { useState } from 'react';
import ComingSoon from '@/components/ComingSoon';
import {
  Box, Card, CardContent, Typography, Grid, Tabs, Tab, Button,
  Chip, LinearProgress, MenuItem, Select, FormControl, InputLabel,
} from '@mui/material';
import { LineChart } from '@mui/x-charts/LineChart';
import { BarChart } from '@mui/x-charts/BarChart';
import { PieChart } from '@mui/x-charts/PieChart';
import { DataGrid, type GridColDef } from '@mui/x-data-grid';
import { Download, TrendingUp, People, ContentCut, Inventory2, TableRows, BarChartOutlined } from '@mui/icons-material';
import NoRowsOverlay from '@/components/NoRowsOverlay';
import {
  useGetRevenueReportQuery, useGetStaffPerformanceQuery,
  useGetServiceReportQuery,
} from '@/features/api/apiSlice';
import dayjs from 'dayjs';
import { useSalon } from '@/context/SalonContext';

interface ReportsPageProps {
  tab?: string;
}

const SERVICE_COLORS = ['#6C3FC5', '#FF6B6B', '#4CAF50', '#FF9800', '#2196F3', '#E91E63', '#009688', '#FF5722'];

export default function ReportsPage({ tab = 'revenue' }: ReportsPageProps) {
  const { formatCurrency, formatDate } = useSalon();
  const [activeTab, setActiveTab] = useState(tab);
  const [dateRange, setDateRange] = useState('30');

  const dateFrom = dayjs().subtract(parseInt(dateRange), 'day').format('YYYY-MM-DD');
  const dateTo = dayjs().format('YYYY-MM-DD');

  const { data: revenueData, isLoading: revLoading } = useGetRevenueReportQuery({ date_from: dateFrom, date_to: dateTo });
  const { data: staffData } = useGetStaffPerformanceQuery({ date_from: dateFrom, date_to: dateTo });
  const { data: serviceData } = useGetServiceReportQuery({ date_from: dateFrom, date_to: dateTo });

  // ── Revenue chart data ─────────────────────────────────────────────────
  const revLabels = revenueData?.data?.map((d) => formatDate(d.period)) ?? [];
  const revValues = revenueData?.data?.map((d) => d.revenue) ?? [];
  const invoiceLabels = revenueData?.data?.slice(-14).map((d) => formatDate(d.period)) ?? [];
  const invoiceCounts = revenueData?.data?.slice(-14).map((d) => d.invoice_count) ?? [];

  // ── Services pie data ──────────────────────────────────────────────────
  const servicePieData = (serviceData?.services?.slice(0, 8) ?? []).map((s, i) => ({
    id: i, value: s.revenue, label: s.service_name, color: SERVICE_COLORS[i % SERVICE_COLORS.length],
  }));

  // ── Revenue table columns ──────────────────────────────────────────────
  const revenueColumns: GridColDef[] = [
    { field: 'period', headerName: 'Date', flex: 1, valueFormatter: (v: string) => formatDate(v) },
    { field: 'revenue', headerName: 'Revenue', flex: 1, type: 'number', align: 'right', headerAlign: 'right', valueFormatter: (v: number) => formatCurrency(v), cellClassName: 'font-semibold' },
    { field: 'tax', headerName: 'Tax', flex: 1, type: 'number', align: 'right', headerAlign: 'right', valueFormatter: (v: number) => formatCurrency(v ?? 0) },
    { field: 'discount', headerName: 'Discount', flex: 1, type: 'number', align: 'right', headerAlign: 'right', valueFormatter: (v: number) => formatCurrency(v ?? 0) },
    { field: 'invoice_count', headerName: 'Invoices', flex: 0.7, type: 'number', align: 'right', headerAlign: 'right' },
  ];

  // ── Staff performance columns ──────────────────────────────────────────
  const staffColumns: GridColDef[] = [
    {
      field: 'staff_name', headerName: 'Staff Member', flex: 1.5,
      valueGetter: (_v: unknown, row: { name?: string; staff_name: string }) => row.name ?? row.staff_name,
    },
    {
      field: 'total_appointments', headerName: 'Appointments', flex: 1, type: 'number', align: 'right', headerAlign: 'right',
      valueGetter: (_v: unknown, row: { total_appointments?: number; total_services: number }) => row.total_appointments ?? row.total_services,
    },
    { field: 'total_revenue', headerName: 'Revenue', flex: 1, type: 'number', align: 'right', headerAlign: 'right', valueFormatter: (v: number) => formatCurrency(v) },
    {
      field: 'average_rating', headerName: 'Rating', flex: 0.8, type: 'number', align: 'center', headerAlign: 'center',
      renderCell: (params) => (
        <Chip label={`⭐ ${(params.value as number).toFixed(1)}`} size="small" color="warning" variant="outlined" />
      ),
    },
    {
      field: '_perf', headerName: 'Performance', flex: 1.5, sortable: false,
      renderCell: (params) => {
        const staffList = staffData?.staff ?? [];
        const maxAppts = Math.max(...staffList.map((s) => s.total_appointments ?? (s as { total_services?: number }).total_services ?? 0), 1);
        const appts = params.row.total_appointments ?? params.row.total_services ?? 0;
        const pct = (appts / maxAppts) * 100;
        return (
          <Box sx={{ width: '100%', pt: 1 }}>
            <LinearProgress variant="determinate" value={pct} sx={{ height: 8, borderRadius: 4, bgcolor: 'rgba(108,63,197,0.12)', '& .MuiLinearProgress-bar': { background: 'linear-gradient(90deg, #6C3FC5, #9B72E8)', borderRadius: 4 } }} />
          </Box>
        );
      },
    },
  ];

  // ── Service table columns ──────────────────────────────────────────────
  const serviceColumns: GridColDef[] = [
    { field: 'service_name', headerName: 'Service', flex: 1.5 },
    { field: 'count', headerName: 'Count', flex: 0.7, type: 'number', align: 'right', headerAlign: 'right' },
    { field: 'revenue', headerName: 'Revenue', flex: 1, type: 'number', align: 'right', headerAlign: 'right', valueFormatter: (v: number) => formatCurrency(v) },
  ];

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>Reports & Analytics</Typography>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>Date Range</InputLabel>
            <Select value={dateRange} onChange={(e) => setDateRange(e.target.value)} label="Date Range">
              <MenuItem value="7">Last 7 days</MenuItem>
              <MenuItem value="30">Last 30 days</MenuItem>
              <MenuItem value="90">Last 90 days</MenuItem>
              <MenuItem value="365">Last year</MenuItem>
            </Select>
          </FormControl>
          <Button variant="outlined" startIcon={<Download />} size="small">Export</Button>
        </Box>
      </Box>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)}>
          <Tab value="revenue" label="Revenue" icon={<TrendingUp fontSize="small" />} iconPosition="start" />
          <Tab value="staff" label="Staff Performance" icon={<People fontSize="small" />} iconPosition="start" />
          <Tab value="services" label="Services" icon={<ContentCut fontSize="small" />} iconPosition="start" />
          <Tab value="customers" label="Customers" icon={<People fontSize="small" />} iconPosition="start" />
          <Tab value="inventory" label="Inventory" icon={<Inventory2 fontSize="small" />} iconPosition="start" />
        </Tabs>
      </Box>

      {/* ── REVENUE TAB ── */}
      {activeTab === 'revenue' && (
        <Box>
          {/* KPI cards */}
          <Grid container spacing={2.5} mb={3}>
            {[
              { label: 'Total Revenue', value: formatCurrency(revenueData?.total_revenue || 0), color: '#6C3FC5' },
              { label: 'Total Invoices', value: revenueData?.total_invoices || 0, color: '#2196F3' },
              { label: 'Avg Invoice Value', value: revenueData?.total_invoices ? formatCurrency(Math.round(revenueData.total_revenue / revenueData.total_invoices)) : formatCurrency(0), color: '#4CAF50' },
            ].map((kpi) => (
              <Grid item xs={12} sm={4} key={kpi.label}>
                <Card>
                  <CardContent sx={{ textAlign: 'center', py: 2 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>{kpi.label}</Typography>
                    <Typography variant="h4" fontWeight={800} sx={{ color: kpi.color, mt: 0.5 }}>{kpi.value}</Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          <Grid container spacing={2.5}>
            <Grid item xs={12} lg={8}>
              <Card>
                <CardContent sx={{ p: 2.5 }}>
                  <Typography variant="h6" fontWeight={600} mb={1}>Revenue Trend</Typography>
                  {revLoading ? (
                    <LinearProgress />
                  ) : revValues.length === 0 ? (
                    <Box sx={{ height: 260, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                      <BarChartOutlined sx={{ fontSize: 48, color: 'text.disabled' }} />
                      <Typography variant="body2" color="text.secondary">No revenue data for this period</Typography>
                      <Typography variant="caption" color="text.disabled">Record payments via Billing / POS to see the trend</Typography>
                    </Box>
                  ) : (
                    <LineChart
                      height={260}
                      xAxis={[{ data: revLabels, scaleType: 'point', tickLabelStyle: { fontSize: 10 } }]}
                      yAxis={[{ valueFormatter: (v: number | null) => v !== null ? formatCurrency(v) : '' }]}
                      series={[{ data: revValues, area: true, color: '#6C3FC5', showMark: false, label: 'Revenue' }]}
                      margin={{ left: 80, right: 16, top: 16, bottom: 36 }}
                      sx={{ '& .MuiAreaElement-root': { fillOpacity: 0.1 } }}
                    />
                  )}
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} lg={4}>
              <Card>
                <CardContent sx={{ p: 2.5 }}>
                  <Typography variant="h6" fontWeight={600} mb={1}>Daily Invoices</Typography>
                  {invoiceCounts.length === 0 ? (
                    <Box sx={{ height: 260, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                      <BarChartOutlined sx={{ fontSize: 40, color: 'text.disabled' }} />
                      <Typography variant="body2" color="text.secondary">No invoices yet</Typography>
                    </Box>
                  ) : (
                    <BarChart
                      height={260}
                      xAxis={[{ data: invoiceLabels, scaleType: 'band', tickLabelStyle: { fontSize: 10 } }]}
                      series={[{ data: invoiceCounts, color: '#9B72E8', label: 'Invoices' }]}
                      margin={{ left: 40, right: 16, top: 16, bottom: 36 }}
                      borderRadius={6}
                    />
                  )}
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Revenue DataGrid */}
          <Card sx={{ mt: 2.5 }}>
            <CardContent sx={{ p: 2.5 }}>
              <Typography variant="h6" fontWeight={600} mb={2}>Daily Revenue Breakdown</Typography>
              <DataGrid
                rows={revenueData?.data?.slice(-30).reverse() ?? []}
                columns={revenueColumns}
                getRowId={(row) => row.period}
                autoHeight
                pageSizeOptions={[10, 25]}
                initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
                disableRowSelectionOnClick
                slots={{ noRowsOverlay: () => <NoRowsOverlay message="No revenue records" subtext="Invoices will appear here once payments are recorded" icon={<TableRows />} /> }}
                sx={{ border: 0, '& .MuiDataGrid-columnHeaders': { bgcolor: 'grey.50' } }}
              />
            </CardContent>
          </Card>
        </Box>
      )}

      {/* ── STAFF TAB ── */}
      {activeTab === 'staff' && (
        <Card>
          <CardContent sx={{ p: 2.5 }}>
            <Typography variant="h6" fontWeight={600} mb={2}>Staff Performance</Typography>
            <DataGrid
              rows={staffData?.staff ?? []}
              columns={staffColumns}
              getRowId={(row) => row.staff_id}
              autoHeight
              pageSizeOptions={[10, 25]}
              initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
              disableRowSelectionOnClick
              slots={{ noRowsOverlay: () => <NoRowsOverlay message="No staff data" icon={<People />} /> }}
              sx={{ border: 0, '& .MuiDataGrid-columnHeaders': { bgcolor: 'grey.50' } }}
            />
          </CardContent>
        </Card>
      )}

      {/* ── SERVICES TAB ── */}
      {activeTab === 'services' && (
        <Grid container spacing={2.5}>
          <Grid item xs={12} lg={7}>
            <Card>
              <CardContent sx={{ p: 2.5 }}>
                <Typography variant="h6" fontWeight={600} mb={2}>Revenue by Service</Typography>
                <DataGrid
                  rows={serviceData?.services ?? []}
                  columns={serviceColumns}
                  getRowId={(row) => row.service_id ?? row.service_name}
                  autoHeight
                  pageSizeOptions={[10, 25]}
                  initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
                  disableRowSelectionOnClick
                  slots={{ noRowsOverlay: () => <NoRowsOverlay message="No service data" icon={<ContentCut />} /> }}
                  sx={{ border: 0, '& .MuiDataGrid-columnHeaders': { bgcolor: 'grey.50' } }}
                />
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} lg={5}>
            <Card>
              <CardContent sx={{ p: 2.5 }}>
                <Typography variant="h6" fontWeight={600} mb={1}>Service Distribution</Typography>
                <PieChart
                  height={300}
                  series={[{
                    data: servicePieData,
                    innerRadius: 55,
                    outerRadius: 110,
                    paddingAngle: 2,
                    cornerRadius: 4,
                  }]}
                  margin={{ top: 8, bottom: 60, left: 8, right: 8 }}
                  sx={{ '& .MuiChartsLegend-root': { display: 'none' } }}
                />
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* ── CUSTOMERS TAB ── */}
      {activeTab === 'customers' && (
        <ComingSoon
          compact
          title="Customer Analytics"
          description="Deep-dive into retention rates, visit frequency, average spend, and customer lifetime value — all in one view."
          eta="Q3 2026"
          features={['Retention Heatmap', 'Visit Frequency', 'LTV Analysis', 'Churn Prediction', 'Segment Reports']}
        />
      )}

      {/* ── INVENTORY TAB ── */}
      {activeTab === 'inventory' && (
        <ComingSoon
          compact
          title="Inventory Reports"
          description="Track product sales velocity, stock turnover, margin by SKU, and low-stock alerts across all branches."
          eta="Q3 2026"
          features={['Sales Velocity', 'Stock Turnover', 'Margin by SKU', 'Shrinkage Report', 'Branch Comparison']}
        />
      )}
    </Box>
  );
}
