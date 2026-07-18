import { useState } from 'react';
import {
  Box, Typography, Button, Card, CardContent, Grid, Chip,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  FormControl, InputLabel, Select, MenuItem, CircularProgress,
  Table, TableHead, TableRow, TableCell, TableBody, TableContainer,
  Paper, Alert, Avatar,
} from '@mui/material';
import { Add, CheckCircle, Cancel, ArrowBack } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useGetStaffQuery } from '@/features/api/apiSlice';
import { useAppSelector } from '@/app/hooks';
import { useAppDispatch } from '@/app/hooks';
import toast from 'react-hot-toast';
import dayjs from 'dayjs';

const STATUS_OPTIONS = ['Present', 'Absent', 'Half Day', 'Late', 'On Leave'];
const STATUS_COLOR: Record<string, 'success' | 'error' | 'warning' | 'info' | 'default'> = {
  Present: 'success', Absent: 'error', 'Half Day': 'warning', Late: 'warning', 'On Leave': 'info',
};

interface AttendanceRecord {
  staff_id: number;
  staff_name: string;
  date: string;
  status: string;
  check_in?: string;
  check_out?: string;
  notes?: string;
}

function MarkDialog({ open, onClose, staffList }: {
  open: boolean; onClose: () => void; staffList: any[];
}) {
  const [form, setForm] = useState({
    staff_id: '',
    attendance_date: dayjs().format('YYYY-MM-DD'),
    status: 'Present',
    check_in_time: '',
    check_out_time: '',
    notes: '',
  });
  const [errors, setErrors] = useState({ staff_id: '', attendance_date: '' });
  const [saving, setSaving] = useState(false);

  const validate = () => {
    const e = { staff_id: '', attendance_date: '' };
    if (!form.staff_id) e.staff_id = 'Please select a staff member.';
    if (!form.attendance_date) e.attendance_date = 'Date is required.';
    setErrors(e);
    return !e.staff_id && !e.attendance_date;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/v1/staff/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('access_token')}` },
        body: JSON.stringify({
          staff_id: Number(form.staff_id),
          attendance_date: form.attendance_date,
          status: form.status,
          check_in_time: form.check_in_time || undefined,
          check_out_time: form.check_out_time || undefined,
          notes: form.notes || undefined,
        }),
      });
      if (!res.ok) throw await res.json();
      toast.success('Attendance marked');
      onClose();
    } catch (e: any) {
      toast.error(e?.detail ?? 'Failed to mark attendance');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle fontWeight={700}>Mark Attendance</DialogTitle>
      <DialogContent>
        <Grid container spacing={2} sx={{ mt: 0.5 }}>
          <Grid item xs={12}>
            <FormControl fullWidth error={!!errors.staff_id}>
              <InputLabel>Staff Member *</InputLabel>
              <Select value={form.staff_id} label="Staff Member *" onChange={(e) => setForm((p) => ({ ...p, staff_id: e.target.value as string }))}>
                {staffList.map((s) => (
                  <MenuItem key={s.staff_id} value={s.staff_id}>{s.full_name} — {s.job_title || 'Staff'}</MenuItem>
                ))}
              </Select>
              {errors.staff_id && <Typography variant="caption" color="error" sx={{ ml: 1.5, mt: 0.5 }}>{errors.staff_id}</Typography>}
            </FormControl>
          </Grid>
          <Grid item xs={6}>
            <TextField
              label="Date *" type="date" fullWidth value={form.attendance_date}
              onChange={(e) => setForm((p) => ({ ...p, attendance_date: e.target.value }))}
              error={!!errors.attendance_date} helperText={errors.attendance_date}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={6}>
            <FormControl fullWidth>
              <InputLabel>Status</InputLabel>
              <Select value={form.status} label="Status" onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}>
                {STATUS_OPTIONS.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={6}>
            <TextField label="Check-in Time" type="time" fullWidth value={form.check_in_time}
              onChange={(e) => setForm((p) => ({ ...p, check_in_time: e.target.value }))}
              InputLabelProps={{ shrink: true }} />
          </Grid>
          <Grid item xs={6}>
            <TextField label="Check-out Time" type="time" fullWidth value={form.check_out_time}
              onChange={(e) => setForm((p) => ({ ...p, check_out_time: e.target.value }))}
              InputLabelProps={{ shrink: true }} />
          </Grid>
          <Grid item xs={12}>
            <TextField label="Notes" fullWidth multiline rows={2} value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Mark Attendance'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default function StaffAttendancePage() {
  const navigate = useNavigate();
  const branchId = useAppSelector((s) => s.dashboard.selectedBranchId);
  const [markOpen, setMarkOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(dayjs().format('YYYY-MM-DD'));

  const { data: staffData, isLoading } = useGetStaffQuery({ branch_id: branchId ?? undefined, page_size: 100 });
  const staffList: any[] = (staffData as any)?.items ?? [];

  const today = dayjs().format('YYYY-MM-DD');
  const isToday = selectedDate === today;

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Button startIcon={<ArrowBack />} variant="outlined" size="small" onClick={() => navigate('/staff')}>
            Back
          </Button>
          <Box>
            <Typography variant="h5" fontWeight={700}>Staff Attendance</Typography>
            <Typography variant="body2" color="text.secondary">Track daily attendance for your team</Typography>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <TextField
            type="date" size="small" value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
            label="Date" sx={{ width: 160 }}
          />
          <Button variant="contained" startIcon={<Add />} onClick={() => setMarkOpen(true)}>
            Mark Attendance
          </Button>
        </Box>
      </Box>

      {/* Summary cards */}
      <Grid container spacing={2} mb={3}>
        {[
          { label: 'Total Staff', value: staffList.length, color: '#6C3FC5', bg: '#F5F0FF' },
          { label: 'Present Today', value: '-', color: '#22C55E', bg: '#F0FDF4' },
          { label: 'Absent Today', value: '-', color: '#EF4444', bg: '#FEF2F2' },
          { label: 'On Leave', value: '-', color: '#F97316', bg: '#FFF7ED' },
        ].map((s) => (
          <Grid item xs={6} sm={3} key={s.label}>
            <Card sx={{ bgcolor: s.bg, border: `1px solid ${s.color}20` }}>
              <CardContent sx={{ py: 2, px: 2.5, '&:last-child': { pb: 2 } }}>
                <Typography variant="h4" fontWeight={800} sx={{ color: s.color }}>{s.value}</Typography>
                <Typography variant="body2" fontWeight={600} sx={{ color: s.color }}>{s.label}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Alert severity="info" sx={{ mb: 3 }}>
        Showing attendance for <strong>{dayjs(selectedDate).format('dddd, MMMM D, YYYY')}</strong>
        {isToday && ' (Today)'}. Mark attendance using the button above.
      </Alert>

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
      ) : (
        <Paper>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: '#F8F7FF' }}>
                  <TableCell sx={{ fontWeight: 700 }}>Staff Member</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Role</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Check-in</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Check-out</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Notes</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {staffList.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                      No staff found for this branch
                    </TableCell>
                  </TableRow>
                ) : staffList.map((s) => (
                  <TableRow key={s.staff_id} hover>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Avatar sx={{ width: 32, height: 32, bgcolor: '#6C3FC5', fontSize: 12 }}>
                          {s.first_name?.[0]}{s.last_name?.[0]}
                        </Avatar>
                        <Typography variant="body2" fontWeight={600}>{s.full_name}</Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">{s.job_title || 'Staff'}</Typography>
                    </TableCell>
                    <TableCell>
                      <Chip label="Not Marked" size="small" variant="outlined" color="default" />
                    </TableCell>
                    <TableCell>—</TableCell>
                    <TableCell>—</TableCell>
                    <TableCell>—</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      <MarkDialog open={markOpen} onClose={() => setMarkOpen(false)} staffList={staffList} />
    </Box>
  );
}
