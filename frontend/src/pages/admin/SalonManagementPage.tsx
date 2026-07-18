import { useState } from 'react';
import {
  Box, Typography, Card, CardContent, Button, TextField, InputAdornment,
  Chip, IconButton, Dialog, DialogTitle, DialogContent, DialogActions,
  Grid, MenuItem, Select, FormControl, InputLabel, Alert, Tooltip,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
} from '@mui/material';
import {
  Search, Add, Edit, Block, CheckCircle, Visibility,
  Store, CreditCard, People,
} from '@mui/icons-material';
import { DataGrid, type GridColDef } from '@mui/x-data-grid';
import {
  useListAdminSalonsQuery, useCreateAdminSalonMutation,
  useUpdateAdminSalonMutation, useSuspendSalonMutation, useActivateSalonMutation,
  useListAdminPlansQuery, useAssignPlanMutation,
  useGetAdminSalonDetailQuery,
} from '@/features/api/adminApiSlice';

const STATUS_COLOR: Record<string, 'success' | 'info' | 'warning' | 'error' | 'default'> = {
  Active: 'success', Trial: 'info', Expired: 'warning', Cancelled: 'error', Suspended: 'default',
};

function SalonDetailDialog({ salonId, open, onClose }: { salonId: number | null; open: boolean; onClose: () => void }) {
  const { data } = useGetAdminSalonDetailQuery(salonId!, { skip: !salonId });
  const [assignOpen, setAssignOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState('');
  const { data: plans } = useListAdminPlansQuery();
  const [assignPlan] = useAssignPlanMutation();
  const [suspend] = useSuspendSalonMutation();
  const [activate] = useActivateSalonMutation();

  if (!data) return null;

  const handleAssign = async () => {
    if (!salonId || !selectedPlan) return;
    await assignPlan({ salonId, body: { plan_id: Number(selectedPlan) } });
    setAssignOpen(false);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" fontWeight={700}>{data.salon_name}</Typography>
          <Chip label={data.subscription_status} color={STATUS_COLOR[data.subscription_status] ?? 'default'} size="small" />
        </Box>
      </DialogTitle>
      <DialogContent>
        <Grid container spacing={2} mt={0}>
          <Grid item xs={12} sm={6}>
            <Typography variant="body2" color="text.secondary">Owner</Typography>
            <Typography fontWeight={600}>{data.owner_name || '—'}</Typography>
          </Grid>
          <Grid item xs={12} sm={6}>
            <Typography variant="body2" color="text.secondary">Email</Typography>
            <Typography fontWeight={600}>{data.email}</Typography>
          </Grid>
          <Grid item xs={12} sm={6}>
            <Typography variant="body2" color="text.secondary">Plan</Typography>
            <Typography fontWeight={600}>{data.subscription_plan_name || 'No plan'}</Typography>
          </Grid>
          <Grid item xs={12} sm={6}>
            <Typography variant="body2" color="text.secondary">Trial Expiry</Typography>
            <Typography fontWeight={600}>{data.trial_expiry_date ? new Date(data.trial_expiry_date).toLocaleDateString() : '—'}</Typography>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Card variant="outlined" sx={{ textAlign: 'center', p: 1 }}>
              <Typography variant="h5" fontWeight={700} color="primary">{data.staff_count}</Typography>
              <Typography variant="caption" color="text.secondary">Staff</Typography>
            </Card>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Card variant="outlined" sx={{ textAlign: 'center', p: 1 }}>
              <Typography variant="h5" fontWeight={700} color="primary">{data.customer_count}</Typography>
              <Typography variant="caption" color="text.secondary">Customers</Typography>
            </Card>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Card variant="outlined" sx={{ textAlign: 'center', p: 1 }}>
              <Typography variant="h5" fontWeight={700} color="primary">{data.branches?.length ?? 0}</Typography>
              <Typography variant="caption" color="text.secondary">Branches</Typography>
            </Card>
          </Grid>
          <Grid item xs={12}>
            <Typography variant="subtitle2" fontWeight={600} mb={1}>Subscription History</Typography>
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Plan</TableCell>
                    <TableCell>Start</TableCell>
                    <TableCell>End</TableCell>
                    <TableCell>Amount</TableCell>
                    <TableCell>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(data.subscription_history ?? []).map((s: any) => (
                    <TableRow key={s.sub_id}>
                      <TableCell>{s.plan_name}</TableCell>
                      <TableCell>{s.start_date}</TableCell>
                      <TableCell>{s.end_date}</TableCell>
                      <TableCell>${s.amount}</TableCell>
                      <TableCell><Chip label={s.status} size="small" color={STATUS_COLOR[s.status] ?? 'default'} /></TableCell>
                    </TableRow>
                  ))}
                  {(data.subscription_history ?? []).length === 0 && (
                    <TableRow><TableCell colSpan={5} align="center"><Typography variant="body2" color="text.secondary">No subscription history</Typography></TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, gap: 1, flexWrap: 'wrap' }}>
        <Button onClick={() => setAssignOpen(true)} variant="outlined" startIcon={<CreditCard />} size="small">
          Assign Plan
        </Button>
        {data.is_active ? (
          <Button onClick={() => { suspend(data.salon_id); onClose(); }} color="error" variant="outlined" startIcon={<Block />} size="small">
            Suspend
          </Button>
        ) : (
          <Button onClick={() => { activate(data.salon_id); onClose(); }} color="success" variant="outlined" startIcon={<CheckCircle />} size="small">
            Activate
          </Button>
        )}
        <Box sx={{ flex: 1 }} />
        <Button onClick={onClose}>Close</Button>
      </DialogActions>

      {/* Assign Plan Dialog */}
      <Dialog open={assignOpen} onClose={() => setAssignOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Assign Subscription Plan</DialogTitle>
        <DialogContent>
          <FormControl fullWidth sx={{ mt: 1 }}>
            <InputLabel>Plan</InputLabel>
            <Select value={selectedPlan} label="Plan" onChange={(e) => setSelectedPlan(e.target.value)}>
              {(plans ?? []).map((p: any) => (
                <MenuItem key={p.plan_id} value={p.plan_id}>
                  {p.plan_name} — ${p.price}/{p.billing_cycle}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAssignOpen(false)}>Cancel</Button>
          <Button onClick={handleAssign} variant="contained" disabled={!selectedPlan}>Assign</Button>
        </DialogActions>
      </Dialog>
    </Dialog>
  );
}

const EMPTY_FORM = { salon_name: '', email: '', owner_name: '', phone: '', currency: 'USD', timezone: 'America/New_York', trial_days: 14 };
const EMPTY_ERRORS = { salon_name: '', email: '', owner_name: '', phone: '', trial_days: '' };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[+\d\s\-().]{7,20}$/;

function validateForm(form: typeof EMPTY_FORM, errors: typeof EMPTY_ERRORS) {
  const e = { ...errors };

  // Salon Name
  if (!form.salon_name.trim()) e.salon_name = 'Salon name is required.';
  else if (form.salon_name.trim().length < 2) e.salon_name = 'Must be at least 2 characters.';
  else if (form.salon_name.trim().length > 200) e.salon_name = 'Cannot exceed 200 characters.';
  else e.salon_name = '';

  // Email
  if (!form.email.trim()) e.email = 'Owner email is required.';
  else if (!EMAIL_RE.test(form.email.trim())) e.email = 'Enter a valid email address.';
  else e.email = '';

  // Owner Name (optional but if provided check length)
  if (form.owner_name && form.owner_name.trim().length > 200) e.owner_name = 'Cannot exceed 200 characters.';
  else e.owner_name = '';

  // Phone (optional but if provided validate format)
  if (form.phone && !PHONE_RE.test(form.phone.trim())) e.phone = 'Enter a valid phone number.';
  else e.phone = '';

  // Trial Days
  const days = Number(form.trial_days);
  if (isNaN(days) || days < 0) e.trial_days = 'Cannot be negative.';
  else if (days > 365) e.trial_days = 'Maximum 365 days.';
  else e.trial_days = '';

  return e;
}

function CreateSalonDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState(EMPTY_ERRORS);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitError, setSubmitError] = useState('');
  const [createSalon, { isLoading }] = useCreateAdminSalonMutation();

  // Reset everything when dialog opens
  const handleClose = () => {
    setForm(EMPTY_FORM);
    setFieldErrors(EMPTY_ERRORS);
    setTouched({});
    setSubmitError('');
    onClose();
  };

  const handleChange = (k: keyof typeof EMPTY_FORM) => (e: any) => {
    const val = e.target.value;
    setForm((prev) => ({ ...prev, [k]: val }));
    // Re-validate this field immediately if already touched
    if (touched[k]) {
      const updated = { ...form, [k]: val };
      const errs = validateForm(updated, fieldErrors);
      setFieldErrors(errs);
    }
  };

  const handleBlur = (k: keyof typeof EMPTY_FORM) => () => {
    setTouched((prev) => ({ ...prev, [k]: true }));
    const errs = validateForm(form, fieldErrors);
    setFieldErrors(errs);
  };

  const err = (k: keyof typeof EMPTY_ERRORS) => touched[k] ? fieldErrors[k] : '';

  const handleSubmit = async () => {
    // Mark all fields touched and run full validation
    const allTouched = Object.keys(EMPTY_FORM).reduce((acc, k) => ({ ...acc, [k]: true }), {});
    setTouched(allTouched);
    const errs = validateForm(form, EMPTY_ERRORS);
    setFieldErrors(errs);
    const hasError = Object.values(errs).some(Boolean);
    if (hasError) return;

    setSubmitError('');
    try {
      await createSalon({ ...form, trial_days: Number(form.trial_days) }).unwrap();
      handleClose();
    } catch (e: any) {
      const detail = e?.data?.detail ?? '';
      // Map known backend errors to specific fields
      const detailStr = typeof detail === 'string' ? detail.toLowerCase() : '';
      if (detailStr.includes('email') && (detailStr.includes('duplicate') || detailStr.includes('unique') || detailStr.includes('already'))) {
        setFieldErrors((prev) => ({ ...prev, email: 'This email is already registered to another salon.' }));
        setTouched((prev) => ({ ...prev, email: true }));
      } else if (typeof detail === 'string' && detail) {
        setSubmitError(detail);
      } else if (Array.isArray(detail)) {
        // FastAPI validation errors — map to fields where possible
        const mapped = { ...EMPTY_ERRORS };
        let unmatched: string[] = [];
        detail.forEach((d: any) => {
          const field = d.loc?.[d.loc.length - 1] as string;
          if (field && field in mapped) mapped[field as keyof typeof mapped] = d.msg;
          else unmatched.push(d.msg);
        });
        setFieldErrors(mapped);
        setTouched(allTouched);
        if (unmatched.length) setSubmitError(unmatched.join('. '));
      } else {
        setSubmitError('Something went wrong. Please try again.');
      }
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle fontWeight={700}>Onboard New Salon</DialogTitle>
      <DialogContent>
        {submitError && <Alert severity="error" sx={{ mb: 2 }}>{submitError}</Alert>}
        <Grid container spacing={2} mt={0}>

          <Grid item xs={12}>
            <TextField
              label="Salon Name *" fullWidth autoFocus
              value={form.salon_name}
              onChange={handleChange('salon_name')}
              onBlur={handleBlur('salon_name')}
              error={!!err('salon_name')}
              helperText={err('salon_name') || 'The public-facing name of the salon.'}
            />
          </Grid>

          <Grid item xs={12}>
            <TextField
              label="Owner Email *" fullWidth type="email"
              value={form.email}
              onChange={handleChange('email')}
              onBlur={handleBlur('email')}
              error={!!err('email')}
              helperText={err('email') || 'Must be unique — used for the owner login account.'}
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              label="Owner Name" fullWidth
              value={form.owner_name}
              onChange={handleChange('owner_name')}
              onBlur={handleBlur('owner_name')}
              error={!!err('owner_name')}
              helperText={err('owner_name')}
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              label="Phone" fullWidth
              value={form.phone}
              onChange={handleChange('phone')}
              onBlur={handleBlur('phone')}
              error={!!err('phone')}
              helperText={err('phone') || 'e.g. +1-310-555-0100'}
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <FormControl fullWidth>
              <InputLabel>Currency</InputLabel>
              <Select value={form.currency} label="Currency" onChange={handleChange('currency')}>
                {['USD', 'EUR', 'GBP', 'INR', 'CAD', 'AUD'].map((c) => (
                  <MenuItem key={c} value={c}>{c}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              label="Trial Days" type="number" fullWidth
              value={form.trial_days}
              onChange={handleChange('trial_days')}
              onBlur={handleBlur('trial_days')}
              error={!!err('trial_days')}
              helperText={err('trial_days') || '0 = no trial. Max 365.'}
              inputProps={{ min: 0, max: 365 }}
            />
          </Grid>

        </Grid>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} disabled={isLoading}>Cancel</Button>
        <Button onClick={handleSubmit} variant="contained" disabled={isLoading}>
          {isLoading ? 'Creating…' : 'Create Salon'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default function SalonManagementPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);

  const { data, isLoading } = useListAdminSalonsQuery({ search, status: statusFilter, page: page + 1, page_size: 20 });

  const columns: GridColDef[] = [
    { field: 'salon_name', headerName: 'Salon', flex: 1.5, minWidth: 160 },
    { field: 'owner_name', headerName: 'Owner', flex: 1, minWidth: 120 },
    { field: 'email', headerName: 'Email', flex: 1.5, minWidth: 160 },
    {
      field: 'subscription_status', headerName: 'Status', width: 120,
      renderCell: ({ value }) => (
        <Chip label={value} size="small" color={STATUS_COLOR[value] ?? 'default'} />
      ),
    },
    { field: 'subscription_plan_name', headerName: 'Plan', width: 130, valueFormatter: (value: any) => value || 'No plan' },
    { field: 'created_at', headerName: 'Joined', width: 110, valueFormatter: (value: any) => value ? new Date(value).toLocaleDateString() : '—' },
    {
      field: 'actions', headerName: '', width: 60, sortable: false,
      renderCell: ({ row }) => (
        <Tooltip title="View details">
          <IconButton size="small" onClick={() => setDetailId(row.salon_id)}>
            <Visibility fontSize="small" />
          </IconButton>
        </Tooltip>
      ),
    },
  ];

  const rows = (data?.items ?? []).map((s: any) => ({ id: s.salon_id, ...s }));

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Salon Management</Typography>
          <Typography variant="body2" color="text.secondary">
            {data?.total ?? 0} salons on the platform
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<Add />} onClick={() => setCreateOpen(true)}
          sx={{ bgcolor: '#E94560', '&:hover': { bgcolor: '#c73652' } }}>
          Onboard Salon
        </Button>
      </Box>

      {/* Filters */}
      <Card sx={{ mb: 2 }}>
        <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <TextField
              size="small" placeholder="Search salons…" value={search} onChange={(e) => setSearch(e.target.value)}
              InputProps={{ startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment> }}
              sx={{ minWidth: 240 }}
            />
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Status</InputLabel>
              <Select value={statusFilter} label="Status" onChange={(e) => setStatusFilter(e.target.value)}>
                <MenuItem value="">All</MenuItem>
                {['Active', 'Trial', 'Expired', 'Cancelled', 'Suspended'].map((s) => (
                  <MenuItem key={s} value={s}>{s}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        </CardContent>
      </Card>

      {/* Grid */}
      <Card>
        <DataGrid
          rows={rows}
          columns={columns}
          loading={isLoading}
          rowCount={data?.total ?? 0}
          paginationMode="server"
          paginationModel={{ page, pageSize: 20 }}
          onPaginationModelChange={(m) => setPage(m.page)}
          pageSizeOptions={[20]}
          autoHeight
          disableColumnMenu
          sx={{ border: 'none', '& .MuiDataGrid-row:hover': { cursor: 'pointer' } }}
          onRowClick={({ row }) => setDetailId(row.salon_id)}
        />
      </Card>

      <CreateSalonDialog open={createOpen} onClose={() => setCreateOpen(false)} />
      <SalonDetailDialog salonId={detailId} open={!!detailId} onClose={() => setDetailId(null)} />
    </Box>
  );
}
