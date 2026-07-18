import { useState, useEffect } from 'react';
import {
  Box, Container, Typography, Button, Grid, Card, CardContent,
  Chip, Avatar, useMediaQuery, IconButton, Drawer, List, ListItem,
  ListItemButton, Divider,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  ContentCut, CalendarMonth, Star, CardGiftcard, Diamond,
  Menu as MenuIcon, Close, ArrowForward, CheckCircle,
  People, BarChart, AutoAwesome, Spa,
  Phone, Email, LocationOn,
} from '@mui/icons-material';
import { Link, useNavigate } from 'react-router-dom';
import { useAppSelector } from '@/app/hooks';

const FEATURES = [
  { icon: <CalendarMonth />, title: 'Easy Scheduling', desc: 'Book any service in under 60 seconds — pick your stylist, date & time.' },
  { icon: <Star />, title: 'Loyalty Rewards', desc: 'Earn points on every visit and redeem them for free services.' },
  { icon: <Diamond />, title: 'Memberships', desc: 'Gold & Silver plans with exclusive discounts and priority booking.' },
  { icon: <CardGiftcard />, title: 'Gift Cards', desc: 'Give the gift of beauty. Buy and redeem gift cards instantly.' },
  { icon: <AutoAwesome />, title: 'AI Stylist Advice', desc: 'Get personalised service recommendations powered by AI.' },
  { icon: <People />, title: 'Your Visit History', desc: 'Access all past appointments and track your loyalty points anytime.' },
];

const STATS = [
  { value: '500+', label: 'Happy Clients' },
  { value: '20+', label: 'Expert Stylists' },
  { value: '4.9★', label: 'Average Rating' },
  { value: '3', label: 'Locations' },
];

export default function LandingPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const navigate = useNavigate();
  const isAuthenticated = useAppSelector((s) => s.auth.isAuthenticated);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [salonName, setSalonName] = useState('Luxe Beauty Lounge');

  // If already authenticated as admin, go to dashboard
  useEffect(() => {
    if (isAuthenticated) navigate('/billing', { replace: true });
  }, [isAuthenticated]);

  // Try to fetch salon name without auth
  useEffect(() => {
    fetch('/api/v1/salon/public-info')
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d?.salon_name) setSalonName(d.salon_name); })
      .catch(() => {});
  }, []);

  const navLinks = [
    { label: 'Book Appointment', to: '/book' },
    { label: 'My Account', to: '/portal' },
  ];

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#FAFAFA' }}>
      {/* ─── TOPBAR ─── */}
      <Box
        component="header"
        sx={{
          position: 'sticky', top: 0, zIndex: 100,
          bgcolor: 'rgba(255,255,255,0.95)',
          backdropFilter: 'blur(10px)',
          borderBottom: '1px solid #E8E0F5',
          px: { xs: 2, md: 6 }, py: 1.5,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}
      >
        {/* Logo */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box sx={{ width: 36, height: 36, bgcolor: '#6C3FC5', borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ContentCut sx={{ color: '#fff', fontSize: 20 }} />
          </Box>
          <Box>
            <Typography variant="subtitle1" fontWeight={800} color="primary" lineHeight={1}>{salonName}</Typography>
            <Typography variant="caption" color="text.secondary" lineHeight={1}>Management Platform</Typography>
          </Box>
        </Box>

        {/* Desktop nav */}
        {!isMobile && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Button component={Link} to="/portal" variant="text" color="primary" sx={{ fontWeight: 600, fontSize: 14 }}>
              My Bookings
            </Button>
            <Button component={Link} to="/book" variant="contained" color="primary" sx={{ borderRadius: 3, fontWeight: 700, px: 3 }}>
              Book Now
            </Button>
          </Box>
        )}

        {/* Mobile hamburger */}
        {isMobile && (
          <IconButton onClick={() => setDrawerOpen(true)}><MenuIcon /></IconButton>
        )}
      </Box>

      {/* Mobile drawer */}
      <Drawer anchor="right" open={drawerOpen} onClose={() => setDrawerOpen(false)}>
        <Box sx={{ width: 250, p: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <IconButton onClick={() => setDrawerOpen(false)}><Close /></IconButton>
          </Box>
          <List>
            {navLinks.map((l) => (
              <ListItem key={l.to} disablePadding>
                <ListItemButton component={Link} to={l.to} onClick={() => setDrawerOpen(false)}>
                  <Typography fontWeight={600}>{l.label}</Typography>
                </ListItemButton>
              </ListItem>
            ))}
            <Divider sx={{ my: 1 }} />
            <ListItem disablePadding>
              <ListItemButton component={Link} to="/login" onClick={() => setDrawerOpen(false)}>
                <Typography color="text.secondary" fontSize={13}>Staff Login</Typography>
              </ListItemButton>
            </ListItem>
          </List>
        </Box>
      </Drawer>

      {/* ─── HERO ─── */}
      <Box
        sx={{
          background: 'linear-gradient(135deg, #3D1F8C 0%, #6C3FC5 50%, #A776F3 100%)',
          pt: { xs: 8, md: 12 },
          pb: { xs: 6, md: 10 },
          textAlign: 'center',
          color: 'white',
          px: 2,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Decorative circles */}
        <Box sx={{ position: 'absolute', top: -60, right: -60, width: 300, height: 300, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.05)' }} />
        <Box sx={{ position: 'absolute', bottom: -80, left: -80, width: 400, height: 400, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.04)' }} />

        <Container maxWidth="md" sx={{ position: 'relative' }}>
          <Chip label="✨ Premium Salon Experience" sx={{ bgcolor: 'rgba(255,255,255,0.15)', color: 'white', mb: 3, fontWeight: 600 }} />
          <Typography variant={isMobile ? 'h3' : 'h2'} fontWeight={900} mb={2} lineHeight={1.1}>
            Your Beauty,<br />Our Passion
          </Typography>
          <Typography variant="h6" sx={{ opacity: 0.85, mb: 4, fontWeight: 400, maxWidth: 520, mx: 'auto' }}>
            Book appointments, track loyalty rewards, and manage your beauty journey — all in one place.
          </Typography>

          {/* Primary CTA */}
          <Box sx={{ mb: 3 }}>
            <Button
              component={Link}
              to="/book"
              variant="contained"
              size="large"
              endIcon={<ArrowForward />}
              sx={{
                bgcolor: 'white', color: '#6C3FC5', fontWeight: 800,
                px: 5, py: 1.8, borderRadius: 3, fontSize: 17,
                '&:hover': { bgcolor: '#F3EDFF' },
                boxShadow: '0 4px 24px rgba(0,0,0,0.25)',
              }}
            >
              Book an Appointment
            </Button>
          </Box>
          <Typography variant="body2" sx={{ opacity: 0.65, mb: 5 }}>
            Returning customer?{' '}
            <Box component={Link} to="/portal" sx={{ color: 'white', fontWeight: 700, textDecoration: 'underline' }}>
              View your bookings
            </Box>
          </Typography>

          {/* Stats */}
          <Grid container spacing={2} justifyContent="center" sx={{ maxWidth: 600, mx: 'auto' }}>
            {STATS.map((s) => (
              <Grid item xs={6} sm={3} key={s.label}>
                <Box>
                  <Typography variant="h5" fontWeight={900}>{s.value}</Typography>
                  <Typography variant="caption" sx={{ opacity: 0.75 }}>{s.label}</Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* ─── TWO PORTAL CARDS ─── */}
      <Container maxWidth="md" sx={{ py: { xs: 5, md: 8 } }}>
        <Typography variant="h4" fontWeight={800} textAlign="center" mb={1}>What would you like to do?</Typography>
        <Typography color="text.secondary" textAlign="center" mb={5}>Two dedicated portals — one for booking, one for your account</Typography>

        <Grid container spacing={3}>
          {/* Booking Portal Card */}
          <Grid item xs={12} md={6}>
            <Card
              sx={{
                borderRadius: 4, p: 1, cursor: 'pointer',
                border: '2px solid #E8E0F5',
                transition: 'all 0.2s',
                '&:hover': { borderColor: '#6C3FC5', boxShadow: '0 8px 32px #6C3FC520', transform: 'translateY(-4px)' },
              }}
              onClick={() => navigate('/book')}
            >
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ width: 64, height: 64, bgcolor: '#6C3FC510', borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 2 }}>
                  <CalendarMonth sx={{ color: '#6C3FC5', fontSize: 32 }} />
                </Box>
                <Typography variant="h5" fontWeight={800} mb={1}>Online Booking Portal</Typography>
                <Typography color="text.secondary" mb={3} variant="body2">
                  Book your next appointment in under 60 seconds. Choose your service, stylist, and preferred time. No account needed.
                </Typography>
                {['Browse all services with prices', 'Choose your favourite stylist', 'Pick date & time instantly', 'Get instant confirmation'].map((t) => (
                  <Box key={t} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <CheckCircle sx={{ color: '#6C3FC5', fontSize: 18 }} />
                    <Typography variant="body2">{t}</Typography>
                  </Box>
                ))}
                <Button
                  component={Link} to="/book"
                  variant="contained" fullWidth sx={{ mt: 3, borderRadius: 3, py: 1.2, fontWeight: 700 }}
                  endIcon={<ArrowForward />}
                >
                  Book Appointment
                </Button>
                <Typography variant="caption" color="text.secondary" textAlign="center" display="block" mt={1}>
                  No account required • Available 24/7
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          {/* My Account Portal Card */}
          <Grid item xs={12} md={6}>
            <Card
              sx={{
                borderRadius: 4, p: 1, cursor: 'pointer',
                border: '2px solid #E8E0F5',
                transition: 'all 0.2s',
                '&:hover': { borderColor: '#FF9800', boxShadow: '0 8px 32px #FF980020', transform: 'translateY(-4px)' },
              }}
              onClick={() => navigate('/portal')}
            >
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ width: 64, height: 64, bgcolor: '#FF980010', borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 2 }}>
                  <Spa sx={{ color: '#FF9800', fontSize: 32 }} />
                </Box>
                <Typography variant="h5" fontWeight={800} mb={1}>My Account Portal</Typography>
                <Typography color="text.secondary" mb={3} variant="body2">
                  Your personal beauty dashboard. View your appointment history, loyalty points, membership, and gift cards.
                </Typography>
                {['View upcoming & past appointments', 'Track loyalty points & rewards', 'Check membership benefits', 'Manage gift cards'].map((t) => (
                  <Box key={t} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <CheckCircle sx={{ color: '#FF9800', fontSize: 18 }} />
                    <Typography variant="body2">{t}</Typography>
                  </Box>
                ))}
                <Button
                  component={Link} to="/portal"
                  variant="contained" fullWidth
                  sx={{ mt: 3, borderRadius: 3, py: 1.2, fontWeight: 700, bgcolor: '#FF9800', '&:hover': { bgcolor: '#e68900' } }}
                  endIcon={<ArrowForward />}
                >
                  Sign In / Register
                </Button>
                <Typography variant="caption" color="text.secondary" textAlign="center" display="block" mt={1}>
                  Free account • Earn points every visit
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Container>

      {/* ─── FEATURES GRID ─── */}
      <Box sx={{ bgcolor: '#F8F5FF', py: { xs: 5, md: 8 } }}>
        <Container maxWidth="lg">
          <Typography variant="h4" fontWeight={800} textAlign="center" mb={1}>Everything you need</Typography>
          <Typography color="text.secondary" textAlign="center" mb={5}>All your salon benefits in one platform</Typography>
          <Grid container spacing={3}>
            {FEATURES.map((f) => (
              <Grid item xs={12} sm={6} md={4} key={f.title}>
                <Card sx={{ borderRadius: 3, height: '100%', border: '1px solid #E8E0F5' }} elevation={0}>
                  <CardContent sx={{ p: 3 }}>
                    <Avatar sx={{ bgcolor: '#6C3FC510', color: '#6C3FC5', mb: 2, width: 48, height: 48 }}>{f.icon}</Avatar>
                    <Typography fontWeight={700} mb={0.5}>{f.title}</Typography>
                    <Typography variant="body2" color="text.secondary">{f.desc}</Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* ─── FOOTER ─── */}
      <Box sx={{ bgcolor: '#1A0A3C', color: 'white', py: 4, px: { xs: 2, md: 6 } }}>
        <Container maxWidth="lg">
          <Grid container spacing={3} alignItems="center" justifyContent="space-between">
            <Grid item xs={12} md={4}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Box sx={{ width: 32, height: 32, bgcolor: '#6C3FC5', borderRadius: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ContentCut sx={{ color: '#fff', fontSize: 18 }} />
                </Box>
                <Typography fontWeight={800}>{salonName}</Typography>
              </Box>
              <Typography variant="caption" sx={{ opacity: 0.6 }}>Your beauty, our passion.</Typography>
            </Grid>
            <Grid item xs={12} md={4}>
              <Box sx={{ display: 'flex', gap: 2, justifyContent: { xs: 'flex-start', md: 'center' }, flexWrap: 'wrap' }}>
                <Button component={Link} to="/book" sx={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>Book Appointment</Button>
                <Button component={Link} to="/portal" sx={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>My Account</Button>
              </Box>
            </Grid>
            <Grid item xs={12} md={4} sx={{ textAlign: { xs: 'left', md: 'right' } }}>
              <Typography variant="caption" sx={{ opacity: 0.4 }}>
                © 2026 {salonName} •{' '}
                <Box component="span" sx={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={() => navigate('/login')}>
                  Staff Login
                </Box>
              </Typography>
            </Grid>
          </Grid>
        </Container>
      </Box>
    </Box>
  );
}
