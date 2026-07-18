import { useState } from 'react';
import {
  Box, Grid, Card, CardContent, Typography, Button, Chip, IconButton,
  Avatar, Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  MenuItem, Select, FormControl, InputLabel, CircularProgress, Alert,
  FormHelperText, Tooltip,
} from '@mui/material';
import { Add, Edit, ContentCut, Category } from '@mui/icons-material';
import {
  useGetServicesQuery, useGetServiceCategoriesQuery,
  useCreateServiceMutation, useUpdateServiceMutation, useCreateServiceCategoryMutation,
} from '@/features/api/apiSlice';
import { useSalon } from '@/context/SalonContext';
import toast from 'react-hot-toast';
import { v, hasNoErrors, mapBackendError } from '@/utils/formValidation';
import type { Service } from '@/types';

const EMPTY_FORM = { service_name: '', category_id: '', duration: '', price: '', tax_percent: '0', gender_type: 'Unisex', description: '' };
const EMPTY_ERRORS = { service_name: '', category_id: '', duration: '', price: '', tax_percent: '' };

const CATEGORY_COLORS = ['#6C3FC5','#22C55E','#F97316','#3B82F6','#EF4444','#EC4899','#14B8A6','#F59E0B'];

function validateForm(form: typeof EMPTY_FORM) {
  return {
    service_name: v.required(form.service_name, 'Service name') || v.minLen(form.service_name, 2, 'Service name') || v.maxLen(form.service_name, 200, 'Service name'),
    category_id: v.minSelect(form.category_id, 'category'),
    duration: v.required(form.duration, 'Duration') || v.integerPositive(form.duration, 'Duration'),
    price: v.required(form.price, 'Price') || v.positiveNumber(form.price, 'Price'),
    tax_percent: v.percent(form.tax_percent, 'Tax'),
  };
}

// ── Add Category Dialog ───────────────────────────────────────────────────────
function AddCategoryDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [name, setName] = useState('');
  const [color, setColor] = useState(CATEGORY_COLORS[0]);
  const [nameError, setNameError] = useState('');
  const [createCategory, { isLoading }] = useCreateServiceCategoryMutation();

  const handleClose = () => {
    setName(''); setColor(CATEGORY_COLORS[0]); setNameError('');
    onClose();
  };

  const handleSubmit = async () => {
    const err = v.required(name, 'Category name') || v.minLen(name, 2, 'Category name');
    if (err) { setNameError(err); return; }
    try {
      await createCategory({ category_name: name.trim(), color_code: color }).unwrap();
      toast.success('Category created');
      handleClose();
    } catch (e: any) {
      setNameError(e?.data?.detail ?? 'Failed to create category');
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle sx={{ fontWeight: 700 }}>Add Category</DialogTitle>
      <DialogContent sx={{ pt: 1 }}>
        <TextField
          label="Category Name *" fullWidth autoFocus
          value={name} onChange={(e) => { setName(e.target.value); if (nameError) setNameError(''); }}
          error={!!nameError} helperText={nameError}
          sx={{ mb: 2.5, mt: 0.5 }}
        />
        <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ mb: 1, display: 'block' }}>
          COLOR
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {CATEGORY_COLORS.map((c) => (
            <Box
              key={c}
              onClick={() => setColor(c)}
              sx={{
                width: 32, height: 32, borderRadius: '50%', bgcolor: c,
                cursor: 'pointer', border: color === c ? '3px solid #1F2937' : '3px solid transparent',
                boxShadow: color === c ? `0 0 0 2px white, 0 0 0 4px ${c}` : 'none',
                transition: 'all .15s',
              }}
            />
          ))}
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSubmit} disabled={isLoading}>
          {isLoading ? 'Creating…' : 'Create Category'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ServicesPage() {
  const { formatCurrency, settings } = useSalon();
  const [categoryFilter, setCategoryFilter] = useState<number | ''>('');
  const [addOpen, setAddOpen] = useState(false);
  const [addCatOpen, setAddCatOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState(EMPTY_ERRORS);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitError, setSubmitError] = useState('');

  const { data: categories } = useGetServiceCategoriesQuery();
  const { data: services, isLoading } = useGetServicesQuery({ category_id: categoryFilter || undefined });
  const [createService, { isLoading: creating }] = useCreateServiceMutation();
  const [updateService, { isLoading: updating }] = useUpdateServiceMutation();

  const handleBlur = (field: string) => {
    setTouched((p) => ({ ...p, [field]: true }));
    setFieldErrors(validateForm(form));
  };

  const handleChange = (field: keyof typeof EMPTY_FORM, value: string) => {
    const next = { ...form, [field]: value };
    setForm(next);
    if (touched[field]) setFieldErrors(validateForm(next));
  };

  const handleClose = () => {
    setAddOpen(false);
    setEditingService(null);
    setForm(EMPTY_FORM);
    setFieldErrors(EMPTY_ERRORS);
    setTouched({});
    setSubmitError('');
  };

  const openEdit = (service: Service) => {
    setEditingService(service);
    setForm({
      service_name: service.service_name,
      category_id: String(service.category_id),
      duration: String(service.duration),
      price: String(service.price),
      tax_percent: String(service.tax_percent),
      gender_type: service.gender_type,
      description: service.description ?? '',
    });
    setFieldErrors(EMPTY_ERRORS);
    setTouched({});
    setSubmitError('');
    setAddOpen(true);
  };

  const handleCreate = async () => {
    const allTouched = Object.keys(EMPTY_ERRORS).reduce((a, k) => ({ ...a, [k]: true }), {} as Record<string, boolean>);
    setTouched(allTouched);
    const errs = validateForm(form);
    setFieldErrors(errs);
    if (!hasNoErrors(errs)) return;
    setSubmitError('');
    const payload = {
      service_name: form.service_name.trim(),
      category_id: parseInt(form.category_id),
      duration: parseInt(form.duration),
      price: parseFloat(form.price),
      tax_percent: parseFloat(form.tax_percent),
      gender_type: form.gender_type,
      description: form.description,
    };
    try {
      if (editingService) {
        await updateService({ id: editingService.service_id, data: payload }).unwrap();
        toast.success('Service updated successfully');
      } else {
        await createService(payload).unwrap();
        toast.success('Service created successfully');
      }
      handleClose();
    } catch (err: unknown) {
      const { fieldErrors: be, general } = mapBackendError(err, {
        service_name: 'service_name',
        'already exists': 'service_name',
        category: 'category_id',
        duration: 'duration',
        price: 'price',
        tax: 'tax_percent',
      });
      setFieldErrors((p) => ({ ...p, ...be }));
      setSubmitError(general);
    }
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Services</Typography>
          <Typography variant="body2" color="text.secondary">{services?.length ?? 0} services</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="outlined" startIcon={<Category />} onClick={() => setAddCatOpen(true)}>
            Add Category
          </Button>
          <Button variant="contained" startIcon={<Add />} onClick={() => setAddOpen(true)}>
            Add Service
          </Button>
        </Box>
      </Box>

      {/* Category Filter Chips */}
      <Box sx={{
        display: 'flex', gap: 1, flexWrap: 'wrap', mb: 3,
        p: 1.5, bgcolor: '#F8F7FF', borderRadius: 2, border: '1px solid #EDE7FF',
      }}>
        <Chip
          label="All Services"
          onClick={() => setCategoryFilter('')}
          color={categoryFilter === '' ? 'primary' : 'default'}
          sx={{ fontWeight: 600 }}
        />
        {categories?.map((c) => (
          <Chip
            key={c.category_id}
            label={c.category_name}
            onClick={() => setCategoryFilter(c.category_id)}
            color={categoryFilter === c.category_id ? 'primary' : 'default'}
            variant={categoryFilter === c.category_id ? 'filled' : 'outlined'}
            sx={{ fontWeight: 600 }}
          />
        ))}
        <Tooltip title="Add new category">
          <Chip
            icon={<Add sx={{ fontSize: 14 }} />}
            label="New Category"
            onClick={() => setAddCatOpen(true)}
            variant="outlined"
            sx={{
              fontWeight: 600, borderStyle: 'dashed', color: 'text.secondary',
              '&:hover': { borderColor: 'primary.main', color: 'primary.main', bgcolor: '#F5F0FF' },
            }}
          />
        </Tooltip>
      </Box>

      {/* Services Grid */}
      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}><CircularProgress /></Box>
      ) : services?.length === 0 ? (
        <Box sx={{
          textAlign: 'center', py: 10, border: '2px dashed #E5E7EB',
          borderRadius: 3, color: 'text.secondary',
        }}>
          <ContentCut sx={{ fontSize: 48, mb: 2, opacity: 0.3 }} />
          <Typography variant="h6" fontWeight={600} mb={1}>No services yet</Typography>
          <Typography variant="body2" mb={3}>Add your first service to get started</Typography>
          <Button variant="contained" startIcon={<Add />} onClick={() => setAddOpen(true)}>
            Add Service
          </Button>
        </Box>
      ) : (
        <Grid container spacing={2}>
          {services?.map((service) => (
            <Grid item xs={12} sm={6} lg={4} xl={3} key={service.service_id}>
              <Card sx={{
                position: 'relative', height: '100%',
                border: '1px solid #F0EBFF',
                '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 8px 24px rgba(108,63,197,.12)', borderColor: '#C4AEFF' },
                transition: '0.2s all',
              }}>
                <CardContent sx={{ p: 2.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1.5 }}>
                    <Avatar sx={{
                      bgcolor: service.color_code || '#6C3FC5',
                      width: 42, height: 42,
                      boxShadow: `0 4px 12px ${service.color_code || '#6C3FC5'}40`,
                    }}>
                      <ContentCut sx={{ fontSize: 18 }} />
                    </Avatar>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Chip
                        label={service.gender_type}
                        size="small"
                        variant="outlined"
                        sx={{ fontSize: 10, height: 20, fontWeight: 600 }}
                      />
                      <IconButton size="small" sx={{ '&:hover': { color: 'primary.main' } }} onClick={() => openEdit(service)}>
                        <Edit sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Box>
                  </Box>

                  <Typography variant="subtitle1" fontWeight={700} mb={0.25}>{service.service_name}</Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ mb: 1.5, display: 'block', minHeight: 20 }}>
                    {service.description || 'No description'}
                  </Typography>

                  <Box sx={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    pt: 1.5, borderTop: '1px solid #F3F4F6',
                  }}>
                    <Box>
                      <Typography variant="h6" fontWeight={800} color="primary.main" sx={{ lineHeight: 1 }}>
                        {formatCurrency(service.price)}
                      </Typography>
                      {service.tax_percent > 0 && (
                        <Typography variant="caption" color="text.secondary">+{service.tax_percent}% tax</Typography>
                      )}
                    </Box>
                    <Chip
                      label={`${service.duration} min`}
                      size="small"
                      sx={{ bgcolor: '#F5F0FF', color: '#6C3FC5', fontWeight: 700, fontSize: 11 }}
                    />
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Add Category Dialog */}
      <AddCategoryDialog open={addCatOpen} onClose={() => setAddCatOpen(false)} />

      {/* Add Service Dialog */}
      <Dialog open={addOpen} onClose={handleClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 700 }}>{editingService ? 'Edit Service' : 'Add New Service'}</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          {submitError && <Alert severity="error" sx={{ mt: 1, mb: 1 }}>{submitError}</Alert>}
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12}>
              <TextField
                label="Service Name *" fullWidth
                value={form.service_name}
                onChange={(e) => handleChange('service_name', e.target.value)}
                onBlur={() => handleBlur('service_name')}
                error={touched.service_name && !!fieldErrors.service_name}
                helperText={touched.service_name ? fieldErrors.service_name : ''}
              />
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth error={touched.category_id && !!fieldErrors.category_id}>
                <InputLabel>Category *</InputLabel>
                <Select
                  value={form.category_id}
                  onChange={(e) => handleChange('category_id', e.target.value as string)}
                  onBlur={() => handleBlur('category_id')}
                  label="Category *"
                >
                  {categories?.map((c) => <MenuItem key={c.category_id} value={c.category_id}>{c.category_name}</MenuItem>)}
                </Select>
                {touched.category_id && fieldErrors.category_id && <FormHelperText>{fieldErrors.category_id}</FormHelperText>}
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <TextField
                label="Duration (min) *" type="number" fullWidth
                value={form.duration}
                onChange={(e) => handleChange('duration', e.target.value)}
                onBlur={() => handleBlur('duration')}
                error={touched.duration && !!fieldErrors.duration}
                helperText={touched.duration ? fieldErrors.duration : ''}
                inputProps={{ min: 1, step: 5 }}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                label={`Price (${settings.currency}) *`} type="number" fullWidth
                value={form.price}
                onChange={(e) => handleChange('price', e.target.value)}
                onBlur={() => handleBlur('price')}
                error={touched.price && !!fieldErrors.price}
                helperText={touched.price ? fieldErrors.price : ''}
                inputProps={{ min: 0, step: 0.01 }}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                label="Tax %" type="number" fullWidth
                value={form.tax_percent}
                onChange={(e) => handleChange('tax_percent', e.target.value)}
                onBlur={() => handleBlur('tax_percent')}
                error={touched.tax_percent && !!fieldErrors.tax_percent}
                helperText={touched.tax_percent ? fieldErrors.tax_percent : ''}
                inputProps={{ min: 0, max: 100, step: 0.5 }}
              />
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth>
                <InputLabel>Gender Type</InputLabel>
                <Select value={form.gender_type} onChange={(e) => handleChange('gender_type', e.target.value)} label="Gender Type">
                  <MenuItem value="Unisex">Unisex</MenuItem>
                  <MenuItem value="Male">Male</MenuItem>
                  <MenuItem value="Female">Female</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Description" fullWidth multiline rows={2}
                value={form.description}
                onChange={(e) => handleChange('description', e.target.value)}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleClose}>Cancel</Button>
          <Button variant="contained" onClick={handleCreate} disabled={creating || updating}>
            {editingService ? (updating ? 'Saving…' : 'Save Changes') : (creating ? 'Creating…' : 'Create Service')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
