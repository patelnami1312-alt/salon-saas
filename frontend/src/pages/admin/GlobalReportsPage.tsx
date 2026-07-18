import { Box, Typography, Grid, Card, CardContent, Chip, Alert } from '@mui/material';
import { LineChart } from '@mui/x-charts/LineChart';
import { BarChart } from '@mui/x-charts/BarChart';
import { useGetGlobalReportsQuery } from '@/features/api/adminApiSlice';
import { DataGrid, type GridColDef } from '@mui/x-data-grid';

export default function GlobalReportsPage() {
  const { data, isLoading, isError } = useGetGlobalReportsQuery('monthly');

  const revLabels = (data?.revenue_trend ?? []).map((d: any) => d.month);
  const revValues = (data?.revenue_trend ?? []).map((d: any) => d.revenue);

  const growthLabels = (data?.salon_growth ?? []).map((d: any) => d.month);
  const growthValues = (data?.salon_growth ?? []).map((d: any) => d.total_salons);

  const topCols: GridColDef[] = [
    { field: 'salon_name', headerName: 'Salon', flex: 1.5 },
    { field: 'status', headerName: 'Status', width: 110, renderCell: ({ value }) => <Chip label={value} size="small" color={value === 'Active' ? 'success' : 'default'} /> },
    { field: 'plan_revenue', headerName: 'Plan Value', width: 130, valueFormatter: ({ value }: any) => `$${Number(value ?? 0).toLocaleString()}` },
  ];

  const topRows = (data?.top_salons_by_revenue ?? []).map((r: any, i: number) => ({ id: i, ...r }));

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>Global Reports</Typography>
        <Typography variant="body2" color="text.secondary">Revenue and growth across all salons</Typography>
      </Box>

      {isError && <Alert severity="warning" sx={{ mb: 2 }}>Could not load report data.</Alert>}

      <Grid container spacing={2.5}>
        {/* Revenue Trend */}
        <Grid item xs={12} lg={8}>
          <Card>
            <CardContent sx={{ p: 2.5 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="h6" fontWeight={600}>Subscription Revenue</Typography>
                <Chip label="Last 12 months" size="small" color="error" variant="outlined" />
              </Box>
              {revValues.length === 0 ? (
                <Box sx={{ height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Typography color="text.secondary" variant="body2">No data yet</Typography>
                </Box>
              ) : (
                <LineChart
                  height={240}
                  xAxis={[{ data: revLabels, scaleType: 'point', tickLabelStyle: { fontSize: 10 } }]}
                  yAxis={[{ valueFormatter: (v: number | null) => v !== null ? `$${v.toLocaleString()}` : '' }]}
                  series={[{ data: revValues, area: true, color: '#E94560', showMark: false, label: 'Revenue ($)' }]}
                  margin={{ left: 80, right: 16, top: 16, bottom: 32 }}
                  sx={{ '& .MuiAreaElement-root': { fillOpacity: 0.1 } }}
                />
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Salon Growth */}
        <Grid item xs={12} lg={4}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ p: 2.5 }}>
              <Typography variant="h6" fontWeight={600} mb={1}>Salon Growth</Typography>
              {growthValues.length === 0 ? (
                <Box sx={{ height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Typography color="text.secondary" variant="body2">No data</Typography>
                </Box>
              ) : (
                <BarChart
                  height={240}
                  xAxis={[{ data: growthLabels, scaleType: 'band', tickLabelStyle: { fontSize: 10 } }]}
                  series={[{ data: growthValues, label: 'Total Salons', color: '#6C3FC5' }]}
                  margin={{ left: 40, right: 16, top: 16, bottom: 32 }}
                  borderRadius={6}
                />
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Top Salons Table */}
        <Grid item xs={12}>
          <Card>
            <CardContent sx={{ p: 2.5 }}>
              <Typography variant="h6" fontWeight={600} mb={2}>Top Salons by Plan Value</Typography>
              <DataGrid
                rows={topRows}
                columns={topCols}
                autoHeight
                hideFooter
                disableColumnMenu
                loading={isLoading}
                sx={{ border: 'none' }}
              />
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
