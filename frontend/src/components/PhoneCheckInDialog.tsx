import { useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Box, Typography,
  Button, IconButton, CircularProgress, Avatar, Chip, Divider,
  FormControl, InputLabel, Select, MenuItem, TextField, Alert,
} from '@mui/material';
import { Backspace, Close, HowToReg, Person, AccessTime, ContentCut } from '@mui/icons-material';
import toast from 'react-hot-toast';
import {
  useLazyLookupCheckInQuery, useCreateCheckInMutation, useCreateCustomerMutation, useGetServicesQuery,
} from '@/features/api/apiSlice';
import { useSalon } from '@/context/SalonContext';
import type { CheckInLookupAppointment } from '@/types';

type Phase = 'keypad' | 'loading' | 'appointments' | 'newCustomer' | 'service';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'back'];

function formatPhone(digits: string) {
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
}

export default function PhoneCheckInDialog({
  open, onClose, branchId, onCheckedIn,
}: {
  open: boolean;
  onClose: () => void;
  branchId: number | null;
  onCheckedIn: () => void;
}) {
  const { formatCurrency } = useSalon();
  const [phase, setPhase] = useState<Phase>('keypad');
  const [digits, setDigits] = useState('');
  const [customerId, setCustomerId] = useState<number | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [appointments, setAppointments] = useState<CheckInLookupAppointment[]>([]);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [serviceId, setServiceId] = useState<number | ''>('');
  const [addAnotherId, setAddAnotherId] = useState<number | ''>('');

  const [lookup] = useLazyLookupCheckInQuery();
  const [createCheckIn, { isLoading: checkingIn }] = useCreateCheckInMutation();
  const [createCustomer, { isLoading: creatingCustomer }] = useCreateCustomerMutation();
  const { data: services } = useGetServicesQuery({});

  const reset = () => {
    setPhase('keypad'); setDigits(''); setCustomerId(null); setCustomerName('');
    setAppointments([]); setFirstName(''); setLastName(''); setServiceId(''); setAddAnotherId('');
  };

  const handleClose = () => { reset(); onClose(); };

  const handleKey = (key: string) => {
    if (key === 'back') { setDigits((d) => d.slice(0, -1)); return; }
    if (key === 'clear') { setDigits(''); return; }
    setDigits((d) => (d.length < 10 ? d + key : d));
  };

  const handleLookup = async () => {
    if (!branchId || digits.length < 7) return;
    setPhase('loading');
    try {
      const result = await lookup({ phone: digits, branch_id: branchId }).unwrap();
      if (result.customer) {
        setCustomerId(result.customer.customer_id);
        setCustomerName(result.customer.full_name);
        if (result.appointments.length > 0) {
          setAppointments(result.appointments);
          setPhase('appointments');
        } else {
          setPhase('service');
        }
      } else {
        setPhase('newCustomer');
      }
    } catch {
      toast.error('Lookup failed');
      setPhase('keypad');
    }
  };

  const handleCreateCustomer = async () => {
    if (!firstName.trim() || !lastName.trim()) return;
    try {
      const customer = await createCustomer({
        first_name: firstName.trim(), last_name: lastName.trim(), mobile: digits,
      }).unwrap();
      setCustomerId(customer.customer_id);
      setCustomerName(customer.full_name);
      setPhase('service');
    } catch (e: any) {
      toast.error(e?.data?.detail ?? 'Could not create customer');
    }
  };

  const handleCheckInAppointment = async (appt: CheckInLookupAppointment) => {
    if (!branchId || !customerId) return;
    try {
      await createCheckIn({
        branch_id: branchId, customer_id: customerId,
        service_id: appt.service_id, staff_id: appt.staff_id ?? undefined,
        appointment_id: appt.appointment_id,
      }).unwrap();
      if (addAnotherId) {
        await createCheckIn({ branch_id: branchId, customer_id: customerId, service_id: addAnotherId as number }).unwrap();
      }
      toast.success(`${customerName} checked in`);
      onCheckedIn();
      handleClose();
    } catch (e: any) {
      toast.error(e?.data?.detail ?? 'Check-in failed');
    }
  };

  const handleWalkInCheckIn = async () => {
    if (!branchId || !customerId || !serviceId) return;
    try {
      await createCheckIn({ branch_id: branchId, customer_id: customerId, service_id: serviceId as number }).unwrap();
      toast.success(`${customerName} added to queue`);
      onCheckedIn();
      handleClose();
    } catch (e: any) {
      toast.error(e?.data?.detail ?? 'Check-in failed');
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography fontWeight={800} fontSize={16}>Check In</Typography>
        <IconButton size="small" onClick={handleClose}><Close fontSize="small" /></IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 1 }}>
        {/* ── Keypad ── */}
        {(phase === 'keypad' || phase === 'loading') && (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <Typography variant="h4" fontWeight={800} sx={{ letterSpacing: 1, minHeight: 48, color: digits ? 'text.primary' : 'text.disabled' }}>
              {digits ? formatPhone(digits) : 'Enter phone'}
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1.5, width: '100%' }}>
              {KEYS.map((k) => (
                <Button
                  key={k}
                  variant="outlined"
                  disabled={phase === 'loading'}
                  onClick={() => handleKey(k)}
                  sx={{
                    height: 64, fontSize: 22, fontWeight: 700, borderRadius: 2.5,
                    borderColor: '#E5E7EB', color: k === 'clear' ? '#EF4444' : '#1F2937',
                  }}
                >
                  {k === 'back' ? <Backspace /> : k === 'clear' ? 'C' : k}
                </Button>
              ))}
            </Box>
            <Button
              fullWidth variant="contained" size="large"
              disabled={digits.length < 7 || phase === 'loading'}
              onClick={handleLookup}
              startIcon={phase === 'loading' ? <CircularProgress size={16} color="inherit" /> : <HowToReg />}
              sx={{ borderRadius: 2.5, py: 1.5, fontWeight: 800, bgcolor: '#6C3FC5', '&:hover': { bgcolor: '#5a33a8' } }}
            >
              {phase === 'loading' ? 'Looking up…' : 'Look Up'}
            </Button>
          </Box>
        )}

        {/* ── Matched appointment(s) ── */}
        {phase === 'appointments' && (
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
              <Avatar sx={{ bgcolor: '#6C3FC5' }}>{customerName[0]}</Avatar>
              <Box>
                <Typography fontWeight={700}>{customerName}</Typography>
                <Typography fontSize={12} color="text.secondary">{formatPhone(digits)}</Typography>
              </Box>
              <Chip label="Has appointment today" size="small" color="success" sx={{ ml: 'auto' }} />
            </Box>
            {appointments.map((a) => (
              <Box key={a.appointment_id} sx={{ p: 1.75, mb: 1.25, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  <ContentCut sx={{ fontSize: 16, color: 'text.secondary' }} />
                  <Typography fontWeight={700} fontSize={14}>{a.service_name}</Typography>
                  <Typography fontSize={13} fontWeight={700} sx={{ ml: 'auto' }}>{formatCurrency(a.service_price)}</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.25, color: 'text.secondary' }}>
                  {a.start_time && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
                      <AccessTime sx={{ fontSize: 13 }} /><Typography fontSize={12}>{a.start_time}</Typography>
                    </Box>
                  )}
                  {a.staff_name && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
                      <Person sx={{ fontSize: 13 }} /><Typography fontSize={12}>{a.staff_name}</Typography>
                    </Box>
                  )}
                </Box>
                <FormControl fullWidth size="small" sx={{ mb: 1.25 }}>
                  <InputLabel>+ Add another service (optional)</InputLabel>
                  <Select
                    value={addAnotherId}
                    label="+ Add another service (optional)"
                    onChange={(e) => setAddAnotherId(e.target.value as number)}
                  >
                    <MenuItem value="">None</MenuItem>
                    {services?.filter((s: any) => s.service_id !== a.service_id).map((s: any) => (
                      <MenuItem key={s.service_id} value={s.service_id}>
                        {s.service_name} — {formatCurrency(s.price)}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <Button
                  fullWidth variant="contained"
                  disabled={checkingIn}
                  onClick={() => handleCheckInAppointment(a)}
                  sx={{ borderRadius: 2, fontWeight: 700, bgcolor: '#6C3FC5', '&:hover': { bgcolor: '#5a33a8' } }}
                >
                  {checkingIn ? <CircularProgress size={16} color="inherit" /> : 'Check In'}
                </Button>
              </Box>
            ))}
            <Button fullWidth size="small" onClick={() => setPhase('service')} sx={{ textTransform: 'none', color: 'text.secondary' }}>
              Not here for this — check in for a different service
            </Button>
          </Box>
        )}

        {/* ── New customer (no match found) ── */}
        {phase === 'newCustomer' && (
          <Box>
            <Alert severity="info" sx={{ mb: 2 }}>No customer found for {formatPhone(digits)} — add them as new.</Alert>
            <TextField label="First Name" fullWidth size="small" value={firstName}
              onChange={(e) => setFirstName(e.target.value)} sx={{ mb: 1.5 }} autoFocus />
            <TextField label="Last Name" fullWidth size="small" value={lastName}
              onChange={(e) => setLastName(e.target.value)} sx={{ mb: 1.5 }} />
            <TextField label="Mobile" fullWidth size="small" value={formatPhone(digits)} disabled sx={{ mb: 2 }} />
            <Button
              fullWidth variant="contained"
              disabled={!firstName.trim() || !lastName.trim() || creatingCustomer}
              onClick={handleCreateCustomer}
              sx={{ borderRadius: 2, fontWeight: 700, bgcolor: '#6C3FC5', '&:hover': { bgcolor: '#5a33a8' } }}
            >
              {creatingCustomer ? <CircularProgress size={16} color="inherit" /> : 'Create & Continue'}
            </Button>
          </Box>
        )}

        {/* ── Walk-in service selection (existing customer, no appointment) ── */}
        {phase === 'service' && (
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
              <Avatar sx={{ bgcolor: '#6C3FC5' }}>{customerName[0]}</Avatar>
              <Box>
                <Typography fontWeight={700}>{customerName}</Typography>
                <Typography fontSize={12} color="text.secondary">{formatPhone(digits)} · Walk-in</Typography>
              </Box>
            </Box>
            <Divider sx={{ mb: 2 }} />
            <FormControl fullWidth size="small" sx={{ mb: 2 }}>
              <InputLabel>Select Service *</InputLabel>
              <Select value={serviceId} label="Select Service *" onChange={(e) => setServiceId(e.target.value as number)}>
                {services?.map((s: any) => (
                  <MenuItem key={s.service_id} value={s.service_id}>
                    {s.service_name} — {formatCurrency(s.price)} ({s.duration}min)
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Button
              fullWidth variant="contained"
              disabled={!serviceId || checkingIn}
              onClick={handleWalkInCheckIn}
              sx={{ borderRadius: 2, fontWeight: 700, bgcolor: '#6C3FC5', '&:hover': { bgcolor: '#5a33a8' } }}
            >
              {checkingIn ? <CircularProgress size={16} color="inherit" /> : 'Add to Queue'}
            </Button>
          </Box>
        )}
      </DialogContent>

      {phase !== 'keypad' && phase !== 'loading' && (
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={reset} sx={{ textTransform: 'none' }}>Start Over</Button>
        </DialogActions>
      )}
    </Dialog>
  );
}
