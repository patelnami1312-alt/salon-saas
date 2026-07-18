import { useState, useEffect, useCallback } from 'react';
import dayjs from 'dayjs';
import {
  Box, Card, CardContent, Typography, Tabs, Tab, TextField, Button,
  Grid, Switch, FormControlLabel, Avatar, IconButton, Chip,
  MenuItem, Alert, CircularProgress,
} from '@mui/material';
import { PhotoCamera, Save, Language, Schedule, AttachMoney } from '@mui/icons-material';
import { useAppSelector } from '@/app/hooks';
import { useSalon } from '@/context/SalonContext';
import toast from 'react-hot-toast';
import { v, hasNoErrors } from '@/utils/formValidation';

// ── Currency catalogue (ISO 4217) ──────────────────────────────────────────
const CURRENCIES = [
  { code: 'USD', label: 'US Dollar ($)' },
  { code: 'EUR', label: 'Euro (€)' },
  { code: 'GBP', label: 'British Pound (£)' },
  { code: 'CAD', label: 'Canadian Dollar (CA$)' },
  { code: 'AUD', label: 'Australian Dollar (A$)' },
  { code: 'SGD', label: 'Singapore Dollar (S$)' },
  { code: 'AED', label: 'UAE Dirham (د.إ)' },
  { code: 'INR', label: 'Indian Rupee (₹)' },
  { code: 'MYR', label: 'Malaysian Ringgit (RM)' },
  { code: 'NZD', label: 'New Zealand Dollar (NZ$)' },
  { code: 'ZAR', label: 'South African Rand (R)' },
  { code: 'JPY', label: 'Japanese Yen (¥)' },
  { code: 'THB', label: 'Thai Baht (฿)' },
];

// ── Common IANA timezones ──────────────────────────────────────────────────
const TIMEZONES = [
  { value: 'UTC', label: 'UTC (Coordinated Universal Time)' },
  { value: 'America/New_York', label: 'Eastern Time (ET) — New York' },
  { value: 'America/Chicago', label: 'Central Time (CT) — Chicago' },
  { value: 'America/Denver', label: 'Mountain Time (MT) — Denver' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT) — Los Angeles' },
  { value: 'America/Toronto', label: 'Eastern Time — Toronto' },
  { value: 'America/Vancouver', label: 'Pacific Time — Vancouver' },
  { value: 'America/Sao_Paulo', label: 'Brasilia Time — São Paulo' },
  { value: 'Europe/London', label: 'GMT/BST — London' },
  { value: 'Europe/Paris', label: 'CET/CEST — Paris' },
  { value: 'Europe/Berlin', label: 'CET/CEST — Berlin' },
  { value: 'Europe/Amsterdam', label: 'CET/CEST — Amsterdam' },
  { value: 'Asia/Dubai', label: 'GST +04:00 — Dubai' },
  { value: 'Asia/Kolkata', label: 'IST +05:30 — India' },
  { value: 'Asia/Singapore', label: 'SGT +08:00 — Singapore' },
  { value: 'Asia/Tokyo', label: 'JST +09:00 — Tokyo' },
  { value: 'Asia/Kuala_Lumpur', label: 'MYT +08:00 — Kuala Lumpur' },
  { value: 'Australia/Sydney', label: 'AEST/AEDT — Sydney' },
  { value: 'Australia/Melbourne', label: 'AEST/AEDT — Melbourne' },
  { value: 'Pacific/Auckland', label: 'NZST/NZDT — Auckland' },
  { value: 'Africa/Johannesburg', label: 'SAST +02:00 — Johannesburg' },
];

// ── Date formats ───────────────────────────────────────────────────────────
const DATE_FORMATS = [
  { value: 'MMM D, YYYY', label: 'Jan 5, 2026 (US/International)' },
  { value: 'MM/DD/YYYY', label: '01/05/2026 (US)' },
  { value: 'DD/MM/YYYY', label: '05/01/2026 (UK / AU / IN)' },
  { value: 'DD MMM YYYY', label: '05 Jan 2026 (Verbose)' },
  { value: 'YYYY-MM-DD', label: '2026-01-05 (ISO 8601)' },
];

// ── Locales ────────────────────────────────────────────────────────────────
const LOCALES = [
  { value: 'en-US', label: 'English (United States)' },
  { value: 'en-GB', label: 'English (United Kingdom)' },
  { value: 'en-AU', label: 'English (Australia)' },
  { value: 'en-CA', label: 'English (Canada)' },
  { value: 'en-SG', label: 'English (Singapore)' },
  { value: 'en-IN', label: 'English (India)' },
  { value: 'en-ZA', label: 'English (South Africa)' },
  { value: 'fr-FR', label: 'French (France)' },
  { value: 'de-DE', label: 'German (Germany)' },
  { value: 'es-ES', label: 'Spanish (Spain)' },
  { value: 'pt-BR', label: 'Portuguese (Brazil)' },
  { value: 'ja-JP', label: 'Japanese (Japan)' },
  { value: 'ms-MY', label: 'Malay (Malaysia)' },
  { value: 'th-TH', label: 'Thai (Thailand)' },
];

export default function SettingsPage() {
  const [tab, setTab] = useState(0);
  const user = useAppSelector((s) => s.auth.user);
  const accessToken = useAppSelector((s) => s.auth.accessToken);
  const { settings, formatCurrency } = useSalon();

  const [saving, setSaving] = useState(false);

  const [profile, setProfile] = useState({
    first_name: user?.first_name || '',
    last_name: user?.last_name || '',
    email: user?.email || '',
    phone: user?.phone || '',
  });
  const [profileErrors, setProfileErrors] = useState({ first_name: '', last_name: '', email: '', phone: '' });
  const [profileTouched, setProfileTouched] = useState<Record<string, boolean>>({});

  const validateProfile = useCallback((p: typeof profile) => ({
    first_name: v.required(p.first_name, 'First name') || v.maxLen(p.first_name, 100, 'First name'),
    last_name: v.maxLen(p.last_name, 100, 'Last name'),
    email: v.required(p.email, 'Email') || v.email(p.email),
    phone: v.phone(p.phone),
  }), []);

  const handleProfileBlur = (field: string) => {
    setProfileTouched((p) => ({ ...p, [field]: true }));
    setProfileErrors(validateProfile(profile));
  };
  const handleProfileChange = (field: keyof typeof profile, value: string) => {
    const next = { ...profile, [field]: value };
    setProfile(next);
    if (profileTouched[field]) setProfileErrors(validateProfile(next));
  };

  // Password form
  const [pwd, setPwd] = useState({ current: '', next_pw: '', confirm: '' });
  const [pwdErrors, setPwdErrors] = useState({ current: '', next_pw: '', confirm: '' });
  const [pwdTouched, setPwdTouched] = useState<Record<string, boolean>>({});
  const [pwdSaving, setPwdSaving] = useState(false);

  const validatePwd = (p: typeof pwd) => ({
    current: v.required(p.current, 'Current password'),
    next_pw: v.required(p.next_pw, 'New password') || v.passwordMin(p.next_pw),
    confirm: v.required(p.confirm, 'Confirm password') || v.passwordMatch(p.next_pw, p.confirm),
  });

  const handlePwdBlur = (field: string) => {
    setPwdTouched((p) => ({ ...p, [field]: true }));
    setPwdErrors(validatePwd(pwd));
  };
  const handlePwdChange = (field: keyof typeof pwd, value: string) => {
    const next = { ...pwd, [field]: value };
    setPwd(next);
    if (pwdTouched[field]) setPwdErrors(validatePwd(next));
  };

  const handleUpdatePassword = async () => {
    const allTouched = { current: true, next_pw: true, confirm: true };
    setPwdTouched(allTouched);
    const errs = validatePwd(pwd);
    setPwdErrors(errs);
    if (!hasNoErrors(errs)) return;
    setPwdSaving(true);
    try {
      const BASE = import.meta.env.VITE_API_URL || '/api/v1';
      const res = await fetch(`${BASE}/auth/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ current_password: pwd.current, new_password: pwd.next_pw }),
      });
      if (res.ok) {
        toast.success('Password updated successfully');
        setPwd({ current: '', next_pw: '', confirm: '' });
        setPwdTouched({});
        setPwdErrors({ current: '', next_pw: '', confirm: '' });
      } else {
        const data = await res.json();
        const msg = data?.detail ?? 'Failed to update password';
        if (typeof msg === 'string' && msg.toLowerCase().includes('current')) {
          setPwdErrors((p) => ({ ...p, current: msg }));
        } else {
          toast.error(msg);
        }
      }
    } catch {
      toast.error('Network error');
    } finally {
      setPwdSaving(false);
    }
  };

  const handleSaveProfile = async () => {
    const allTouched = { first_name: true, last_name: true, email: true, phone: true };
    setProfileTouched(allTouched);
    const errs = validateProfile(profile);
    setProfileErrors(errs);
    if (!hasNoErrors(errs)) return;
    setSaving(true);
    try {
      const BASE = import.meta.env.VITE_API_URL || '/api/v1';
      const res = await fetch(`${BASE}/users/me`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(profile),
      });
      if (res.ok) {
        toast.success('Profile saved!');
      } else {
        toast.error('Failed to save profile');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setSaving(false);
    }
  };

  const [salonForm, setSalonForm] = useState({
    salon_name: settings.salon_name,
    address: settings.address,
    phone: settings.phone,
    tax_percent: String(settings.tax_percent),
    currency: settings.currency,
    timezone: settings.timezone,
    locale: settings.locale,
    date_format: settings.date_format,
    time_format: settings.time_format,
    loyalty_points_per_currency: String(settings.loyalty_points_per_currency),
    loyalty_points_redemption_rate: String(settings.loyalty_points_redemption_rate),
  });

  const [salonErrors, setSalonErrors] = useState({ salon_name: '', phone: '', tax_percent: '' });
  const [salonTouched, setSalonTouched] = useState<Record<string, boolean>>({});

  const validateSalon = (f: { salon_name: string; phone: string; tax_percent: string }) => ({
    salon_name: v.required(f.salon_name, 'Salon name') || v.minLen(f.salon_name, 2, 'Salon name'),
    phone: v.phone(f.phone),
    tax_percent: v.percent(f.tax_percent, 'Tax rate'),
  });

  const handleSalonBlur = (field: string) => {
    setSalonTouched((p) => ({ ...p, [field]: true }));
    setSalonErrors(validateSalon(salonForm));
  };
  const handleSalonChange = (field: keyof typeof salonForm, value: string) => {
    const next = { ...salonForm, [field]: value };
    setSalonForm(next);
    if (salonTouched[field]) setSalonErrors(validateSalon(next));
  };

  const [notifications, setNotifications] = useState({
    appointment_reminder: settings.appointment_reminder,
    birthday_wishes: settings.birthday_wishes,
    marketing_emails: settings.marketing_emails,
    sms_alerts: settings.sms_alerts,
  });

  // Sync form when settings load from API
  useEffect(() => {
    setSalonForm((prev) => ({
      ...prev,
      salon_name: settings.salon_name || prev.salon_name,
      address: settings.address || prev.address,
      phone: settings.phone || prev.phone,
      tax_percent: String(settings.tax_percent),
      currency: settings.currency,
      timezone: settings.timezone,
      locale: settings.locale,
      date_format: settings.date_format,
      time_format: settings.time_format,
      loyalty_points_per_currency: String(settings.loyalty_points_per_currency),
      loyalty_points_redemption_rate: String(settings.loyalty_points_redemption_rate),
    }));
    setNotifications({
      appointment_reminder: settings.appointment_reminder,
      birthday_wishes: settings.birthday_wishes,
      marketing_emails: settings.marketing_emails,
      sms_alerts: settings.sms_alerts,
    });
  }, [settings.salon_id]);

  const handleSaveSalon = async () => {
    const allTouched = { salon_name: true, phone: true, tax_percent: true };
    setSalonTouched(allTouched);
    const errs = validateSalon(salonForm);
    setSalonErrors(errs);
    if (!hasNoErrors(errs)) return;
    setSaving(true);
    try {
      const BASE = import.meta.env.VITE_API_URL || '/api/v1';
      const res = await fetch(`${BASE}/salon/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          ...salonForm,
          tax_percent: parseFloat(salonForm.tax_percent) || 0,
          loyalty_points_per_currency: parseFloat(salonForm.loyalty_points_per_currency) || 1,
          loyalty_points_redemption_rate: parseFloat(salonForm.loyalty_points_redemption_rate) || 0.01,
        }),
      });
      if (res.ok) {
        toast.success('Salon settings saved! Reload to see currency changes.');
      } else {
        toast.error('Failed to save settings');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveNotifications = async () => {
    setSaving(true);
    try {
      const BASE = import.meta.env.VITE_API_URL || '/api/v1';
      const res = await fetch(`${BASE}/salon/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(notifications),
      });
      if (res.ok) {
        toast.success('Notification preferences saved!');
      } else {
        toast.error('Failed to save preferences');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setSaving(false);
    }
  };

  // Live preview of currency format
  const previewCurrency = (() => {
    try {
      return new Intl.NumberFormat(salonForm.locale, {
        style: 'currency',
        currency: salonForm.currency,
        minimumFractionDigits: 0,
      }).format(1250);
    } catch {
      return '—';
    }
  })();

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} mb={3}>Settings</Typography>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)}>
          <Tab label="Profile" />
          <Tab label="Salon" />
          <Tab label="Notifications" />
          <Tab label="Security" />
        </Tabs>
      </Box>

      {/* ── PROFILE TAB ── */}
      {tab === 0 && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent sx={{ textAlign: 'center', py: 4 }}>
                <Box sx={{ position: 'relative', display: 'inline-block', mb: 2 }}>
                  <Avatar sx={{ width: 100, height: 100, bgcolor: 'primary.main', fontSize: 36, mx: 'auto' }}>
                    {user?.first_name?.[0]}{user?.last_name?.[0]}
                  </Avatar>
                  <IconButton
                    size="small"
                    aria-label="Change profile photo"
                    sx={{ position: 'absolute', bottom: 0, right: 0, bgcolor: 'white', border: '1px solid', borderColor: 'divider' }}
                  >
                    <PhotoCamera fontSize="small" />
                  </IconButton>
                </Box>
                <Typography variant="h6" fontWeight={700}>{user?.first_name} {user?.last_name}</Typography>
                <Chip label={user?.role_name || user?.role_code || 'Staff'} size="small" color="primary" sx={{ mt: 0.5 }} />
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={8}>
            <Card>
              <CardContent>
                <Typography variant="subtitle1" fontWeight={700} mb={2}>Personal Information</Typography>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <TextField
                      label="First Name *" fullWidth value={profile.first_name}
                      onChange={(e) => handleProfileChange('first_name', e.target.value)}
                      onBlur={() => handleProfileBlur('first_name')}
                      error={profileTouched.first_name && !!profileErrors.first_name}
                      helperText={profileTouched.first_name ? profileErrors.first_name : ''}
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField
                      label="Last Name" fullWidth value={profile.last_name}
                      onChange={(e) => handleProfileChange('last_name', e.target.value)}
                      onBlur={() => handleProfileBlur('last_name')}
                      error={profileTouched.last_name && !!profileErrors.last_name}
                      helperText={profileTouched.last_name ? profileErrors.last_name : ''}
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField
                      label="Email *" fullWidth type="email" value={profile.email}
                      onChange={(e) => handleProfileChange('email', e.target.value)}
                      onBlur={() => handleProfileBlur('email')}
                      error={profileTouched.email && !!profileErrors.email}
                      helperText={profileTouched.email ? profileErrors.email : ''}
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField
                      label="Phone" fullWidth value={profile.phone}
                      onChange={(e) => handleProfileChange('phone', e.target.value)}
                      onBlur={() => handleProfileBlur('phone')}
                      error={profileTouched.phone && !!profileErrors.phone}
                      helperText={profileTouched.phone ? profileErrors.phone : ''}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <Button variant="contained" startIcon={<Save />} onClick={handleSaveProfile} disabled={saving}>
                      {saving ? 'Saving…' : 'Save Changes'}
                    </Button>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* ── SALON TAB ── */}
      {tab === 1 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {/* Business Info */}
          <Card>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={700} mb={2}>Business Information</Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Salon Name *" fullWidth value={salonForm.salon_name}
                    onChange={(e) => handleSalonChange('salon_name', e.target.value)}
                    onBlur={() => handleSalonBlur('salon_name')}
                    error={salonTouched.salon_name && !!salonErrors.salon_name}
                    helperText={salonTouched.salon_name ? salonErrors.salon_name : ''}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Phone" fullWidth value={salonForm.phone}
                    onChange={(e) => handleSalonChange('phone', e.target.value)}
                    onBlur={() => handleSalonBlur('phone')}
                    error={salonTouched.phone && !!salonErrors.phone}
                    helperText={salonTouched.phone ? salonErrors.phone : ''}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField label="Address" fullWidth multiline rows={2} value={salonForm.address} onChange={(e) => setSalonForm({ ...salonForm, address: e.target.value })} />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    label="Tax Rate (%)"
                    type="number"
                    fullWidth
                    inputProps={{ min: 0, max: 100, step: 0.1 }}
                    value={salonForm.tax_percent}
                    onChange={(e) => handleSalonChange('tax_percent', e.target.value)}
                    onBlur={() => handleSalonBlur('tax_percent')}
                    error={salonTouched.tax_percent && !!salonErrors.tax_percent}
                    helperText={salonTouched.tax_percent ? salonErrors.tax_percent : ''}
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {/* Region & Currency */}
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <Language color="primary" />
                <Typography variant="subtitle1" fontWeight={700}>Region & Currency</Typography>
              </Box>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    select
                    label="Currency"
                    fullWidth
                    value={salonForm.currency}
                    onChange={(e) => setSalonForm({ ...salonForm, currency: e.target.value })}
                    InputProps={{ startAdornment: <AttachMoney sx={{ color: 'text.secondary', mr: 0.5, fontSize: 20 }} /> }}
                  >
                    {CURRENCIES.map((c) => (
                      <MenuItem key={c.code} value={c.code}>{c.label}</MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    select
                    label="Locale (number & currency format)"
                    fullWidth
                    value={salonForm.locale}
                    onChange={(e) => setSalonForm({ ...salonForm, locale: e.target.value })}
                  >
                    {LOCALES.map((l) => (
                      <MenuItem key={l.value} value={l.value}>{l.label}</MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    select
                    label="Timezone"
                    fullWidth
                    value={salonForm.timezone}
                    onChange={(e) => setSalonForm({ ...salonForm, timezone: e.target.value })}
                    InputProps={{ startAdornment: <Schedule sx={{ color: 'text.secondary', mr: 0.5, fontSize: 20 }} /> }}
                  >
                    {TIMEZONES.map((tz) => (
                      <MenuItem key={tz.value} value={tz.value}>{tz.label}</MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <Grid item xs={12} sm={3}>
                  <TextField
                    select
                    label="Date Format"
                    fullWidth
                    value={salonForm.date_format}
                    onChange={(e) => setSalonForm({ ...salonForm, date_format: e.target.value })}
                  >
                    {DATE_FORMATS.map((f) => (
                      <MenuItem key={f.value} value={f.value}>{f.label}</MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <Grid item xs={12} sm={3}>
                  <TextField
                    select
                    label="Time Format"
                    fullWidth
                    value={salonForm.time_format}
                    onChange={(e) => setSalonForm({ ...salonForm, time_format: e.target.value })}
                  >
                    <MenuItem value="12h">12-hour (3:30 PM)</MenuItem>
                    <MenuItem value="24h">24-hour (15:30)</MenuItem>
                  </TextField>
                </Grid>

                {/* Live preview */}
                <Grid item xs={12}>
                  <Alert severity="info" sx={{ borderRadius: 2 }}>
                    <Typography variant="body2">
                      <strong>Preview:</strong> {previewCurrency} · Date: {dayjs('2026-01-05').format(salonForm.date_format)}
                    </Typography>
                  </Alert>
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {/* Loyalty Program */}
          <Card>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={700} mb={2}>Loyalty Program</Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label={`Points earned per 1 ${salonForm.currency} spent`}
                    type="number"
                    fullWidth
                    inputProps={{ min: 0, step: 0.1 }}
                    value={salonForm.loyalty_points_per_currency}
                    onChange={(e) => setSalonForm({ ...salonForm, loyalty_points_per_currency: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label={`${salonForm.currency} value per point redeemed`}
                    type="number"
                    fullWidth
                    inputProps={{ min: 0, step: 0.001 }}
                    value={salonForm.loyalty_points_redemption_rate}
                    onChange={(e) => setSalonForm({ ...salonForm, loyalty_points_redemption_rate: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="caption" color="text.secondary">
                    Example: customer spends {formatCurrency(100)} → earns{' '}
                    {Math.round(100 * parseFloat(salonForm.loyalty_points_per_currency || '1'))} pts → worth{' '}
                    {formatCurrency(Math.round(100 * parseFloat(salonForm.loyalty_points_per_currency || '1')) * parseFloat(salonForm.loyalty_points_redemption_rate || '0.01'))}
                  </Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          <Box>
            <Button
              variant="contained"
              startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <Save />}
              onClick={handleSaveSalon}
              disabled={saving}
              size="large"
            >
              Save Salon Settings
            </Button>
          </Box>
        </Box>
      )}

      {/* ── NOTIFICATIONS TAB ── */}
      {tab === 2 && (
        <Card>
          <CardContent>
            <Typography variant="subtitle1" fontWeight={700} mb={2}>Notification Preferences</Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {[
                { key: 'appointment_reminder', label: 'Appointment Reminders', desc: 'Send reminders 24h and 1h before appointments' },
                { key: 'birthday_wishes', label: 'Birthday Wishes', desc: 'Automatically send birthday messages to customers' },
                { key: 'marketing_emails', label: 'Marketing Emails', desc: 'Promotional campaigns and offers' },
                { key: 'sms_alerts', label: 'SMS Alerts', desc: 'Critical notifications via SMS' },
              ].map((item) => (
                <Box key={item.key} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 2, bgcolor: 'grey.50', borderRadius: 2 }}>
                  <Box>
                    <Typography variant="body2" fontWeight={600}>{item.label}</Typography>
                    <Typography variant="caption" color="text.secondary">{item.desc}</Typography>
                  </Box>
                  <FormControlLabel
                    control={<Switch checked={notifications[item.key as keyof typeof notifications]} onChange={(e) => setNotifications({ ...notifications, [item.key]: e.target.checked })} />}
                    label=""
                  />
                </Box>
              ))}
            </Box>
            <Box sx={{ mt: 3 }}>
              <Button
                variant="contained"
                startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <Save />}
                onClick={handleSaveNotifications}
                disabled={saving}
              >
                Save Preferences
              </Button>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* ── SECURITY TAB ── */}
      {tab === 3 && (
        <Card>
          <CardContent>
            <Typography variant="subtitle1" fontWeight={700} mb={2}>Change Password</Typography>
            <Grid container spacing={2} sx={{ maxWidth: 480 }}>
              <Grid item xs={12}>
                <TextField
                  label="Current Password *" type="password" fullWidth
                  value={pwd.current}
                  onChange={(e) => handlePwdChange('current', e.target.value)}
                  onBlur={() => handlePwdBlur('current')}
                  error={pwdTouched.current && !!pwdErrors.current}
                  helperText={pwdTouched.current ? pwdErrors.current : ''}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="New Password *" type="password" fullWidth
                  value={pwd.next_pw}
                  onChange={(e) => handlePwdChange('next_pw', e.target.value)}
                  onBlur={() => handlePwdBlur('next_pw')}
                  error={pwdTouched.next_pw && !!pwdErrors.next_pw}
                  helperText={pwdTouched.next_pw ? pwdErrors.next_pw : 'Minimum 8 characters'}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Confirm New Password *" type="password" fullWidth
                  value={pwd.confirm}
                  onChange={(e) => handlePwdChange('confirm', e.target.value)}
                  onBlur={() => handlePwdBlur('confirm')}
                  error={pwdTouched.confirm && !!pwdErrors.confirm}
                  helperText={pwdTouched.confirm ? pwdErrors.confirm : ''}
                />
              </Grid>
              <Grid item xs={12}>
                <Button variant="contained" color="error" onClick={handleUpdatePassword} disabled={pwdSaving}>
                  {pwdSaving ? 'Updating…' : 'Update Password'}
                </Button>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}
