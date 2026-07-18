import { useState } from 'react';
import {
  Box, Typography, Grid, Card, CardContent, Button, TextField,
  Dialog, DialogTitle, DialogContent, DialogActions, Chip,
  Alert, IconButton, Divider, InputAdornment, Switch,
  FormControlLabel, Autocomplete, Avatar,
} from '@mui/material';
import { v, hasNoErrors } from '@/utils/formValidation';
import { Add, Edit, Delete, ShoppingCart, Percent, Timer } from '@mui/icons-material';
import { useSalon } from '@/context/SalonContext';
import {
  useListPackagesQuery,
  useCreatePackageMutation,
  useUpdatePackageMutation,
  useDeletePackageMutation,
  useListServicesQuery,
} from '@/features/api/apiSlice';

interface PackageService {
  service_id: number;
  service_name?: string;
  quantity: number;
  price?: number;
  duration?: number;
}

const PKG_EMPTY_ERRORS = { package_name: '', package_price: '', validity_days: '', services: '' };

function validatePkgForm(form: { package_name: string; package_price: string; validity_days: string; services: PackageService[] }) {
  return {
    package_name: v.required(form.package_name, 'Package name') || v.minLen(form.package_name, 2, 'Package name') || v.maxLen(form.package_name, 200, 'Package name'),
    package_price: v.required(form.package_price, 'Package price') || v.positiveNumber(form.package_price, 'Package price'),
    validity_days: v.integerPositive(form.validity_days, 'Validity days'),
    services: form.services.length === 0 ? 'Add at least one service to the package.' : '',
  };
}

function PackageDialog({ open, onClose, editPkg }: { open: boolean; onClose: () => void; editPkg?: any }) {
  const { formatCurrency } = useSalon();
  const [form, setForm] = useState({
    package_name: editPkg?.package_name ?? '',
    description: editPkg?.description ?? '',
    package_price: String(editPkg?.package_price ?? ''),
    validity_days: String(editPkg?.validity_days ?? 30),
    is_active: editPkg?.is_active ?? true,
    services: (editPkg?.services ?? []) as PackageService[],
  });
  const [fieldErrors, setFieldErrors] = useState(PKG_EMPTY_ERRORS);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [serviceSearch, setServiceSearch] = useState('');

  const { data: servicesData } = useListServicesQuery();
  const serviceOptions = (servicesData ?? []).filter((s) =>
    s.service_name.toLowerCase().includes(serviceSearch.toLowerCase())
  );

  const [create, { isLoading: creating }] = useCreatePackageMutation();
  const [update, { isLoading: updating }] = useUpdatePackageMutation();
  const isLoading = creating || updating;

  const originalPrice = form.services.reduce((sum, s) => sum + (s.price ?? 0) * s.quantity, 0);
  const discountPct = originalPrice > 0 && Number(form.package_price) > 0
    ? Math.round((1 - Number(form.package_price) / originalPrice) * 100)
    : 0;

  const handleBlur = (field: string) => {
    setTouched((p) => ({ ...p, [field]: true }));
    setFieldErrors(validatePkgForm(form));
  };

  const handleChange = (k: 'package_name' | 'description' | 'package_price' | 'validity_days', val: string) => {
    const next = { ...form, [k]: val };
    setForm(next);
    if (touched[k]) setFieldErrors(validatePkgForm(next));
  };

  const addService = (svc: any) => {
    if (!svc || form.services.find((s) => s.service_id === svc.service_id)) return;
    const next = { ...form, services: [...form.services, { service_id: svc.service_id, service_name: svc.service_name, quantity: 1, price: svc.price, duration: svc.duration }] };
    setForm(next);
    setServiceSearch('');
    if (touched.services) setFieldErrors(validatePkgForm(next));
  };

  const removeService = (id: number) => {
    const next = { ...form, services: form.services.filter((s) => s.service_id !== id) };
    setForm(next);
    if (touched.services) setFieldErrors(validatePkgForm(next));
  };

  const updateQty = (id: number, qty: number) => {
    setForm((prev) => ({
      ...prev,
      services: prev.services.map((s) => s.service_id === id ? { ...s, quantity: qty } : s),
    }));
  };

  const handleSubmit = async () => {
    const allTouched = Object.keys(PKG_EMPTY_ERRORS).reduce((a, k) => ({ ...a, [k]: true }), {} as Record<string, boolean>);
    setTouched(allTouched);
    const errs = validatePkgForm(form);
    setFieldErrors(errs);
    if (!hasNoErrors(errs)) return;
    const payload = {
      package_name: form.package_name.trim(),
      description: form.description,
      package_price: Number(form.package_price),
      validity_days: Number(form.validity_days),
      is_active: form.is_active,
      services: form.services.map((s) => ({ service_id: s.service_id, quantity: s.quantity })),
    };
    try {
      if (editPkg) {
        await update({ id: editPkg.package_id, data: payload }).unwrap();
      } else {
        await create(payload).unwrap();
      }
      onClose();
    } catch (err: unknown) {
      const detail = (err as any)?.data?.detail;
      if (typeof detail === 'string') setFieldErrors((p) => ({ ...p, package_name: detail }));
    }
  };

  const f = (k: 'package_name' | 'description' | 'package_price' | 'validity_days') => (e: any) => handleChange(k, e.target.value);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{editPkg ? 'Edit Package' : 'Create Service Package'}</DialogTitle>
      <DialogContent>
        <Grid container spacing={2} mt={0}>
          <Grid item xs={12}>
            <TextField
              label="Package Name *" fullWidth value={form.package_name}
              onChange={f('package_name')} onBlur={() => handleBlur('package_name')}
              error={touched.package_name && !!fieldErrors.package_name}
              helperText={touched.package_name ? fieldErrors.package_name : ''}
            />
          </Grid>
          <Grid item xs={12}><TextField label="Description" fullWidth multiline rows={2} value={form.description} onChange={f('description')} /></Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Package Price *" type="number" fullWidth value={form.package_price}
              onChange={f('package_price')} onBlur={() => handleBlur('package_price')}
              error={touched.package_price && !!fieldErrors.package_price}
              helperText={(touched.package_price && fieldErrors.package_price) || (originalPrice > 0 ? `Original: ${formatCurrency(originalPrice)} · ${discountPct}% off` : '')}
              InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
              inputProps={{ min: 0.01, step: 0.01 }}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Validity (days) *" type="number" fullWidth value={form.validity_days}
              onChange={f('validity_days')} onBlur={() => handleBlur('validity_days')}
              error={touched.validity_days && !!fieldErrors.validity_days}
              helperText={touched.validity_days ? fieldErrors.validity_days : ''}
              inputProps={{ min: 1, step: 1 }}
            />
          </Grid>

          <Grid item xs={12}>
            <Typography variant="subtitle2" fontWeight={600} mb={1}>Services in Package</Typography>
            <Autocomplete
              options={serviceOptions}
              getOptionLabel={(o: any) => `${o.service_name} — ${formatCurrency(o.price)}`}
              onChange={(_, v) => addService(v)}
              inputValue={serviceSearch}
              onInputChange={(_, v) => setServiceSearch(v)}
              renderInput={(params) => <TextField {...params} label="Add service…" size="small" />}
              noOptionsText="No services found"
              filterOptions={(x) => x}
              value={null}
            />

            {touched.services && fieldErrors.services && (
              <Alert severity="error" sx={{ mt: 1 }}>{fieldErrors.services}</Alert>
            )}
            <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
              {form.services.map((s) => (
                <Box key={s.service_id} sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1.5, bgcolor: '#F4F6F9', borderRadius: 2 }}>
                  <Avatar sx={{ width: 32, height: 32, bgcolor: '#6C3FC5', fontSize: 13 }}>
                    {s.service_name?.[0]}
                  </Avatar>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body2" fontWeight={600}>{s.service_name}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {s.duration}min · {formatCurrency(s.price ?? 0)} each
                    </Typography>
                  </Box>
                  <TextField
                    type="number" size="small" label="Qty" value={s.quantity}
                    onChange={(e) => updateQty(s.service_id, Number(e.target.value))}
                    sx={{ width: 70 }} inputProps={{ min: 1 }}
                  />
                  <IconButton size="small" color="error" onClick={() => removeService(s.service_id)}>
                    <Delete fontSize="small" />
                  </IconButton>
                </Box>
              ))}
              {form.services.length === 0 && (
                <Typography variant="body2" color="text.disabled" sx={{ textAlign: 'center', py: 2 }}>
                  No services added yet
                </Typography>
              )}
            </Box>
          </Grid>

          <Grid item xs={12}>
            <FormControlLabel
              control={<Switch checked={form.is_active} onChange={(e) => setForm((p) => ({ ...p, is_active: e.target.checked }))} />}
              label="Active"
            />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSubmit} variant="contained" disabled={isLoading}>
          {isLoading ? 'Saving…' : (editPkg ? 'Update Package' : 'Create Package')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default function PackagesPage() {
  const { formatCurrency } = useSalon();
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editPkg, setEditPkg] = useState<any | null>(null);

  const { data, isLoading } = useListPackagesQuery({ search });
  const [deletePkg] = useDeletePackageMutation();

  const packages = data?.items ?? [];

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Service Packages</Typography>
          <Typography variant="body2" color="text.secondary">
            Bundle services at a discounted price · {data?.total ?? 0} packages
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<Add />} onClick={() => setCreateOpen(true)}>
          New Package
        </Button>
      </Box>

      <TextField
        size="small" placeholder="Search packages…" value={search} onChange={(e) => setSearch(e.target.value)}
        InputProps={{ startAdornment: <InputAdornment position="start"><ShoppingCart fontSize="small" /></InputAdornment> }}
        sx={{ mb: 3, maxWidth: 300 }}
      />

      {isLoading ? (
        <Typography color="text.secondary">Loading packages…</Typography>
      ) : (
        <Grid container spacing={3}>
          {packages.map((pkg: any) => (
            <Grid item xs={12} sm={6} lg={4} key={pkg.package_id}>
              <Card sx={{ height: '100%', border: pkg.is_active ? '1px solid #e0e0e0' : '1px dashed #ccc', opacity: pkg.is_active ? 1 : 0.7 }}>
                <CardContent sx={{ p: 3 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="h6" fontWeight={700} sx={{ lineHeight: 1.3 }}>{pkg.package_name}</Typography>
                      {!pkg.is_active && <Chip label="Inactive" size="small" color="default" sx={{ mt: 0.5 }} />}
                    </Box>
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      <IconButton size="small" onClick={() => setEditPkg(pkg)}><Edit fontSize="small" /></IconButton>
                      <IconButton size="small" color="error" onClick={() => deletePkg(pkg.package_id)}><Delete fontSize="small" /></IconButton>
                    </Box>
                  </Box>

                  {pkg.description && (
                    <Typography variant="body2" color="text.secondary" mb={1.5}>{pkg.description}</Typography>
                  )}

                  {/* Pricing */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                    <Typography variant="h5" fontWeight={800} color="primary.main">
                      {formatCurrency(pkg.package_price)}
                    </Typography>
                    {pkg.discount_pct > 0 && (
                      <>
                        <Typography variant="body2" sx={{ textDecoration: 'line-through', color: 'text.disabled' }}>
                          {formatCurrency(pkg.original_price)}
                        </Typography>
                        <Chip
                          label={`${pkg.discount_pct}% off`}
                          size="small"
                          icon={<Percent sx={{ fontSize: '12px !important' }} />}
                          sx={{ bgcolor: '#4CAF5020', color: '#4CAF50', fontWeight: 700, fontSize: 11 }}
                        />
                      </>
                    )}
                  </Box>

                  <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                    <Chip label={`Valid ${pkg.validity_days}d`} size="small" variant="outlined" icon={<Timer sx={{ fontSize: '14px !important' }} />} />
                    <Chip label={`${pkg.services?.length ?? 0} services`} size="small" variant="outlined" />
                  </Box>

                  <Divider sx={{ mb: 1.5 }} />

                  <Typography variant="caption" color="text.secondary" fontWeight={600}>INCLUDES</Typography>
                  <Box sx={{ mt: 0.5, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                    {(pkg.services ?? []).map((s: any) => (
                      <Box key={s.service_id} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="body2">
                          {s.quantity > 1 ? `${s.quantity}×` : ''} {s.service_name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">{s.duration}min</Typography>
                      </Box>
                    ))}
                    {(pkg.services ?? []).length === 0 && (
                      <Typography variant="caption" color="text.disabled">No services configured</Typography>
                    )}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}

          {packages.length === 0 && !isLoading && (
            <Grid item xs={12}>
              <Card sx={{ p: 8, textAlign: 'center' }}>
                <ShoppingCart sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
                <Typography variant="h6" color="text.secondary">No packages yet</Typography>
                <Typography variant="body2" color="text.disabled" mb={3}>
                  Create bundles like "Bridal Package" or "Spa Day" to increase average order value
                </Typography>
                <Button variant="contained" startIcon={<Add />} onClick={() => setCreateOpen(true)}>
                  Create First Package
                </Button>
              </Card>
            </Grid>
          )}
        </Grid>
      )}

      <PackageDialog open={createOpen} onClose={() => setCreateOpen(false)} />
      {editPkg && <PackageDialog open={!!editPkg} onClose={() => setEditPkg(null)} editPkg={editPkg} />}
    </Box>
  );
}
