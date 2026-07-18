import { useState, useEffect } from 'react';
import {
  Box, Container, Typography, Button, TextField, Paper, Grid,
  Tab, Tabs, Chip, Avatar, CircularProgress, Alert, Divider,
  InputAdornment, IconButton,
} from '@mui/material';
import {
  Phone, ContentCut, Star, CheckCircle, Schedule,
  CalendarMonth, Add, Home, ArrowBack, Diamond,
} from '@mui/icons-material';
import { Link, useSearchParams } from 'react-router-dom';

const API = '/api/v1/customer-portal';
const SALON_ID = 1;

interface Appointment {
  appointment_id: number;
  confirmation_number?: string;
  service_name: string;
  service_price: number;
  staff_name: string | null;
  date: string;
  time: string;
  status: string;
  booking_source: string;
}

interface LookupResult {
  customer_id: number;
  first_name: string;
  last_name: string;
  mobile: string;
  loyalty_points: number;
  total_visits: number;
  appointments: Appointment[];
}

function statusColor(s: string): 'default' | 'success' | 'warning' | 'error' | 'info' {
  if (s === 'Completed') return 'success';
  if (s === 'Confirmed') return 'info';
  if (s === 'Scheduled') return 'warning';
  if (s === 'Cancelled' || s === 'NoShow') return 'error';
  return 'default';
}

function fmtDate(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  });
}

function AppointmentCard({ a }: { a: Appointment }) {
  const upcoming =
    new Date(a.date + 'T12:00:00') >= new Date() &&
    a.status !== 'Cancelled' &&
    a.status !== 'NoShow';
  return (
    <Paper
      sx={{
        p: 2.5, mb: 1.5, borderRadius: 3,
        display: 'flex', gap: 2, alignItems: 'flex-start',
        border: upcoming ? '1.5px solid #E0D0FA' : '1px solid #eee',
        transition: '0.15s',
        '&:hover': { boxShadow: '0 4px 16px rgba(108,63,197,0.1)' },
      }}
    >
      <Avatar
        sx={{
          bgcolor: upcoming ? '#6C3FC515' : '#f5f5f5',
          color: upcoming ? '#6C3FC5' : 'text.secondary',
          width: 44, height: 44,
        }}
      >
        <ContentCut />
      </Avatar>
      <Box sx={{ flex: 1 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
          <Typography fontWeight={700}>{a.service_name}</Typography>
          <Chip label={a.status} size="small" color={statusColor(a.status)} />
        </Box>
        {a.staff_name && (
          <Typography variant="body2" color="text.secondary">with {a.staff_name}</Typography>
        )}
        <Box sx={{ display: 'flex', gap: 2, mt: 0.5, flexWrap: 'wrap' }}>
          <Typography variant="caption" color="text.secondary">{fmtDate(a.date)}</Typography>
          <Typography variant="caption" color="text.secondary">{a.time}</Typography>
          <Typography variant="caption" color="text.secondary" fontWeight={600}>
            ${a.service_price.toFixed(0)}
          </Typography>
        </Box>
        {a.confirmation_number && (
          <Typography variant="caption" color="text.disabled">Ref: {a.confirmation_number}</Typography>
        )}
      </Box>
    </Paper>
  );
}

// ── DASHBOARD shown after phone lookup ───────────────────────────────────────
function CustomerDashboard({ result, onBack }: { result: LookupResult; onBack: () => void }) {
  const [tab, setTab] = useState(0);

  const upcoming = result.appointments.filter(
    (a) =>
      new Date(a.date + 'T12:00:00') >= new Date() &&
      a.status !== 'Cancelled' &&
      a.status !== 'NoShow',
  );
  const past = result.appointments.filter(
    (a) =>
      new Date(a.date + 'T12:00:00') < new Date() ||
      a.status === 'Completed' ||
      a.status === 'Cancelled',
  );

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#F8F5FF' }}>
      {/* Top bar */}
      <Box
        sx={{
          position: 'sticky', top: 0, zIndex: 100,
          bgcolor: '#1A0533', px: { xs: 2, md: 4 }, py: 1.5,
          display: 'flex', alignItems: 'center', gap: 2,
        }}
      >
        <Button
          component="a" href="/"
          startIcon={<Home sx={{ fontSize: 16 }} />}
          sx={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, textTransform: 'none', minWidth: 0 }}
        >
          Home
        </Button>
        <Divider orientation="vertical" flexItem sx={{ borderColor: 'rgba(255,255,255,0.15)' }} />
        <Typography sx={{ color: '#fff', fontWeight: 700, flex: 1, fontSize: 15 }}>
          My Account
        </Typography>
        <Button
          size="small" startIcon={<ArrowBack sx={{ fontSize: 14 }} />}
          onClick={onBack}
          sx={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, textTransform: 'none' }}
        >
          Switch number
        </Button>
      </Box>

      <Container maxWidth="md" sx={{ py: 3 }}>
        {/* Welcome banner */}
        <Paper
          sx={{
            p: 2.5, borderRadius: 3, mb: 3,
            background: 'linear-gradient(135deg, #6C3FC5 0%, #A776F3 100%)',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Avatar
              sx={{
                width: 52, height: 52, bgcolor: 'rgba(255,255,255,0.2)',
                fontSize: 22, fontWeight: 800, color: '#fff',
              }}
            >
              {result.first_name[0]}{result.last_name?.[0] ?? ''}
            </Avatar>
            <Box>
              <Typography fontWeight={800} sx={{ color: '#fff', fontSize: 20 }}>
                Hi, {result.first_name}! 👋
              </Typography>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.75)' }}>
                {result.total_visits} visits · {result.loyalty_points} loyalty points
              </Typography>
            </Box>
          </Box>
        </Paper>

        {/* Stats */}
        <Grid container spacing={2} mb={3}>
          {[
            { icon: <Star sx={{ color: '#6C3FC5', fontSize: 26 }} />, value: result.loyalty_points, label: 'Loyalty Points', bg: '#6C3FC512' },
            { icon: <Schedule sx={{ color: '#2196F3', fontSize: 26 }} />, value: upcoming.length, label: 'Upcoming', bg: '#2196F312' },
            { icon: <CheckCircle sx={{ color: '#4CAF50', fontSize: 26 }} />, value: past.length, label: 'Past Visits', bg: '#4CAF5012' },
            { icon: <Diamond sx={{ color: '#FF9800', fontSize: 26 }} />, value: result.total_visits, label: 'Total Visits', bg: '#FF980012' },
          ].map((s, i) => (
            <Grid item xs={6} sm={3} key={i}>
              <Paper sx={{ p: 2, textAlign: 'center', borderRadius: 3, bgcolor: s.bg }}>
                {s.icon}
                <Typography fontWeight={800} fontSize={22}>{s.value}</Typography>
                <Typography variant="caption" color="text.secondary">{s.label}</Typography>
              </Paper>
            </Grid>
          ))}
        </Grid>

        {/* Book again CTA */}
        <Paper
          sx={{
            p: 2, borderRadius: 3, mb: 3,
            bgcolor: '#F3EDFF', border: '1.5px solid #D4C0F5',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2,
          }}
        >
          <Typography fontWeight={700} fontSize={14}>Ready for your next visit?</Typography>
          <Button
            variant="contained" size="small" component={Link} to="/book"
            startIcon={<Add />}
            sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700, flexShrink: 0 }}
          >
            Book Now
          </Button>
        </Paper>

        {/* Tabs */}
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          sx={{ mb: 2, '& .MuiTab-root': { fontWeight: 600 } }}
        >
          <Tab label={`Upcoming (${upcoming.length})`} />
          <Tab label={`History (${past.length})`} />
        </Tabs>

        {tab === 0 && (
          upcoming.length === 0 ? (
            <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 3 }}>
              <CalendarMonth sx={{ fontSize: 44, color: 'text.disabled', mb: 1 }} />
              <Typography color="text.secondary" mb={2}>No upcoming appointments</Typography>
              <Button variant="contained" component={Link} to="/book">Book Now</Button>
            </Paper>
          ) : (
            upcoming.map((a) => <AppointmentCard key={a.appointment_id} a={a} />)
          )
        )}

        {tab === 1 && (
          past.length === 0 ? (
            <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 3 }}>
              <Typography color="text.secondary">No past visits yet</Typography>
            </Paper>
          ) : (
            past.map((a) => <AppointmentCard key={a.appointment_id} a={a} />)
          )
        )}
      </Container>
    </Box>
  );
}

// ── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function CustomerPortalPage() {
  const [searchParams] = useSearchParams();
  const defaultMobile = searchParams.get('mobile') ?? '';

  const [mobile, setMobile] = useState(defaultMobile);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<LookupResult | null>(null);

  const handleLookup = async (m?: string) => {
    const num = (m ?? mobile).trim();
    if (!num) { setError('Please enter your phone number'); return; }
    setError('');
    setLoading(true);
    try {
      const res = await fetch(
        `${API}/lookup?mobile=${encodeURIComponent(num)}&salon_id=${SALON_ID}`,
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Not found');
      setResult(data);
    } catch (e: any) {
      setError(
        e.message === 'No bookings found for this number'
          ? 'No account found for this number. Did you use a different number when booking?'
          : e.message,
      );
    } finally {
      setLoading(false);
    }
  };

  // Auto-lookup if mobile pre-filled from booking redirect
  useEffect(() => {
    if (defaultMobile) handleLookup(defaultMobile);
  }, []);

  if (result) {
    return <CustomerDashboard result={result} onBack={() => { setResult(null); setMobile(''); }} />;
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: 'linear-gradient(160deg, #F8F5FF 0%, #EDE7F6 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 2,
      }}
    >
      <Paper
        sx={{
          maxWidth: 420, width: '100%',
          borderRadius: 4, overflow: 'hidden',
          boxShadow: '0 20px 60px rgba(108,63,197,0.15)',
        }}
      >
        {/* Header */}
        <Box sx={{ bgcolor: '#1A0533', p: 3, textAlign: 'center' }}>
          <Box
            component="a" href="/"
            sx={{
              display: 'inline-flex', alignItems: 'center', gap: 0.5,
              color: 'rgba(255,255,255,0.5)', fontSize: 12,
              textDecoration: 'none', mb: 2,
              '&:hover': { color: '#fff' },
            }}
          >
            <Home sx={{ fontSize: 14 }} /> Home
          </Box>

          <Box
            sx={{
              width: 56, height: 56, borderRadius: '50%',
              bgcolor: '#6C3FC5',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              mx: 'auto', mb: 1.5,
            }}
          >
            <Phone sx={{ color: '#fff', fontSize: 28 }} />
          </Box>
          <Typography variant="h6" fontWeight={800} sx={{ color: '#fff', mb: 0.5 }}>
            My Account
          </Typography>
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.55)', fontSize: 13 }}>
            Enter your phone number to view bookings &amp; loyalty points
          </Typography>
        </Box>

        {/* Body */}
        <Box sx={{ p: 3 }}>
          {error && (
            <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{error}</Alert>
          )}

          <TextField
            label="Your Phone Number"
            value={mobile}
            onChange={(e) => setMobile(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
            fullWidth
            placeholder="+91 98765 43210"
            autoFocus={!defaultMobile}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Phone sx={{ color: '#6C3FC5', fontSize: 20 }} />
                </InputAdornment>
              ),
            }}
            sx={{
              mb: 2,
              '& .MuiOutlinedInput-root': {
                borderRadius: 2,
                fontSize: 18,
                fontWeight: 600,
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                  borderColor: '#6C3FC5',
                  borderWidth: 2,
                },
              },
            }}
          />

          <Button
            variant="contained"
            fullWidth
            size="large"
            onClick={() => handleLookup()}
            disabled={loading}
            sx={{
              borderRadius: 2, py: 1.5,
              fontWeight: 700, fontSize: 16,
              background: 'linear-gradient(135deg, #6C3FC5, #A776F3)',
              '&:hover': { background: 'linear-gradient(135deg, #5C2FB5, #9766E3)' },
            }}
          >
            {loading
              ? <CircularProgress size={24} sx={{ color: 'white' }} />
              : 'View My Account →'}
          </Button>

          <Box
            sx={{
              mt: 2.5, p: 2,
              bgcolor: '#F8F5FF', borderRadius: 2,
              border: '1px solid #E0D0FA',
              textAlign: 'center',
            }}
          >
            <Typography variant="caption" color="text.secondary">
              No password needed — just your phone number
            </Typography>
          </Box>
        </Box>

        <Divider />

        <Box sx={{ p: 2, textAlign: 'center' }}>
          <Typography variant="caption" color="text.disabled">
            Want to book an appointment?{' '}
            <Link to="/book" style={{ color: '#6C3FC5', fontWeight: 700 }}>
              Book Online
            </Link>
          </Typography>
        </Box>
      </Paper>
    </Box>
  );
}
