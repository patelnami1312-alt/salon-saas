import { useState } from 'react';
import {
  Box, Typography, Grid, Card, CardContent, Button, TextField, Dialog,
  DialogTitle, DialogContent, DialogActions, Switch, FormControlLabel,
  Chip, Alert, IconButton, Divider, MenuItem, Select, FormControl, InputLabel,
} from '@mui/material';
import { Add, Edit, Check } from '@mui/icons-material';
import { useListAdminPlansQuery, useCreateAdminPlanMutation, useUpdateAdminPlanMutation } from '@/features/api/adminApiSlice';

const FEATURES_LIST = [
  'Online Booking', 'AI Receptionist', 'Marketing Campaigns',
  'Loyalty Program', 'Gift Cards', 'Multi-Location', 'Payroll',
  'Inventory Management', 'Customer Portal', 'Mobile App',
];

const PLAN_COLORS = ['#E94560', '#6C3FC5', '#2196F3', '#4CAF50'];

interface PlanFormData {
  plan_name: string;
  price: string;
  billing_cycle: string;
  max_branches: string;
  max_staff: string;
  max_customers: string;
  features: string[];
  is_active: boolean;
}

function PlanDialog({ open, onClose, editPlan }: { open: boolean; onClose: () => void; editPlan?: any }) {
  const [form, setForm] = useState<PlanFormData>({
    plan_name: editPlan?.plan_name ?? '',
    price: String(editPlan?.price ?? ''),
    billing_cycle: editPlan?.billing_cycle ?? 'Monthly',
    max_branches: String(editPlan?.max_branches ?? 1),
    max_staff: String(editPlan?.max_staff ?? 10),
    max_customers: String(editPlan?.max_customers ?? 1000),
    features: editPlan?.features ? editPlan.features.split(',').map((f: string) => f.trim()) : [],
    is_active: editPlan?.is_active ?? true,
  });

  const [create, { isLoading: creating, error: createErr }] = useCreateAdminPlanMutation();
  const [update, { isLoading: updating, error: updateErr }] = useUpdateAdminPlanMutation();

  const isLoading = creating || updating;
  const error = createErr || updateErr;

  const toggleFeature = (f: string) => {
    setForm((prev) => ({
      ...prev,
      features: prev.features.includes(f) ? prev.features.filter((x) => x !== f) : [...prev.features, f],
    }));
  };

  const handleSubmit = async () => {
    const payload = {
      ...form,
      price: Number(form.price),
      max_branches: Number(form.max_branches),
      max_staff: Number(form.max_staff),
      max_customers: Number(form.max_customers),
      features: form.features.join(', '),
    };
    try {
      if (editPlan) {
        await update({ planId: editPlan.plan_id, body: payload }).unwrap();
      } else {
        await create(payload).unwrap();
      }
      onClose();
    } catch {
      // error is already surfaced via createErr/updateErr above; dialog stays open
    }
  };

  const f = (k: keyof PlanFormData) => (e: any) => setForm((prev) => ({ ...prev, [k]: e.target.value }));

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{editPlan ? 'Edit Plan' : 'Create Subscription Plan'}</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }}>Failed to save plan</Alert>}
        <Grid container spacing={2} mt={0}>
          <Grid item xs={12}><TextField label="Plan Name *" fullWidth value={form.plan_name} onChange={f('plan_name')} /></Grid>
          <Grid item xs={12} sm={6}><TextField label="Price *" type="number" fullWidth value={form.price} onChange={f('price')} InputProps={{ startAdornment: <Typography sx={{ mr: 0.5, color: 'text.secondary' }}>$</Typography> }} /></Grid>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth>
              <InputLabel>Billing Cycle</InputLabel>
              <Select value={form.billing_cycle} label="Billing Cycle" onChange={f('billing_cycle')}>
                <MenuItem value="Monthly">Monthly</MenuItem>
                <MenuItem value="Yearly">Yearly</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={4}><TextField label="Max Branches" type="number" fullWidth value={form.max_branches} onChange={f('max_branches')} /></Grid>
          <Grid item xs={12} sm={4}><TextField label="Max Staff" type="number" fullWidth value={form.max_staff} onChange={f('max_staff')} /></Grid>
          <Grid item xs={12} sm={4}><TextField label="Max Customers" type="number" fullWidth value={form.max_customers} onChange={f('max_customers')} /></Grid>
          <Grid item xs={12}>
            <Typography variant="subtitle2" fontWeight={600} mb={1}>Features Included</Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {FEATURES_LIST.map((feat) => {
                const selected = form.features.includes(feat);
                return (
                  <Chip
                    key={feat}
                    label={feat}
                    size="small"
                    icon={selected ? <Check fontSize="small" /> : undefined}
                    onClick={() => toggleFeature(feat)}
                    sx={{
                      bgcolor: selected ? '#E94560' : 'transparent',
                      color: selected ? '#fff' : 'text.secondary',
                      border: '1px solid',
                      borderColor: selected ? '#E94560' : 'divider',
                      cursor: 'pointer',
                    }}
                  />
                );
              })}
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
        <Button onClick={handleSubmit} variant="contained" disabled={isLoading || !form.plan_name || !form.price}
          sx={{ bgcolor: '#E94560', '&:hover': { bgcolor: '#c73652' } }}>
          {isLoading ? 'Saving…' : (editPlan ? 'Update Plan' : 'Create Plan')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default function SubscriptionPlansPage() {
  const { data: plans, isLoading } = useListAdminPlansQuery();
  const [createOpen, setCreateOpen] = useState(false);
  const [editPlan, setEditPlan] = useState<any | null>(null);

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Subscription Plans</Typography>
          <Typography variant="body2" color="text.secondary">Manage SaaS pricing tiers</Typography>
        </Box>
        <Button variant="contained" startIcon={<Add />} onClick={() => setCreateOpen(true)}
          sx={{ bgcolor: '#E94560', '&:hover': { bgcolor: '#c73652' } }}>
          New Plan
        </Button>
      </Box>

      {isLoading ? (
        <Typography color="text.secondary">Loading plans…</Typography>
      ) : (
        <Grid container spacing={3}>
          {(plans ?? []).map((plan: any, idx: number) => {
            const color = PLAN_COLORS[idx % PLAN_COLORS.length];
            const features = plan.features ? plan.features.split(',').map((f: string) => f.trim()).filter(Boolean) : [];
            return (
              <Grid item xs={12} sm={6} lg={4} key={plan.plan_id}>
                <Card sx={{ height: '100%', border: `2px solid ${color}20`, position: 'relative', overflow: 'visible' }}>
                  <Box sx={{ position: 'absolute', top: -1, right: -1, display: 'flex', gap: 0.5 }}>
                    {!plan.is_active && <Chip label="Inactive" size="small" color="default" />}
                    <IconButton size="small" onClick={() => setEditPlan(plan)} sx={{ bgcolor: 'white', border: '1px solid', borderColor: 'divider' }}>
                      <Edit fontSize="small" />
                    </IconButton>
                  </Box>
                  <CardContent sx={{ p: 3 }}>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 2 }}>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="h6" fontWeight={700}>{plan.plan_name}</Typography>
                        <Typography variant="body2" color="text.secondary">{plan.billing_cycle}</Typography>
                      </Box>
                      <Box sx={{ textAlign: 'right' }}>
                        <Typography variant="h4" fontWeight={800} color={color}>${plan.price}</Typography>
                        <Typography variant="caption" color="text.secondary">/{plan.billing_cycle === 'Monthly' ? 'mo' : 'yr'}</Typography>
                      </Box>
                    </Box>
                    <Divider sx={{ mb: 2 }} />
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
                      <Chip label={`${plan.max_branches} Branch${plan.max_branches > 1 ? 'es' : ''}`} size="small" variant="outlined" />
                      <Chip label={`${plan.max_staff} Staff`} size="small" variant="outlined" />
                      <Chip label={`${plan.max_customers.toLocaleString()} Customers`} size="small" variant="outlined" />
                    </Box>
                    {features.length > 0 && (
                      <Box>
                        <Typography variant="caption" color="text.secondary" fontWeight={600}>INCLUDES</Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                          {features.map((f: string) => (
                            <Chip key={f} label={f} size="small" icon={<Check sx={{ fontSize: '14px !important' }} />}
                              sx={{ bgcolor: `${color}15`, color, fontSize: 11 }} />
                          ))}
                        </Box>
                      </Box>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
          {(plans ?? []).length === 0 && !isLoading && (
            <Grid item xs={12}>
              <Card sx={{ p: 6, textAlign: 'center' }}>
                <Typography color="text.secondary">No plans yet. Create your first subscription plan.</Typography>
              </Card>
            </Grid>
          )}
        </Grid>
      )}

      <PlanDialog open={createOpen} onClose={() => setCreateOpen(false)} />
      {editPlan && <PlanDialog open={!!editPlan} onClose={() => setEditPlan(null)} editPlan={editPlan} />}
    </Box>
  );
}
