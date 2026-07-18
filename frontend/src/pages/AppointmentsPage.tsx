import { useState } from 'react';
import {
  Box, Card, Typography, Button, TextField, InputAdornment,
  Chip, IconButton, Dialog, DialogTitle, DialogContent,
  DialogActions, Grid, MenuItem, Select, FormControl, InputLabel,
  Tooltip, Alert, FormHelperText,
} from '@mui/material';
import { DataGrid, type GridColDef } from '@mui/x-data-grid';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import type { Dayjs } from 'dayjs';
import { Search, Add, Cancel, CalendarMonth } from '@mui/icons-material';
import { useGetAppointmentsQuery, useCreateAppointmentMutation, useCancelAppointmentMutation, useGetServicesQuery, useGetStaffQuery, useGetCustomersQuery } from '@/features/api/apiSlice';
import { useAppSelector } from '@/app/hooks';
import { useSalon } from '@/context/SalonContext';
import type { AppointmentStatus, Appointment } from '@/types';
import toast from 'react-hot-toast';
import { v, hasNoErrors } from '@/utils/formValidation';

const STATUS_COLORS: Record<AppointmentStatus, 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning'> = {
  Scheduled: 'info',
  Confirmed: 'success',
  CheckedIn: 'warning',
  InService: 'secondary',
  Completed: 'default',
  Cancelled: 'error',
  NoShow: 'error',
};

export default function AppointmentsPage() {
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [bookOpen, setBookOpen] = useState(false);
  const [form, setForm] = useState({ customer_id: '', service_id: '', staff_id: '', notes: '' });
  const [dateValue, setDateValue] = useState<Dayjs | null>(null);
  const [timeValue, setTimeValue] = useState<Dayjs | null>(null);
  const [bookErrors, setBookErrors] = useState({ customer_id: '', service_id: '', date: '', time: '' });
  const [bookTouched, setBookTouched] = useState<Record<string, boolean>>({});
  const [bookSubmitError, setBookSubmitError] = useState('');

  const { formatCurrency, formatDate } = useSalon();
  const branchId = useAppSelector((s) => s.dashboard.selectedBranchId) ?? undefined;
  const { data, isLoading } = useGetAppointmentsQuery({ branch_id: branchId, page: page + 1, page_size: 20, status: statusFilter || undefined });
  const [createAppt, { isLoading: creating }] = useCreateAppointmentMutation();
  const [cancelAppt] = useCancelAppointmentMutation();

  const { data: services } = useGetServicesQuery({});
  const { data: staffData } = useGetStaffQuery({ branch_id: branchId });
  const { data: customersData } = useGetCustomersQuery({ search, page_size: 10 });

  const validateBook = (f: typeof form, d: Dayjs | null, t: Dayjs | null) => ({
    customer_id: v.minSelect(f.customer_id, 'customer'),
    service_id: v.minSelect(f.service_id, 'service'),
    date: !d ? 'Date is required.' : '',
    time: !t ? 'Time is required.' : '',
  });

  const handleBookBlur = (field: string) => {
    setBookTouched((p) => ({ ...p, [field]: true }));
    setBookErrors(validateBook(form, dateValue, timeValue));
  };

  const handleBookClose = () => {
    setBookOpen(false);
    setForm({ customer_id: '', service_id: '', staff_id: '', notes: '' });
    setDateValue(null);
    setTimeValue(null);
    setBookErrors({ customer_id: '', service_id: '', date: '', time: '' });
    setBookTouched({});
    setBookSubmitError('');
  };

  const handleBook = async () => {
    setBookTouched({ customer_id: true, service_id: true, date: true, time: true });
    const errs = validateBook(form, dateValue, timeValue);
    setBookErrors(errs);
    if (!hasNoErrors(errs)) return;
    setBookSubmitError('');
    try {
      await createAppt({
        branch_id: branchId,
        customer_id: parseInt(form.customer_id),
        service_id: parseInt(form.service_id),
        staff_id: form.staff_id ? parseInt(form.staff_id) : undefined,
        appointment_date: dateValue!.format('YYYY-MM-DD'),
        start_time: timeValue!.format('HH:mm') + ':00',
        notes: form.notes,
        booking_source: 'Staff',
      }).unwrap();
      toast.success('Appointment booked successfully');
      handleBookClose();
    } catch (err: unknown) {
      const msg = (err as { data?: { detail?: string } })?.data?.detail ?? 'Failed to book appointment';
      setBookSubmitError(msg);
    }
  };

  const handleCancel = async (id: number) => {
    try {
      await cancelAppt({ id }).unwrap();
      toast.success('Appointment cancelled');
    } catch {
      toast.error('Failed to cancel appointment');
    }
  };

  const columns: GridColDef<Appointment>[] = [
    {
      field: 'customer_name',
      headerName: 'Customer',
      flex: 1.2,
      renderCell: (params) => (
        <Box>
          <Typography variant="body2" fontWeight={600}>{params.value || 'N/A'}</Typography>
          <Typography variant="caption" color="text.secondary">{params.row.customer_mobile}</Typography>
        </Box>
      ),
    },
    {
      field: 'service_name',
      headerName: 'Service',
      flex: 1.2,
      renderCell: (params) => (
        <Box>
          <Typography variant="body2">{params.value}</Typography>
          <Typography variant="caption" color="text.secondary">{params.row.service_duration}min</Typography>
        </Box>
      ),
    },
    { field: 'staff_name', headerName: 'Staff', flex: 0.9, valueFormatter: (v: string) => v || 'Any' },
    {
      field: 'appointment_date',
      headerName: 'Date & Time',
      flex: 1.1,
      renderCell: (params) => (
        <Box>
          <Typography variant="body2" fontWeight={500}>{formatDate(params.value)}</Typography>
          <Typography variant="caption" color="text.secondary">{params.row.start_time} – {params.row.end_time}</Typography>
        </Box>
      ),
    },
    {
      field: 'booking_source',
      headerName: 'Source',
      flex: 0.7,
      renderCell: (params) => <Chip label={params.value} size="small" variant="outlined" />,
    },
    {
      field: 'service_amount',
      headerName: 'Amount',
      flex: 0.8,
      type: 'number',
      align: 'right',
      headerAlign: 'right',
      renderCell: (params) => (
        <Typography variant="body2" fontWeight={600}>{formatCurrency(params.value || 0)}</Typography>
      ),
    },
    {
      field: 'status',
      headerName: 'Status',
      flex: 0.9,
      align: 'center',
      headerAlign: 'center',
      renderCell: (params) => (
        <Chip label={params.value} size="small" color={STATUS_COLORS[params.value as AppointmentStatus]} />
      ),
    },
    {
      field: '_actions',
      headerName: 'Actions',
      width: 90,
      sortable: false,
      align: 'center',
      headerAlign: 'center',
      renderCell: (params) => (
        <>
          {(params.row.status === 'Scheduled' || params.row.status === 'Confirmed') && (
            <Tooltip title="Cancel">
              <IconButton size="small" color="error" onClick={() => handleCancel(params.row.appointment_id)}>
                <Cancel fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </>
      ),
    },
  ];

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Appointments</Typography>
          <Typography variant="body2" color="text.secondary">{data?.total ?? 0} total</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="outlined" startIcon={<CalendarMonth />} href="/calendar">Calendar View</Button>
          <Button variant="contained" startIcon={<Add />} onClick={() => setBookOpen(true)}>Book Appointment</Button>
        </Box>
      </Box>

      <Card sx={{ mb: 2 }}>
        <Box sx={{ p: 2, display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
          <TextField
            placeholder="Search customer…"
            size="small"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{ minWidth: 250 }}
            InputProps={{ startAdornment: <InputAdornment position="start"><Search sx={{ fontSize: 18 }} /></InputAdornment> }}
          />
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>Status</InputLabel>
            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} label="Status">
              <MenuItem value="">All</MenuItem>
              {['Scheduled', 'Confirmed', 'CheckedIn', 'InService', 'Completed', 'Cancelled', 'NoShow'].map((s) => (
                <MenuItem key={s} value={s}>{s}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      </Card>

      <Card>
        <DataGrid
          rows={data?.items ?? []}
          columns={columns}
          getRowId={(row) => row.appointment_id}
          rowCount={data?.total ?? 0}
          loading={isLoading}
          paginationMode="server"
          paginationModel={{ page, pageSize: 20 }}
          onPaginationModelChange={(model) => setPage(model.page)}
          pageSizeOptions={[20]}
          autoHeight
          rowHeight={56}
          disableRowSelectionOnClick
          sx={{ border: 0, '& .MuiDataGrid-columnHeaders': { bgcolor: 'grey.50' } }}
        />
      </Card>

      {/* Book Appointment Dialog */}
      <Dialog open={bookOpen} onClose={handleBookClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle>Book Appointment</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          {bookSubmitError && <Alert severity="error" sx={{ mt: 1, mb: 1 }}>{bookSubmitError}</Alert>}
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12}>
              <FormControl fullWidth error={bookTouched.customer_id && !!bookErrors.customer_id}>
                <InputLabel>Customer *</InputLabel>
                <Select
                  value={form.customer_id}
                  onChange={(e) => {
                    const val = e.target.value as string;
                    const next = { ...form, customer_id: val };
                    setForm(next);
                    if (bookTouched.customer_id) setBookErrors(validateBook(next, dateValue, timeValue));
                  }}
                  onClose={() => handleBookBlur('customer_id')}
                  label="Customer *"
                >
                  {customersData?.items?.map((c) => (
                    <MenuItem key={c.customer_id} value={c.customer_id}>{c.full_name} · {c.mobile}</MenuItem>
                  ))}
                </Select>
                {bookTouched.customer_id && bookErrors.customer_id && <FormHelperText>{bookErrors.customer_id}</FormHelperText>}
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth error={bookTouched.service_id && !!bookErrors.service_id}>
                <InputLabel>Service *</InputLabel>
                <Select
                  value={form.service_id}
                  onChange={(e) => {
                    const val = e.target.value as string;
                    const next = { ...form, service_id: val };
                    setForm(next);
                    if (bookTouched.service_id) setBookErrors(validateBook(next, dateValue, timeValue));
                  }}
                  onClose={() => handleBookBlur('service_id')}
                  label="Service *"
                >
                  {services?.map((s) => (
                    <MenuItem key={s.service_id} value={s.service_id}>{s.service_name} — {formatCurrency(s.price)} ({s.duration}min)</MenuItem>
                  ))}
                </Select>
                {bookTouched.service_id && bookErrors.service_id && <FormHelperText>{bookErrors.service_id}</FormHelperText>}
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth size="small">
                <InputLabel>Staff (Optional)</InputLabel>
                <Select value={form.staff_id} onChange={(e) => setForm({ ...form, staff_id: e.target.value as string })} label="Staff (Optional)">
                  <MenuItem value="">Any Available</MenuItem>
                  {staffData?.items?.map((s) => (
                    <MenuItem key={s.staff_id} value={s.staff_id}>{s.full_name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <DatePicker
                label="Date *"
                value={dateValue}
                onChange={(val) => {
                  setDateValue(val);
                  if (bookTouched.date) setBookErrors(validateBook(form, val, timeValue));
                }}
                slotProps={{
                  textField: {
                    fullWidth: true,
                    size: 'small',
                    error: bookTouched.date && !!bookErrors.date,
                    helperText: bookTouched.date ? bookErrors.date : '',
                    onBlur: () => handleBookBlur('date'),
                  },
                }}
              />
            </Grid>
            <Grid item xs={6}>
              <TimePicker
                label="Time *"
                value={timeValue}
                onChange={(val) => {
                  setTimeValue(val);
                  if (bookTouched.time) setBookErrors(validateBook(form, dateValue, val));
                }}
                slotProps={{
                  textField: {
                    fullWidth: true,
                    size: 'small',
                    error: bookTouched.time && !!bookErrors.time,
                    helperText: bookTouched.time ? bookErrors.time : '',
                    onBlur: () => handleBookBlur('time'),
                  },
                }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField label="Notes" fullWidth multiline rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleBookClose}>Cancel</Button>
          <Button variant="contained" onClick={handleBook} disabled={creating}>
            {creating ? 'Booking…' : 'Book Appointment'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
