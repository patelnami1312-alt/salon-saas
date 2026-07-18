import { useState } from 'react';
import toast from 'react-hot-toast';
import {
  Box, Typography, Card, CardContent, Button, Chip, Grid,
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Alert, IconButton, Autocomplete, Avatar,
  MenuItem, Select, FormControl, InputLabel,
} from '@mui/material';
import { Add, CalendarMonth, Delete, CheckCircle, AccessTime } from '@mui/icons-material';
import { DataGrid, type GridColDef } from '@mui/x-data-grid';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
dayjs.extend(relativeTime);
import {
  useListWaitlistQuery,
  useAddToWaitlistMutation,
  useUpdateWaitlistMutation,
  useRemoveFromWaitlistMutation,
  useBookFromWaitlistMutation,
  useGetCustomersQuery,
  useListServicesQuery,
  useListStaffQuery,
} from '@/features/api/apiSlice';

const STATUS_COLOR: Record<string, 'warning' | 'success' | 'error' | 'default'> = {
  Waiting: 'warning', Booked: 'success', Cancelled: 'error',
};

function AddToWaitlistDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [form, setForm] = useState({
    customer_id: null as number | null,
    service_id: null as number | null,
    staff_id: null as number | null,
    preferred_date: dayjs().format('YYYY-MM-DD'),
    preferred_time: '',
    notes: '',
  });
  const [customerSearch, setCustomerSearch] = useState('');
  const [serviceSearch, setServiceSearch] = useState('');

  const { data: custData } = useGetCustomersQuery({ search: customerSearch, page_size: 20 });
  const { data: svcData } = useListServicesQuery();
  const { data: staffData } = useListStaffQuery({});

  const [add, { isLoading }] = useAddToWaitlistMutation();
  const [formErrors, setFormErrors] = useState({ customer_id: '', service_id: '' });
  const [submitError, setSubmitError] = useState('');

  const handleSubmit = async () => {
    const errs = {
      customer_id: !form.customer_id ? 'Please select a customer.' : '',
      service_id: !form.service_id ? 'Please select a service.' : '',
    };
    setFormErrors(errs);
    if (errs.customer_id || errs.service_id) return;
    setSubmitError('');
    try {
      await add({
        customer_id: form.customer_id!,
        service_id: form.service_id!,
        staff_id: form.staff_id || undefined,
        preferred_date: form.preferred_date,
        preferred_time: form.preferred_time || undefined,
        notes: form.notes || undefined,
      }).unwrap();
      onClose();
    } catch (e: any) {
      setSubmitError(e?.data?.detail ?? 'Failed to add to waitlist. Please try again.');
    }
  };

  const customers = custData?.items ?? [];
  const services = (svcData ?? []).filter((s) => s.service_name.toLowerCase().includes(serviceSearch.toLowerCase()));
  const staff = staffData?.items ?? [];

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Add to Waitlist</DialogTitle>
      <DialogContent>
        {submitError && <Alert severity="error" sx={{ mb: 2 }}>{submitError}</Alert>}
        <Grid container spacing={2} mt={0}>
          <Grid item xs={12}>
            <Autocomplete
              options={customers}
              getOptionLabel={(o: any) => `${o.full_name} · ${o.phone || o.email}`}
              onChange={(_, v) => { setForm((p) => ({ ...p, customer_id: v?.customer_id ?? null })); if (formErrors.customer_id) setFormErrors((p) => ({ ...p, customer_id: '' })); }}
              inputValue={customerSearch}
              onInputChange={(_, v) => setCustomerSearch(v)}
              renderInput={(params) => (
                <TextField {...params} label="Customer *"
                  error={!!formErrors.customer_id} helperText={formErrors.customer_id} />
              )}
              filterOptions={(x) => x}
              noOptionsText="No customers found"
            />
          </Grid>
          <Grid item xs={12}>
            <Autocomplete
              options={services}
              getOptionLabel={(o: any) => `${o.service_name} — ${o.duration}min`}
              onChange={(_, v) => { setForm((p) => ({ ...p, service_id: v?.service_id ?? null })); if (formErrors.service_id) setFormErrors((p) => ({ ...p, service_id: '' })); }}
              inputValue={serviceSearch}
              onInputChange={(_, v) => setServiceSearch(v)}
              renderInput={(params) => (
                <TextField {...params} label="Service *"
                  error={!!formErrors.service_id} helperText={formErrors.service_id} />
              )}
              filterOptions={(x) => x}
              noOptionsText="No services found"
            />
          </Grid>
          <Grid item xs={12}>
            <FormControl fullWidth>
              <InputLabel>Preferred Staff (Optional)</InputLabel>
              <Select
                value={form.staff_id ?? ''}
                label="Preferred Staff (Optional)"
                onChange={(e) => setForm((p) => ({ ...p, staff_id: e.target.value ? Number(e.target.value) : null }))}
              >
                <MenuItem value="">Any Staff</MenuItem>
                {staff.map((s: any) => (
                  <MenuItem key={s.staff_id} value={s.staff_id}>{s.user?.first_name} {s.user?.last_name}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Preferred Date" type="date" fullWidth value={form.preferred_date}
              onChange={(e) => setForm((p) => ({ ...p, preferred_date: e.target.value }))}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Preferred Time" type="time" fullWidth value={form.preferred_time}
              onChange={(e) => setForm((p) => ({ ...p, preferred_time: e.target.value }))}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField label="Notes" fullWidth multiline rows={2} value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSubmit} variant="contained" disabled={isLoading}>
          {isLoading ? 'Adding…' : 'Add to Waitlist'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function BookDialog({ entry, open, onClose }: { entry: any; open: boolean; onClose: () => void }) {
  const [date, setDate] = useState(entry?.preferred_date ?? dayjs().format('YYYY-MM-DD'));
  const [time, setTime] = useState(entry?.preferred_time?.slice(0, 5) ?? '');
  const [book, { isLoading }] = useBookFromWaitlistMutation();

  const handleBook = async () => {
    if (!date || !time) {
      toast.error('Please enter both date and time.');
      return;
    }
    try {
      await book({ id: entry.waitlist_id, body: { appointment_date: date, start_time: time } }).unwrap();
      toast.success('Appointment booked from waitlist');
      onClose();
    } catch (e: any) {
      toast.error(e?.data?.detail ?? 'Failed to book appointment');
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Book Appointment</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" mb={2}>
          Booking <strong>{entry?.customer_name}</strong> for <strong>{entry?.service_name}</strong>
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <TextField label="Date *" type="date" fullWidth value={date}
              onChange={(e) => setDate(e.target.value)} InputLabelProps={{ shrink: true }} />
          </Grid>
          <Grid item xs={12}>
            <TextField label="Start Time *" type="time" fullWidth value={time}
              onChange={(e) => setTime(e.target.value)} InputLabelProps={{ shrink: true }} />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleBook} variant="contained" color="success" disabled={isLoading || !date || !time}>
          {isLoading ? 'Booking…' : 'Confirm Booking'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default function WaitlistPage() {
  const [addOpen, setAddOpen] = useState(false);
  const [bookEntry, setBookEntry] = useState<any | null>(null);
  const [dateFilter, setDateFilter] = useState('');
  const [page, setPage] = useState(0);

  const { data, isLoading, refetch } = useListWaitlistQuery({
    preferred_date: dateFilter || undefined,
    page: page + 1,
    page_size: 50,
  });

  const [remove] = useRemoveFromWaitlistMutation();

  const columns: GridColDef[] = [
    {
      field: 'customer_name', headerName: 'Customer', flex: 1, minWidth: 140,
      renderCell: ({ row }) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Avatar sx={{ width: 28, height: 28, fontSize: 12, bgcolor: '#6C3FC5' }}>
            {row.customer_name?.[0]}
          </Avatar>
          <Box>
            <Typography variant="body2" fontWeight={600}>{row.customer_name}</Typography>
            <Typography variant="caption" color="text.secondary">{row.customer_phone}</Typography>
          </Box>
        </Box>
      ),
    },
    { field: 'service_name', headerName: 'Service', flex: 1, minWidth: 130 },
    { field: 'staff_name', headerName: 'Preferred Staff', width: 140, valueFormatter: (value: any) => value || 'Any' },
    {
      field: 'preferred_date', headerName: 'Preferred', width: 160,
      renderCell: ({ row }) => (
        <Box>
          <Typography variant="body2">{row.preferred_date ?? '—'}</Typography>
          <Typography variant="caption" color="text.secondary">{row.preferred_time?.slice(0, 5) ?? 'Any time'}</Typography>
        </Box>
      ),
    },
    {
      field: 'status', headerName: 'Status', width: 100,
      renderCell: ({ value }) => <Chip label={value} size="small" color={STATUS_COLOR[value] ?? 'default'} />,
    },
    {
      field: 'created_at', headerName: 'Added', width: 100,
      valueFormatter: (value: any) => value ? dayjs(value).fromNow() : '—',
    },
    {
      field: 'actions', headerName: '', width: 120, sortable: false,
      renderCell: ({ row }) => row.status === 'Waiting' ? (
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <Button size="small" variant="outlined" color="success" onClick={(e) => { e.stopPropagation(); setBookEntry(row); }}
            startIcon={<CheckCircle sx={{ fontSize: '14px !important' }} />} sx={{ fontSize: 11, px: 1 }}>
            Book
          </Button>
          <IconButton size="small" color="error" onClick={(e) => { e.stopPropagation(); remove(row.waitlist_id); }}>
            <Delete fontSize="small" />
          </IconButton>
        </Box>
      ) : null,
    },
  ];

  const rows = (data?.items ?? []).map((w: any) => ({ id: w.waitlist_id, ...w }));

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Waitlist</Typography>
          <Typography variant="body2" color="text.secondary">
            {data?.total ?? 0} people waiting for appointments
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button startIcon={<CalendarMonth />} variant="outlined" size="small" onClick={() => refetch()}>Refresh</Button>
          <Button startIcon={<Add />} variant="contained" onClick={() => setAddOpen(true)}>
            Add to Waitlist
          </Button>
        </Box>
      </Box>

      {/* Summary cards */}
      <Grid container spacing={2} mb={3}>
        {[
          { label: 'Waiting', value: (data?.items ?? []).filter((w: any) => w.status === 'Waiting').length, color: '#FF9800' },
          { label: 'Booked Today', value: (data?.items ?? []).filter((w: any) => w.status === 'Booked').length, color: '#4CAF50' },
          { label: 'Total Added', value: data?.total ?? 0, color: '#6C3FC5' },
        ].map((s) => (
          <Grid item xs={12} sm={4} key={s.label}>
            <Card sx={{ border: `1px solid ${s.color}30` }}>
              <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                <Typography variant="h4" fontWeight={800} sx={{ color: s.color }}>{s.value}</Typography>
                <Typography variant="body2" color="text.secondary">{s.label}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Filter */}
      <Card sx={{ mb: 2 }}>
        <Box sx={{ p: 2, display: 'flex', gap: 2, alignItems: 'center' }}>
          <TextField
            label="Filter by date" type="date" size="small" value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            InputLabelProps={{ shrink: true }}
            InputProps={{ startAdornment: <AccessTime sx={{ mr: 0.5, color: 'text.disabled', fontSize: 18 }} /> }}
          />
          {dateFilter && <Button size="small" onClick={() => setDateFilter('')}>Clear</Button>}
        </Box>
      </Card>

      <Card>
        <DataGrid
          rows={rows}
          columns={columns}
          loading={isLoading}
          rowCount={data?.total ?? 0}
          paginationMode="server"
          paginationModel={{ page, pageSize: 50 }}
          onPaginationModelChange={(m) => setPage(m.page)}
          pageSizeOptions={[50]}
          autoHeight
          disableColumnMenu
          sx={{ border: 'none', '& .MuiDataGrid-row:hover': { cursor: 'default' } }}
          rowHeight={64}
        />
      </Card>

      <AddToWaitlistDialog open={addOpen} onClose={() => setAddOpen(false)} />
      {bookEntry && <BookDialog entry={bookEntry} open={!!bookEntry} onClose={() => setBookEntry(null)} />}
    </Box>
  );
}
