import { useState, useEffect } from 'react';
import {
  Box, Typography, Card, CardContent, TextField, InputAdornment, Switch,
  FormControlLabel, Button, Alert, Divider, Chip, CircularProgress,
  Grid, MenuItem, Select, FormControl, InputLabel,
} from '@mui/material';
import { Search, Save } from '@mui/icons-material';
import { useListAdminSalonsQuery, useGetFeatureFlagsQuery, useUpdateFeatureFlagsMutation } from '@/features/api/adminApiSlice';

const FEATURE_META: Record<string, { label: string; description: string; category: string }> = {
  online_booking: { label: 'Online Booking', description: 'Allow customers to book appointments online', category: 'Booking' },
  ai_receptionist: { label: 'AI Receptionist', description: 'AI phone call handling and auto-booking', category: 'AI' },
  marketing_campaigns: { label: 'Marketing Campaigns', description: 'SMS & email marketing campaigns', category: 'Marketing' },
  loyalty_program: { label: 'Loyalty Program', description: 'Points earn & redeem system', category: 'CRM' },
  gift_cards: { label: 'Gift Cards', description: 'Digital gift card purchase & redemption', category: 'CRM' },
  multi_location: { label: 'Multi-Location', description: 'Manage multiple branches', category: 'Operations' },
  payroll: { label: 'Payroll', description: 'Staff payroll management & export', category: 'HR' },
  inventory_management: { label: 'Inventory Management', description: 'Products, stock levels & purchase orders', category: 'Operations' },
  customer_portal: { label: 'Customer Portal', description: 'Self-service portal for customers', category: 'Booking' },
  mobile_app: { label: 'Mobile App', description: 'Customer mobile app access', category: 'Booking' },
};

const CATEGORIES = ['All', 'Booking', 'AI', 'Marketing', 'CRM', 'Operations', 'HR'];

export default function FeatureTogglesPage() {
  const [search, setSearch] = useState('');
  const [selectedSalonId, setSelectedSalonId] = useState<string>('');
  const [category, setCategory] = useState('All');
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [dirty, setDirty] = useState(false);
  const [success, setSuccess] = useState(false);

  const { data: salonsData } = useListAdminSalonsQuery({ page: 1, page_size: 100 });
  const salons = salonsData?.items ?? [];

  const { data: flagData, isLoading } = useGetFeatureFlagsQuery(Number(selectedSalonId), {
    skip: !selectedSalonId,
  });
  const [updateFlags, { isLoading: saving }] = useUpdateFeatureFlagsMutation();

  useEffect(() => {
    if (flagData?.feature_flags) {
      setFlags(flagData.feature_flags);
      setDirty(false);
    }
  }, [flagData]);

  const handleToggle = (key: string, value: boolean) => {
    setFlags((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
    setSuccess(false);
  };

  const handleSave = async () => {
    if (!selectedSalonId) return;
    await updateFlags({ salonId: Number(selectedSalonId), body: { feature_flags: flags } }).unwrap();
    setDirty(false);
    setSuccess(true);
    setTimeout(() => setSuccess(false), 3000);
  };

  const filteredKeys = Object.keys(FEATURE_META).filter((k) => {
    const meta = FEATURE_META[k];
    const matchSearch = meta.label.toLowerCase().includes(search.toLowerCase()) || meta.description.toLowerCase().includes(search.toLowerCase());
    const matchCategory = category === 'All' || meta.category === category;
    return matchSearch && matchCategory;
  });

  const grouped: Record<string, string[]> = {};
  filteredKeys.forEach((k) => {
    const cat = FEATURE_META[k].category;
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(k);
  });

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Feature Toggles</Typography>
          <Typography variant="body2" color="text.secondary">Enable or disable features per salon</Typography>
        </Box>
        {dirty && (
          <Button
            variant="contained" startIcon={<Save />} onClick={handleSave} disabled={saving}
            sx={{ bgcolor: '#E94560', '&:hover': { bgcolor: '#c73652' } }}
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </Button>
        )}
      </Box>

      {success && <Alert severity="success" sx={{ mb: 2 }}>Feature flags saved successfully!</Alert>}

      {/* Salon selector */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="subtitle2" fontWeight={600} mb={1.5}>Select Salon</Typography>
          <FormControl fullWidth size="small">
            <InputLabel>Choose a salon to configure</InputLabel>
            <Select
              value={selectedSalonId}
              label="Choose a salon to configure"
              onChange={(e) => { setSelectedSalonId(e.target.value); setDirty(false); }}
            >
              {salons.map((s: any) => (
                <MenuItem key={s.salon_id} value={s.salon_id}>
                  {s.salon_name}
                  <Chip label={s.subscription_status} size="small" sx={{ ml: 1 }} color={s.subscription_status === 'Active' ? 'success' : 'default'} />
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </CardContent>
      </Card>

      {!selectedSalonId && (
        <Card sx={{ p: 6, textAlign: 'center' }}>
          <Typography color="text.secondary">Select a salon above to manage its feature flags.</Typography>
        </Card>
      )}

      {selectedSalonId && isLoading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
      )}

      {selectedSalonId && !isLoading && (
        <>
          {/* Filters */}
          <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
            <TextField
              size="small" placeholder="Search features…" value={search} onChange={(e) => setSearch(e.target.value)}
              InputProps={{ startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment> }}
              sx={{ minWidth: 220 }}
            />
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {CATEGORIES.map((c) => (
                <Chip key={c} label={c} size="small" onClick={() => setCategory(c)}
                  sx={{ cursor: 'pointer', bgcolor: category === c ? '#E94560' : 'transparent', color: category === c ? '#fff' : 'text.secondary', border: '1px solid', borderColor: category === c ? '#E94560' : 'divider' }}
                />
              ))}
            </Box>
          </Box>

          {Object.entries(grouped).map(([cat, keys]) => (
            <Card key={cat} sx={{ mb: 2 }}>
              <CardContent>
                <Typography variant="subtitle1" fontWeight={700} color="text.secondary" mb={1.5}>{cat}</Typography>
                <Grid container spacing={0}>
                  {keys.map((key, idx) => {
                    const meta = FEATURE_META[key];
                    const enabled = flags[key] ?? true;
                    return (
                      <Grid item xs={12} key={key}>
                        {idx > 0 && <Divider sx={{ my: 1 }} />}
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 0.5 }}>
                          <Box>
                            <Typography variant="body1" fontWeight={600}>{meta.label}</Typography>
                            <Typography variant="body2" color="text.secondary">{meta.description}</Typography>
                          </Box>
                          <Switch
                            checked={enabled}
                            onChange={(e) => handleToggle(key, e.target.checked)}
                            sx={{
                              '& .MuiSwitch-switchBase.Mui-checked': { color: '#E94560' },
                              '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: '#E94560' },
                            }}
                          />
                        </Box>
                      </Grid>
                    );
                  })}
                </Grid>
              </CardContent>
            </Card>
          ))}
        </>
      )}
    </Box>
  );
}
