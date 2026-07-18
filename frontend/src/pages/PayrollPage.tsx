import { useState } from 'react';
import toast from 'react-hot-toast';
import {
  Box, Typography, Card, CardContent, Button, TextField, Chip,
  Grid, Dialog, DialogTitle, DialogContent, DialogActions,
  Alert, MenuItem, Select, FormControl, InputLabel, Tab, Tabs,
  Table, TableHead, TableRow, TableCell, TableBody, TableContainer, Paper,
  IconButton, Tooltip, InputAdornment,
} from '@mui/material';
import {
  Add, Check, Payments, Download, Refresh,
  AttachMoney, People, CalendarMonth,
} from '@mui/icons-material';
import { DataGrid, type GridColDef } from '@mui/x-data-grid';
import { useSalon } from '@/context/SalonContext';
import dayjs from 'dayjs';
import {
  useListPayrollQuery,
  useGeneratePayrollMutation,
  useApprovePayrollMutation,
  useMarkPayrollPaidMutation,
  useGetPayrollSummaryQuery,
} from '@/features/api/apiSlice';

const STATUS_COLOR: Record<string, 'default' | 'warning' | 'success' | 'info' | 'error'> = {
  Pending: 'warning', Approved: 'info', Paid: 'success',
};

function GenerateDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [periodStart, setPeriodStart] = useState(dayjs().startOf('month').format('YYYY-MM-DD'));
  const [periodEnd, setPeriodEnd] = useState(dayjs().endOf('month').format('YYYY-MM-DD'));
  const [generate, { isLoading, error }] = useGeneratePayrollMutation();

  const handleSubmit = async () => {
    if (!periodStart || !periodEnd) return;
    if (periodEnd < periodStart) {
      toast.error('Period end must be after period start');
      return;
    }
    try {
      await generate({ pay_period_start: periodStart, pay_period_end: periodEnd }).unwrap();
      toast.success('Payroll generated successfully');
      onClose();
    } catch (e: any) {
      toast.error(e?.data?.detail ?? 'Failed to generate payroll');
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Generate Payroll</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }}>Failed to generate payroll</Alert>}
        <Typography variant="body2" color="text.secondary" mb={2}>
          This will calculate base salary + commissions + attendance for all active staff in the selected period.
        </Typography>
        <Grid container spacing={2} mt={0}>
          <Grid item xs={12} sm={6}>
            <TextField label="Period Start *" type="date" fullWidth value={periodStart}
              onChange={(e) => setPeriodStart(e.target.value)} InputLabelProps={{ shrink: true }} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField label="Period End *" type="date" fullWidth value={periodEnd}
              onChange={(e) => setPeriodEnd(e.target.value)} InputLabelProps={{ shrink: true }} />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSubmit} variant="contained" disabled={isLoading} color="primary">
          {isLoading ? 'Generating…' : 'Generate'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function PayrollDetailDialog({ row, open, onClose }: { row: any; open: boolean; onClose: () => void }) {
  const { formatCurrency } = useSalon();
  const [approve, { isLoading: approving }] = useApprovePayrollMutation();
  const [markPaid, { isLoading: markingPaid }] = useMarkPayrollPaidMutation();

  if (!row) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" fontWeight={700}>{row.staff_name}</Typography>
          <Chip label={row.status} color={STATUS_COLOR[row.status] ?? 'default'} size="small" />
        </Box>
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" mb={2}>
          {row.pay_period_start} — {row.pay_period_end}
        </Typography>
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableBody>
              {[
                { label: 'Base Salary', value: formatCurrency(row.base_salary), bold: false },
                { label: 'Commission', value: formatCurrency(row.total_commission), bold: false },
                { label: 'Bonus', value: formatCurrency(row.bonus), bold: false },
                { label: 'Deductions', value: `- ${formatCurrency(row.total_deductions)}`, bold: false },
                { label: 'Net Pay', value: formatCurrency(row.net_pay), bold: true },
              ].map((r) => (
                <TableRow key={r.label}>
                  <TableCell sx={{ fontWeight: r.bold ? 700 : 400 }}>{r.label}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: r.bold ? 700 : 400, color: r.bold ? 'primary.main' : 'inherit' }}>
                    {r.value}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
          <Box sx={{ flex: 1, textAlign: 'center', p: 1.5, bgcolor: '#F4F6F9', borderRadius: 2 }}>
            <Typography variant="h6" fontWeight={700}>{row.present_days ?? '—'}</Typography>
            <Typography variant="caption" color="text.secondary">Days Present</Typography>
          </Box>
          <Box sx={{ flex: 1, textAlign: 'center', p: 1.5, bgcolor: '#F4F6F9', borderRadius: 2 }}>
            <Typography variant="h6" fontWeight={700}>{row.working_days ?? '—'}</Typography>
            <Typography variant="caption" color="text.secondary">Working Days</Typography>
          </Box>
        </Box>
      </DialogContent>
      <DialogActions>
        {row.status === 'Pending' && (
          <Button onClick={async () => { await approve(row.payroll_id); onClose(); }} color="info" variant="outlined" disabled={approving}>
            Approve
          </Button>
        )}
        {row.status === 'Approved' && (
          <Button onClick={async () => { await markPaid(row.payroll_id); onClose(); }} color="success" variant="contained" disabled={markingPaid}>
            Mark as Paid
          </Button>
        )}
        <Box sx={{ flex: 1 }} />
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}

export default function PayrollPage() {
  const { formatCurrency } = useSalon();
  const [tab, setTab] = useState(0);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [detailRow, setDetailRow] = useState<any | null>(null);
  const [page, setPage] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');
  const [periodStart] = useState(dayjs().startOf('month').format('YYYY-MM-DD'));
  const [periodEnd] = useState(dayjs().endOf('month').format('YYYY-MM-DD'));

  const { data, isLoading, refetch } = useListPayrollQuery({
    status: statusFilter || undefined,
    page: page + 1,
    page_size: 25,
  });

  const { data: summary } = useGetPayrollSummaryQuery({ pay_period_start: periodStart, pay_period_end: periodEnd });

  const columns: GridColDef[] = [
    { field: 'staff_name', headerName: 'Staff', flex: 1.2, minWidth: 140 },
    { field: 'job_title', headerName: 'Role', width: 130, valueFormatter: (value: any) => value || '—' },
    { field: 'pay_period_start', headerName: 'Period', flex: 1, minWidth: 160,
      renderCell: ({ row }: any) => `${row?.pay_period_start ?? ''} → ${row?.pay_period_end ?? ''}` },
    { field: 'base_salary', headerName: 'Base', width: 110, valueFormatter: (value: any) => formatCurrency(value) },
    { field: 'total_commission', headerName: 'Commission', width: 120, valueFormatter: (value: any) => formatCurrency(value) },
    { field: 'bonus', headerName: 'Bonus', width: 100, valueFormatter: (value: any) => formatCurrency(value) },
    { field: 'net_pay', headerName: 'Net Pay', width: 120, renderCell: ({ value }) => (
      <Typography fontWeight={700} color="primary.main">{formatCurrency(value)}</Typography>
    )},
    { field: 'status', headerName: 'Status', width: 110,
      renderCell: ({ value }) => <Chip label={value} size="small" color={STATUS_COLOR[value] ?? 'default'} /> },
  ];

  const rows = (data?.items ?? []).map((r: any) => ({ id: r.payroll_id, ...r }));

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Payroll</Typography>
          <Typography variant="body2" color="text.secondary">Staff salary, commissions & payments</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button startIcon={<Refresh />} variant="outlined" size="small" onClick={() => refetch()}>Refresh</Button>
          <Button startIcon={<Add />} variant="contained" color="primary" onClick={() => setGenerateOpen(true)}>
            Generate Payroll
          </Button>
        </Box>
      </Box>

      {/* Summary cards for this month */}
      <Grid container spacing={2} mb={3}>
        {[
          { label: 'Total Net Pay', value: formatCurrency(summary?.total_net_pay ?? 0), icon: <Payments />, color: '#6C3FC5' },
          { label: 'Base Salaries', value: formatCurrency(summary?.total_base_salary ?? 0), icon: <AttachMoney />, color: '#2196F3' },
          { label: 'Total Commission', value: formatCurrency(summary?.total_commission ?? 0), icon: <AttachMoney />, color: '#4CAF50' },
          { label: 'Staff Count', value: summary?.staff_count ?? 0, icon: <People />, color: '#FF9800' },
        ].map((item) => (
          <Grid item xs={12} sm={6} lg={3} key={item.label}>
            <Card>
              <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 2, '&:last-child': { pb: 2 } }}>
                <Box sx={{ width: 44, height: 44, borderRadius: 2, bgcolor: `${item.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: item.color }}>
                  {item.icon}
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary">{item.label}</Typography>
                  <Typography variant="h6" fontWeight={700}>{item.value}</Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Filters */}
      <Card sx={{ mb: 2 }}>
        <Box sx={{ p: 2, display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
          <Typography variant="body2" fontWeight={600}>Filter:</Typography>
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>Status</InputLabel>
            <Select value={statusFilter} label="Status" onChange={(e) => setStatusFilter(e.target.value)}>
              <MenuItem value="">All</MenuItem>
              <MenuItem value="Pending">Pending</MenuItem>
              <MenuItem value="Approved">Approved</MenuItem>
              <MenuItem value="Paid">Paid</MenuItem>
            </Select>
          </FormControl>
        </Box>
      </Card>

      <Card>
        <DataGrid
          rows={rows}
          columns={columns}
          loading={isLoading}
          rowCount={data?.total ?? 0}
          paginationMode="server"
          paginationModel={{ page, pageSize: 25 }}
          onPaginationModelChange={(m) => setPage(m.page)}
          pageSizeOptions={[25]}
          autoHeight
          disableColumnMenu
          onRowClick={({ row }) => setDetailRow(row)}
          sx={{ border: 'none', '& .MuiDataGrid-row:hover': { cursor: 'pointer' } }}
        />
      </Card>

      <GenerateDialog open={generateOpen} onClose={() => setGenerateOpen(false)} />
      <PayrollDetailDialog row={detailRow} open={!!detailRow} onClose={() => setDetailRow(null)} />
    </Box>
  );
}
