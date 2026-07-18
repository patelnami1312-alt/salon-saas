import { useState, useEffect, useMemo } from 'react';
import {
  Box, Typography, Paper, Grid, Card, CardActionArea, Button,
  TextField, CircularProgress, Alert, Chip, Avatar, Divider,
  Container, Select, MenuItem, FormControl,
  IconButton, Stepper, Step, StepLabel, StepConnector,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import {
  ContentCut, Person, CalendarMonth, CheckCircle, AccessTime,
  ArrowBack, ArrowForward, Star, Spa, Face, LocalFlorist,
  FitnessCenter, Brush, ChevronLeft, ChevronRight, Home,
  Phone, LocationOn, CheckCircleOutline,
} from '@mui/icons-material';
import {
  useGetPublicSalonInfoQuery, useGetPublicServicesQuery, useGetPublicStaffQuery,
  useGetPublicSlotsQuery, useCreatePublicBookingMutation,
} from '@/features/api/apiSlice';
import type { PublicService } from '@/types';

const SALON_ID = 1;
const STEPS = ['Service', 'Date & Time', 'Your Details', 'Confirmed'];

const CATEGORY_COLORS: Record<string, string> = {
  'Hair Services': '#6C3FC5',
  'Skin & Facial': '#E91E8C',
  'Nail Care': '#FF6B35',
  'Body Treatments': '#00BCD4',
  'Waxing': '#FF9800',
  'Massage': '#4CAF50',
  'Spa & Massage': '#4CAF50',
  'Makeup': '#9C27B0',
};
const catColor = (cat: string) => CATEGORY_COLORS[cat] ?? '#6C3FC5';
const catIcon = (cat: string): React.ReactElement => {
  const map: Record<string, React.ReactElement> = {
    'Hair Services': <ContentCut />, 'Skin & Facial': <Face />, 'Nail Care': <Brush />,
    'Body Treatments': <Spa />, 'Waxing': <LocalFlorist />, 'Massage': <FitnessCenter />,
    'Spa & Massage': <FitnessCenter />, 'Makeup': <Star />,
  };
  return map[cat] ?? <Spa />;
};

const PurpleConnector = styled(StepConnector)(() => ({
  '& .MuiStepConnector-line': { borderColor: '#E8E0F5', borderTopWidth: 2 },
  '&.Mui-active .MuiStepConnector-line': { borderColor: '#6C3FC5' },
  '&.Mui-completed .MuiStepConnector-line': { borderColor: '#6C3FC5' },
}));

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAYS = ['Su','Mo','Tu','We','Th','Fr','Sa'];

function MiniCalendar({ value, onChange, minDate }: { value: string; onChange: (d: string) => void; minDate: string }) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells = Array.from({ length: firstDay + daysInMonth }, (_, i) => i < firstDay ? null : i - firstDay + 1);
  const isoOf = (d: number) => `${viewYear}-${String(viewMonth + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
  const prevMonth = () => { if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y-1); } else setViewMonth(m => m-1); };
  const nextMonth = () => { if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y+1); } else setViewMonth(m => m+1); };

  return (
    <Paper variant="outlined" sx={{ p: 2, borderRadius: 3, userSelect: 'none' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
        <IconButton size="small" onClick={prevMonth}><ChevronLeft /></IconButton>
        <Typography fontWeight={700} fontSize={15}>{MONTHS[viewMonth]} {viewYear}</Typography>
        <IconButton size="small" onClick={nextMonth}><ChevronRight /></IconButton>
      </Box>
      <Grid container columns={7} sx={{ mb: 0.5 }}>
        {DAYS.map(d => <Grid item xs={1} key={d} sx={{ textAlign: 'center' }}><Typography variant="caption" color="text.secondary" fontWeight={600}>{d}</Typography></Grid>)}
      </Grid>
      <Grid container columns={7}>
        {cells.map((d, i) => {
          if (!d) return <Grid item xs={1} key={`e${i}`} />;
          const iso = isoOf(d);
          const isSelected = value === iso;
          const isPast = iso < minDate;
          return (
            <Grid item xs={1} key={iso} sx={{ textAlign: 'center', py: 0.3 }}>
              <Box onClick={() => !isPast && onChange(iso)} sx={{
                width: 34, height: 34, borderRadius: '50%', mx: 'auto',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: isPast ? 'default' : 'pointer',
                bgcolor: isSelected ? '#6C3FC5' : 'transparent',
                color: isSelected ? '#fff' : isPast ? '#ccc' : 'text.primary',
                fontWeight: isSelected ? 700 : 400, fontSize: 13,
                '&:hover': !isPast && !isSelected ? { bgcolor: '#F3EDFF' } : {},
                transition: 'all 0.15s',
              }}>{d}</Box>
            </Grid>
          );
        })}
      </Grid>
    </Paper>
  );
}

function groupSlots(slots: string[]) {
  const morning: string[] = [], afternoon: string[] = [], evening: string[] = [];
  for (const s of slots) {
    const h = parseInt(s.split(':')[0], 10);
    if (h < 12) morning.push(s);
    else if (h < 17) afternoon.push(s);
    else evening.push(s);
  }
  return [
    { label: 'Morning', slots: morning, icon: '🌅' },
    { label: 'Afternoon', slots: afternoon, icon: '☀️' },
    { label: 'Evening', slots: evening, icon: '🌙' },
  ].filter(g => g.slots.length > 0);
}

function SummaryCard({ service, staffName, date, time }: { service: PublicService | null; staffName: string; date: string; time: string }) {
  if (!service) return null;
  const fmtDate = date ? new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : null;
  return (
    <Paper sx={{ p: 2.5, borderRadius: 3, bgcolor: '#F8F5FF', border: '1.5px solid #E0D0FA', mb: 2 }}>
      <Typography variant="subtitle2" fontWeight={800} color="primary" mb={1.5} sx={{ letterSpacing: 0.5, textTransform: 'uppercase', fontSize: 11 }}>Your Booking</Typography>
      {[
        { label: 'Service', value: service.service_name, sub: `${service.duration_minutes} min · $${service.price}` },
        { label: 'Stylist', value: staffName, sub: '' },
        ...(date ? [{ label: 'Date', value: fmtDate!, sub: '' }] : []),
        ...(time ? [{ label: 'Time', value: time, sub: '' }] : []),
      ].map((r, i) => (
        <Box key={i} mb={1}>
          <Typography variant="caption" color="text.secondary" fontWeight={600}>{r.label}</Typography>
          <Typography variant="body2" fontWeight={700}>{r.value}</Typography>
          {r.sub && <Typography variant="caption" color="text.secondary">{r.sub}</Typography>}
        </Box>
      ))}
      <Divider sx={{ my: 1.5 }} />
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="body2" fontWeight={700}>Total</Typography>
        <Typography variant="h6" fontWeight={900} color="primary">${service.price}</Typography>
      </Box>
    </Paper>
  );
}

export default function BookingPortalPage() {
  const [step, setStep] = useState(0);
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [selectedService, setSelectedService] = useState<PublicService | null>(null);
  const [selectedStaffId, setSelectedStaffId] = useState<number | ''>('');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [selectedBranch, setSelectedBranch] = useState<number | null>(null);
  const [form, setForm] = useState({ first_name: '', last_name: '', mobile: '', email: '', notes: '' });
  const [confirmation, setConfirmation] = useState<any>(null);
  const [bookingError, setBookingError] = useState('');

  const { data: salonInfo } = useGetPublicSalonInfoQuery(SALON_ID);
  const { data: services = [], isLoading: servicesLoading } = useGetPublicServicesQuery({ salon_id: SALON_ID });
  const { data: staff = [] } = useGetPublicStaffQuery(
    { salon_id: SALON_ID, service_id: selectedService?.service_id, branch_id: selectedBranch ?? undefined },
    { skip: !selectedService }
  );
  const { data: slotsData, isFetching: slotsLoading } = useGetPublicSlotsQuery(
    { salon_id: SALON_ID, branch_id: selectedBranch ?? 0, service_id: selectedService?.service_id ?? 0, booking_date: selectedDate, staff_id: selectedStaffId !== '' ? selectedStaffId : undefined },
    { skip: !selectedDate || !selectedService || !selectedBranch }
  );
  const [createBooking, { isLoading: booking }] = useCreatePublicBookingMutation();

  useEffect(() => { if (salonInfo?.branches?.[0]) setSelectedBranch(salonInfo.branches[0].branch_id); }, [salonInfo]);

  const categories = useMemo(() => [...new Set(services.map(s => s.category_name))], [services]);
  const displayCat = activeCat ?? categories[0] ?? null;
  const filteredServices = displayCat ? services.filter(s => s.category_name === displayCat) : services;

  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = tomorrow.toISOString().split('T')[0];

  const selectedStaff = staff.find(s => s.staff_id === selectedStaffId);
  const staffName = selectedStaffId !== '' && selectedStaff ? selectedStaff.name : 'Any Available';
  const slots = slotsData?.slots ?? [];
  const slotGroups = groupSlots(slots);

  const handleBook = async () => {
    if (!selectedService || !selectedBranch || !selectedDate || !selectedTime) return;
    setBookingError('');
    try {
      const res = await createBooking({
        salon_id: SALON_ID, branch_id: selectedBranch,
        service_id: selectedService.service_id,
        staff_id: selectedStaffId !== '' ? selectedStaffId : undefined,
        booking_date: selectedDate, start_time: selectedTime, ...form,
      }).unwrap();
      setConfirmation(res);
      setStep(3);
    } catch (err: any) {
      setBookingError(err?.data?.detail ?? 'Booking failed. Please try again.');
    }
  };

  const salonName = salonInfo?.salon_name ?? 'Luxe Beauty Lounge';
  const branch = salonInfo?.branches?.find(b => b.branch_id === selectedBranch);

  const Header = (
    <Box sx={{ position: 'sticky', top: 0, zIndex: 100, bgcolor: '#1A0533', px: { xs: 2, md: 4 }, py: 1.5, display: 'flex', alignItems: 'center', gap: 2 }}>
      <Button component="a" href="/" startIcon={<Home sx={{ fontSize: 16 }} />}
        sx={{ color: 'rgba(255,255,255,0.75)', fontSize: 13, fontWeight: 600, textTransform: 'none', borderRadius: 2, px: 1.5, flexShrink: 0, '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,0.08)' } }}>
        Home
      </Button>
      <Divider orientation="vertical" flexItem sx={{ borderColor: 'rgba(255,255,255,0.15)' }} />
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: 1 }}>
        <Box sx={{ width: 36, height: 36, borderRadius: 2, bgcolor: '#6C3FC5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <ContentCut sx={{ color: '#fff', fontSize: 18 }} />
        </Box>
        <Box>
          <Typography variant="subtitle1" sx={{ color: '#fff', fontWeight: 800, lineHeight: 1.1 }}>{salonName}</Typography>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>Online Booking</Typography>
        </Box>
      </Box>
      {branch && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <LocationOn sx={{ color: '#A776F3', fontSize: 16 }} />
          <Typography sx={{ color: 'rgba(255,255,255,0.75)', fontSize: 13 }}>{branch.branch_name}</Typography>
        </Box>
      )}
      <Button component="a" href="/portal" variant="outlined" size="small"
        sx={{ color: 'rgba(255,255,255,0.8)', borderColor: 'rgba(255,255,255,0.25)', fontSize: 12, textTransform: 'none', borderRadius: 2, flexShrink: 0, '&:hover': { borderColor: '#fff', color: '#fff' } }}>
        My Account
      </Button>
    </Box>
  );

  const StepBar = (
    <Box sx={{ bgcolor: '#fff', borderBottom: '1px solid #F0EAF8', px: { xs: 2, md: 6 }, py: 1.5 }}>
      <Stepper activeStep={step} connector={<PurpleConnector />} sx={{ maxWidth: 500, mx: 'auto' }}>
        {STEPS.map((label, i) => (
          <Step key={label} completed={i < step}>
            <StepLabel StepIconProps={{ sx: { '&.Mui-active': { color: '#6C3FC5' }, '&.Mui-completed': { color: '#6C3FC5' } } }}>
              <Typography variant="caption" fontWeight={i === step ? 700 : 400} color={i <= step ? '#6C3FC5' : 'text.disabled'}>{label}</Typography>
            </StepLabel>
          </Step>
        ))}
      </Stepper>
    </Box>
  );

  // ── CONFIRMATION ──────────────────────────────────────────────
  if (step === 3 && confirmation) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: '#F8F5FF' }}>
        {Header}
        <Container maxWidth="sm" sx={{ py: { xs: 4, md: 8 }, textAlign: 'center' }}>
          <Box sx={{ width: 80, height: 80, bgcolor: '#E8F5E9', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 3 }}>
            <CheckCircle sx={{ fontSize: 48, color: '#4CAF50' }} />
          </Box>
          <Typography variant="h4" fontWeight={900} mb={1}>You're booked!</Typography>
          <Typography color="text.secondary" mb={4}>See you soon! We'll send a reminder before your appointment.</Typography>

          <Paper sx={{ p: 3, borderRadius: 3, mb: 3, border: '1.5px solid #E0D0FA', textAlign: 'left' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="caption" color="text.secondary">Booking Reference</Typography>
              <Typography fontWeight={800} color="primary">{confirmation.confirmation_number}</Typography>
            </Box>
            <Divider sx={{ mb: 2 }} />
            {[
              { label: 'Service', value: confirmation.service_name },
              { label: 'Date', value: new Date(confirmation.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) },
              { label: 'Time', value: confirmation.time },
              { label: 'Duration', value: `${confirmation.duration_minutes} min` },
            ].map(r => (
              <Box key={r.label} sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="body2" color="text.secondary">{r.label}</Typography>
                <Typography variant="body2" fontWeight={600}>{r.value}</Typography>
              </Box>
            ))}
          </Paper>

          {/* Track booking nudge */}
          <Paper sx={{ p: 2.5, borderRadius: 3, mb: 3, bgcolor: '#F3EDFF', border: '1.5px solid #D4C0F5', textAlign: 'left' }}>
            <Typography fontWeight={700} mb={0.5}>View & track this booking</Typography>
            <Typography variant="body2" color="text.secondary" mb={1.5}>
              Enter your phone number in My Account to see all your appointments and loyalty points — no password needed.
            </Typography>
            <Button variant="contained" size="small"
              component="a" href={`/portal?mobile=${encodeURIComponent(form.mobile)}`}
              sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700 }}>
              View My Bookings →
            </Button>
          </Paper>

          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
            <Button variant="outlined" size="large" sx={{ borderRadius: 3, px: 4 }}
              onClick={() => { setStep(0); setSelectedService(null); setSelectedStaffId(''); setSelectedDate(''); setSelectedTime(''); setConfirmation(null); setForm({ first_name: '', last_name: '', mobile: '', email: '', notes: '' }); }}>
              Book Another
            </Button>
            <Button variant="contained" size="large" component="a" href="/" sx={{ borderRadius: 3, px: 4 }}>Back to Home</Button>
          </Box>
        </Container>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#F8F5FF' }}>
      {Header}
      {StepBar}
      <Container maxWidth="lg" sx={{ py: { xs: 2, md: 4 } }}>
        <Grid container spacing={3}>

          {/* LEFT: Content */}
          <Grid item xs={12} md={8}>

            {/* ── STEP 0: Service ── */}
            {step === 0 && (
              <Box>
                <Typography variant="h5" fontWeight={800} mb={0.5}>Choose a Service</Typography>
                <Typography color="text.secondary" variant="body2" mb={3}>What would you like today?</Typography>

                {!servicesLoading && categories.length > 1 && (
                  <Box sx={{ display: 'flex', gap: 1, mb: 3, flexWrap: 'wrap' }}>
                    {categories.map(cat => (
                      <Chip key={cat} label={cat}
                        icon={<Box sx={{ '& svg': { fontSize: '15px !important', color: displayCat === cat ? '#fff' : catColor(cat) } }}>{catIcon(cat)}</Box>}
                        onClick={() => setActiveCat(cat)}
                        sx={{
                          fontWeight: 700, px: 1, borderRadius: 3,
                          bgcolor: displayCat === cat ? catColor(cat) : `${catColor(cat)}15`,
                          color: displayCat === cat ? '#fff' : catColor(cat),
                          border: `1.5px solid ${catColor(cat)}30`,
                          cursor: 'pointer',
                          '&:hover': { bgcolor: displayCat === cat ? catColor(cat) : `${catColor(cat)}25` },
                        }}
                      />
                    ))}
                  </Box>
                )}

                {servicesLoading ? (
                  <Box sx={{ py: 6, textAlign: 'center' }}><CircularProgress color="primary" /></Box>
                ) : (
                  <Grid container spacing={2}>
                    {filteredServices.map(svc => {
                      const sel = selectedService?.service_id === svc.service_id;
                      const color = catColor(svc.category_name);
                      return (
                        <Grid item xs={12} sm={6} key={svc.service_id}>
                          <Card sx={{
                            border: `2px solid ${sel ? color : 'transparent'}`, borderRadius: 3,
                            boxShadow: sel ? `0 0 0 4px ${color}18` : '0 1px 4px rgba(0,0,0,0.06)',
                            transition: 'all 0.18s', bgcolor: sel ? `${color}07` : '#fff',
                            '&:hover': { borderColor: color, boxShadow: `0 4px 16px ${color}20` },
                          }}>
                            <CardActionArea onClick={() => { setSelectedService(svc); setActiveCat(svc.category_name); }} sx={{ p: 2 }}>
                              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                                <Box sx={{ width: 44, height: 44, borderRadius: 2.5, bgcolor: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, '& svg': { color, fontSize: 22 } }}>
                                  {catIcon(svc.category_name)}
                                </Box>
                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <Typography fontWeight={700} fontSize={14} noWrap sx={{ maxWidth: '70%' }}>{svc.service_name}</Typography>
                                    <Typography fontWeight={900} fontSize={16} sx={{ color, flexShrink: 0, ml: 1 }}>${svc.price}</Typography>
                                  </Box>
                                  <Box sx={{ display: 'flex', gap: 1, mt: 0.75, alignItems: 'center' }}>
                                    <AccessTime sx={{ fontSize: 13, color: 'text.secondary' }} />
                                    <Typography variant="caption" color="text.secondary">{svc.duration_minutes} min</Typography>
                                  </Box>
                                  {svc.description && (
                                    <Typography variant="caption" color="text.secondary" display="block" mt={0.5}
                                      sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      {svc.description}
                                    </Typography>
                                  )}
                                </Box>
                                {sel && <CheckCircleOutline sx={{ color, fontSize: 22, flexShrink: 0 }} />}
                              </Box>
                            </CardActionArea>
                          </Card>
                        </Grid>
                      );
                    })}
                  </Grid>
                )}

                <Box sx={{ mt: 3 }}>
                  <Button variant="contained" fullWidth size="large" endIcon={<ArrowForward />}
                    disabled={!selectedService} onClick={() => setStep(1)}
                    sx={{ borderRadius: 3, py: 1.5, fontWeight: 700, fontSize: 16 }}>
                    {selectedService ? `Continue — ${selectedService.service_name}` : 'Select a Service to Continue'}
                  </Button>
                </Box>
              </Box>
            )}

            {/* ── STEP 1: Date & Time ── */}
            {step === 1 && (
              <Box>
                <Typography variant="h5" fontWeight={800} mb={0.5}>Pick a Date & Time</Typography>
                <Typography color="text.secondary" variant="body2" mb={3}>Choose when you'd like to come in</Typography>

                {/* Inline optional stylist */}
                <Paper variant="outlined" sx={{ p: 2, borderRadius: 3, mb: 3, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
                    <Person sx={{ color: '#6C3FC5', fontSize: 20 }} />
                    <Box>
                      <Typography variant="body2" fontWeight={700}>Preferred Stylist</Typography>
                      <Typography variant="caption" color="text.secondary">Optional</Typography>
                    </Box>
                  </Box>
                  <FormControl size="small" sx={{ minWidth: 200 }}>
                    <Select value={selectedStaffId} onChange={e => { setSelectedStaffId(e.target.value as number | ''); setSelectedTime(''); }}
                      displayEmpty sx={{ borderRadius: 2 }}>
                      <MenuItem value=""><em>Any Available Stylist</em></MenuItem>
                      {staff.map(s => (
                        <MenuItem key={s.staff_id} value={s.staff_id}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Avatar sx={{ width: 24, height: 24, fontSize: 12, bgcolor: '#6C3FC5' }}>{s.name.charAt(0)}</Avatar>
                            <Box>
                              <Typography variant="body2" fontWeight={600}>{s.name}</Typography>
                              {s.job_title && <Typography variant="caption" color="text.secondary" display="block">{s.job_title}</Typography>}
                            </Box>
                          </Box>
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Paper>

                <Grid container spacing={3}>
                  <Grid item xs={12} sm={6}>
                    <MiniCalendar value={selectedDate} onChange={d => { setSelectedDate(d); setSelectedTime(''); }} minDate={minDate} />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    {!selectedDate ? (
                      <Paper variant="outlined" sx={{ p: 4, borderRadius: 3, textAlign: 'center', minHeight: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 1 }}>
                        <CalendarMonth sx={{ fontSize: 40, color: '#D0C0F0' }} />
                        <Typography color="text.disabled" variant="body2">Select a date to see available times</Typography>
                      </Paper>
                    ) : slotsLoading ? (
                      <Paper variant="outlined" sx={{ p: 4, borderRadius: 3, textAlign: 'center', minHeight: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 1 }}>
                        <CircularProgress color="primary" size={28} />
                        <Typography variant="body2" color="text.secondary">Loading times…</Typography>
                      </Paper>
                    ) : slots.length === 0 ? (
                      <Alert severity="warning" sx={{ borderRadius: 2 }}>No availability on this date — try another day.</Alert>
                    ) : (
                      <Box>
                        <Typography variant="subtitle2" fontWeight={700} mb={1.5} color="text.secondary">
                          {new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                        </Typography>
                        {slotGroups.map(group => (
                          <Box key={group.label} mb={2}>
                            <Typography variant="caption" fontWeight={700} color="text.secondary"
                              sx={{ display: 'block', mb: 0.75, textTransform: 'uppercase', letterSpacing: 0.5, fontSize: 10 }}>
                              {group.icon} {group.label}
                            </Typography>
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                              {group.slots.map(slot => (
                                <Button key={slot} size="small"
                                  variant={selectedTime === slot ? 'contained' : 'outlined'}
                                  onClick={() => setSelectedTime(slot)}
                                  sx={{
                                    borderRadius: 2, fontWeight: 600, fontSize: 12, minWidth: 62,
                                    ...(selectedTime !== slot ? { borderColor: '#E0D0FA', color: 'text.primary' } : {}),
                                  }}>
                                  {slot}
                                </Button>
                              ))}
                            </Box>
                          </Box>
                        ))}
                      </Box>
                    )}
                  </Grid>
                </Grid>

                <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
                  <Button variant="outlined" startIcon={<ArrowBack />} onClick={() => setStep(0)} sx={{ borderRadius: 3, px: 3 }}>Back</Button>
                  <Button variant="contained" fullWidth size="large" endIcon={<ArrowForward />}
                    disabled={!selectedDate || !selectedTime} onClick={() => setStep(2)}
                    sx={{ borderRadius: 3, fontWeight: 700 }}>
                    Continue
                  </Button>
                </Box>
              </Box>
            )}

            {/* ── STEP 2: Your Details ── */}
            {step === 2 && (
              <Box>
                <Typography variant="h5" fontWeight={800} mb={0.5}>Your Details</Typography>
                <Typography color="text.secondary" variant="body2" mb={3}>Almost done — just a couple of details to confirm your booking</Typography>

                {bookingError && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{bookingError}</Alert>}

                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <TextField label="First Name *" fullWidth value={form.first_name}
                      onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))}
                      sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }} />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField label="Last Name *" fullWidth value={form.last_name}
                      onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))}
                      sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }} />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField label="Mobile Number *" fullWidth value={form.mobile}
                      onChange={e => setForm(f => ({ ...f, mobile: e.target.value }))}
                      placeholder="+1 (555) 000-0000"
                      InputProps={{ startAdornment: <Phone sx={{ color: 'text.secondary', fontSize: 18, mr: 1 }} /> }}
                      sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }} />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField label="Email (optional)" fullWidth value={form.email}
                      onChange={e => setForm(f => ({ ...f, email: e.target.value }))} type="email"
                      sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }} />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField label="Special Requests (optional)" fullWidth multiline rows={2}
                      value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                      placeholder="Allergies, preferences, or anything we should know…"
                      sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }} />
                  </Grid>
                </Grid>

                <Paper sx={{ p: 2, mt: 2, borderRadius: 2, bgcolor: '#F0FFF4', border: '1px solid #C8F0D4' }}>
                  <Typography variant="caption" color="success.dark">
                    ✓ No deposit required · Free cancellation up to 24 hours before your appointment
                  </Typography>
                </Paper>

                <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
                  <Button variant="outlined" startIcon={<ArrowBack />} onClick={() => setStep(1)} sx={{ borderRadius: 3, px: 3 }}>Back</Button>
                  <Button variant="contained" fullWidth size="large"
                    disabled={booking || !form.first_name || !form.last_name || !form.mobile}
                    onClick={handleBook}
                    sx={{ borderRadius: 3, py: 1.5, fontWeight: 700, fontSize: 16 }}>
                    {booking ? <CircularProgress size={22} sx={{ color: 'white' }} /> : 'Confirm Booking →'}
                  </Button>
                </Box>
              </Box>
            )}
          </Grid>

          {/* RIGHT: Summary sidebar */}
          <Grid item xs={12} md={4}>
            <Box sx={{ position: 'sticky', top: 80 }}>
              <SummaryCard service={selectedService} staffName={staffName} date={selectedDate} time={selectedTime} />
              <Paper sx={{ p: 2.5, borderRadius: 3, border: '1px solid #E8E0F5' }}>
                <Typography variant="subtitle2" fontWeight={800} mb={1.5} color="text.secondary"
                  sx={{ textTransform: 'uppercase', fontSize: 11, letterSpacing: 0.5 }}>About the Salon</Typography>
                <Typography fontWeight={700} mb={0.5}>{salonName}</Typography>
                {branch && (
                  <>
                    {branch.address && <Box sx={{ display: 'flex', gap: 1, mb: 0.5 }}><LocationOn sx={{ fontSize: 15, color: 'text.secondary', mt: 0.1 }} /><Typography variant="caption" color="text.secondary">{branch.address}{branch.city ? `, ${branch.city}` : ''}</Typography></Box>}
                    {branch.phone && <Box sx={{ display: 'flex', gap: 1, mb: 0.5 }}><Phone sx={{ fontSize: 15, color: 'text.secondary', mt: 0.1 }} /><Typography variant="caption" color="text.secondary">{branch.phone}</Typography></Box>}
                    <Box sx={{ display: 'flex', gap: 1 }}><AccessTime sx={{ fontSize: 15, color: 'text.secondary', mt: 0.1 }} /><Typography variant="caption" color="text.secondary">{branch.open_time} – {branch.close_time}</Typography></Box>
                  </>
                )}
                <Divider sx={{ my: 1.5 }} />
                <Box sx={{ display: 'flex' }}>
                  {[{ v: '4.9', l: 'Rating' }, { v: '500+', l: 'Clients' }, { v: '20+', l: 'Stylists' }].map((s, i) => (
                    <Box key={i} sx={{ textAlign: 'center', flex: 1, borderLeft: i > 0 ? '1px solid #eee' : 'none' }}>
                      <Typography variant="h6" fontWeight={900} color="primary">{s.v}</Typography>
                      <Typography variant="caption" color="text.secondary">{s.l}</Typography>
                    </Box>
                  ))}
                </Box>
              </Paper>
            </Box>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
}
