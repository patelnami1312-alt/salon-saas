import { useState } from 'react';
import {
  Box, Typography, Paper, Grid, Card, CardContent, CardActions, Button,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem,
  Chip, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  CircularProgress, Alert, IconButton, Divider, Tab, Tabs,
} from '@mui/material';
import { v, hasNoErrors } from '@/utils/formValidation';
import toast from 'react-hot-toast';
import { Add, Edit, Delete, StarBorder, PersonAdd } from '@mui/icons-material';
import {
  useGetMembershipPlansQuery, useCreateMembershipPlanMutation,
  useUpdateMembershipPlanMutation, useDeleteMembershipPlanMutation,
  useGetCustomerMembershipsQuery, useAssignMembershipMutation,
  useGetCustomersQuery,
} from '@/features/api/apiSlice';
import { useSalon } from '@/context/SalonContext';
import type { MembershipPlan } from '@/types';

function PlanForm({ plan, onClose }: { plan?: MembershipPlan; onClose: () => void }) {
  const [form, setForm] = useState({
    plan_name: plan?.plan_name ?? '',
    description: plan?.description ?? '',
    price: String(plan?.price ?? ''),
    duration_days: String(plan?.duration_days ?? 30),
    discount_percent: String(plan?.discount_percent ?? 0),
    loyalty_bonus: String(plan?.loyalty_bonus ?? 0),
    benefits: plan?.benefits ?? '',
  });
  const [fieldErrors, setFieldErrors] = useState({ plan_name: '', price: '', duration_days: '', discount_percent: '' });
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const [create] = useCreateMembershipPlanMutation();
  const [update] = useUpdateMembershipPlanMutation();
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const validatePlan = (f: typeof form) => ({
    plan_name: v.required(f.plan_name, 'Plan name') || v.minLen(f.plan_name, 2, 'Plan name'),
    price: v.required(f.price, 'Price') || v.nonNegative(f.price, 'Price'),
    duration_days: v.integerPositive(f.duration_days, 'Duration'),
    discount_percent: f.discount_percent ? v.percent(f.discount_percent, 'Discount') : '',
  });

  const handleBlur = (field: string) => {
    setTouched((p) => ({ ...p, [field]: true }));
    setFieldErrors(validatePlan(form));
  };
  const handleChange = (field: keyof typeof form, value: string) => {
    const next = { ...form, [field]: value };
    setForm(next);
    if (touched[field]) setFieldErrors(validatePlan(next));
  };

  const handleSubmit = async () => {
    const allTouched = Object.keys(fieldErrors).reduce((a, k) => ({ ...a, [k]: true }), {} as Record<string, boolean>);
    setTouched(allTouched);
    const errs = validatePlan(form);
    setFieldErrors(errs);
    if (!hasNoErrors(errs)) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      const payload = {
        plan_name: form.plan_name.trim(),
        description: form.description,
        price: Number(form.price),
        duration_days: Number(form.duration_days),
        discount_percent: Number(form.discount_percent) || 0,
        loyalty_bonus: Number(form.loyalty_bonus) || 0,
        benefits: form.benefits,
      };
      if (plan) {
        await update({ id: plan.plan_id, data: payload }).unwrap();
        toast.success('Plan updated');
      } else {
        await create(payload).unwrap();
        toast.success('Plan created');
      }
      onClose();
    } catch (e: any) {
      setSubmitError(e?.data?.detail ?? 'Failed to save plan. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
        {submitError && <Alert severity="error">{submitError}</Alert>}
        <TextField
          label="Plan Name *" value={form.plan_name} fullWidth
          onChange={(e) => handleChange('plan_name', e.target.value)}
          onBlur={() => handleBlur('plan_name')}
          error={touched.plan_name && !!fieldErrors.plan_name}
          helperText={touched.plan_name ? fieldErrors.plan_name : ''}
        />
        <TextField label="Description" value={form.description} onChange={(e) => handleChange('description', e.target.value)} fullWidth multiline rows={2} />
        <Grid container spacing={2}>
          <Grid item xs={6}>
            <TextField
              label="Price *" type="number" value={form.price} fullWidth
              onChange={(e) => handleChange('price', e.target.value)}
              onBlur={() => handleBlur('price')}
              error={touched.price && !!fieldErrors.price}
              helperText={touched.price ? fieldErrors.price : ''}
              inputProps={{ min: 0, step: 0.01 }}
            />
          </Grid>
          <Grid item xs={6}>
            <TextField
              label="Duration (days) *" type="number" value={form.duration_days} fullWidth
              onChange={(e) => handleChange('duration_days', e.target.value)}
              onBlur={() => handleBlur('duration_days')}
              error={touched.duration_days && !!fieldErrors.duration_days}
              helperText={touched.duration_days ? fieldErrors.duration_days : ''}
              inputProps={{ min: 1, step: 1 }}
            />
          </Grid>
          <Grid item xs={6}>
            <TextField
              label="Discount %" type="number" value={form.discount_percent} fullWidth
              onChange={(e) => handleChange('discount_percent', e.target.value)}
              onBlur={() => handleBlur('discount_percent')}
              error={touched.discount_percent && !!fieldErrors.discount_percent}
              helperText={touched.discount_percent ? fieldErrors.discount_percent : ''}
              inputProps={{ min: 0, max: 100, step: 1 }}
            />
          </Grid>
          <Grid item xs={6}>
            <TextField label="Loyalty Bonus (pts)" type="number" value={form.loyalty_bonus} onChange={(e) => handleChange('loyalty_bonus', e.target.value)} fullWidth inputProps={{ min: 0 }} />
          </Grid>
        </Grid>
        <TextField label="Benefits (comma-separated)" value={form.benefits} onChange={(e) => handleChange('benefits', e.target.value)} fullWidth />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSubmit} disabled={submitting}>
          {submitting ? <CircularProgress size={20} /> : plan ? 'Update' : 'Create'}
        </Button>
      </DialogActions>
    </>
  );
}

function AssignForm({ onClose }: { onClose: () => void }) {
  const [customerId, setCustomerId] = useState('');
  const [planId, setPlanId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [assign] = useAssignMembershipMutation();
  const { data: plansData } = useGetMembershipPlansQuery();
  const { data: customersData } = useGetCustomersQuery({ page_size: 100 });
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState('');
  const [fieldErrors, setFieldErrors] = useState({ customer_id: '', plan_id: '' });
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const validateAssign = (cid: string, pid: string) => ({
    customer_id: v.minSelect(cid, 'customer'),
    plan_id: v.minSelect(pid, 'plan'),
  });

  const handleSubmit = async () => {
    setTouched({ customer_id: true, plan_id: true });
    const errs = validateAssign(customerId, planId);
    setFieldErrors(errs);
    if (!hasNoErrors(errs)) return;
    setSubmitting(true);
    try {
      const res = await assign({ customer_id: Number(customerId), plan_id: Number(planId), start_date: startDate || undefined }).unwrap();
      setSuccess(`Membership assigned! Expires: ${new Date(res.end_date).toLocaleDateString()}`);
    } catch (err: unknown) {
      const msg = (err as any)?.data?.detail ?? 'Failed to assign membership';
      setFieldErrors((p) => ({ ...p, plan_id: msg }));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
        {success && <Alert severity="success">{success}</Alert>}
        <TextField
          select label="Customer *" value={customerId} fullWidth
          onChange={(e) => { setCustomerId(e.target.value); if (touched.customer_id) setFieldErrors(validateAssign(e.target.value, planId)); }}
          onBlur={() => { setTouched((p) => ({ ...p, customer_id: true })); setFieldErrors(validateAssign(customerId, planId)); }}
          error={touched.customer_id && !!fieldErrors.customer_id}
          helperText={touched.customer_id ? fieldErrors.customer_id : ''}
        >
          {customersData?.items.map((c) => (
            <MenuItem key={c.customer_id} value={c.customer_id}>{c.first_name} {c.last_name} ({c.mobile})</MenuItem>
          ))}
        </TextField>
        <TextField
          select label="Plan *" value={planId} fullWidth
          onChange={(e) => { setPlanId(e.target.value); if (touched.plan_id) setFieldErrors(validateAssign(customerId, e.target.value)); }}
          onBlur={() => { setTouched((p) => ({ ...p, plan_id: true })); setFieldErrors(validateAssign(customerId, planId)); }}
          error={touched.plan_id && !!fieldErrors.plan_id}
          helperText={touched.plan_id ? fieldErrors.plan_id : ''}
        >
          {plansData?.map((p) => (
            <MenuItem key={p.plan_id} value={p.plan_id}>{p.plan_name} — ${p.price}/{p.duration_days}d</MenuItem>
          ))}
        </TextField>
        <TextField label="Start Date (optional)" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} fullWidth InputLabelProps={{ shrink: true }} />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
        <Button variant="contained" onClick={handleSubmit} disabled={submitting}>
          {submitting ? <CircularProgress size={20} /> : 'Assign'}
        </Button>
      </DialogActions>
    </>
  );
}

export default function MembershipPage() {
  const { formatCurrency } = useSalon();
  const [tab, setTab] = useState(0);
  const [showCreate, setShowCreate] = useState(false);
  const [editPlan, setEditPlan] = useState<MembershipPlan | null>(null);
  const [showAssign, setShowAssign] = useState(false);

  const { data: plans, isLoading } = useGetMembershipPlansQuery();
  const { data: memberships, isLoading: memLoading } = useGetCustomerMembershipsQuery({});
  const [deletePlan] = useDeleteMembershipPlanMutation();

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <StarBorder color="primary" />
          <Typography variant="h5" fontWeight={700}>Membership Plans</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="outlined" startIcon={<PersonAdd />} onClick={() => setShowAssign(true)}>Assign</Button>
          <Button variant="contained" startIcon={<Add />} onClick={() => setShowCreate(true)}>New Plan</Button>
        </Box>
      </Box>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Tab label="Plans" />
        <Tab label="Active Memberships" />
      </Tabs>

      {tab === 0 && (
        isLoading ? <CircularProgress /> : (
          <Grid container spacing={2}>
            {(plans ?? []).map((plan) => (
              <Grid item xs={12} sm={6} md={4} key={plan.plan_id}>
                <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <CardContent sx={{ flex: 1 }}>
                    <Typography variant="h6" fontWeight={700}>{plan.plan_name}</Typography>
                    <Typography variant="h4" color="primary" fontWeight={800} mt={1}>
                      {formatCurrency(plan.price)}
                      <Typography component="span" variant="caption" color="text.secondary"> / {plan.duration_days}d</Typography>
                    </Typography>
                    {plan.discount_percent > 0 && (
                      <Chip label={`${plan.discount_percent}% off services`} size="small" color="success" sx={{ mt: 1 }} />
                    )}
                    {plan.loyalty_bonus > 0 && (
                      <Chip label={`+${plan.loyalty_bonus} bonus pts`} size="small" color="info" sx={{ mt: 1, ml: 1 }} />
                    )}
                    {plan.description && <Typography variant="body2" color="text.secondary" mt={1}>{plan.description}</Typography>}
                    {plan.benefits && (
                      <Box mt={1.5}>
                        {plan.benefits.split(',').map((b, i) => (
                          <Typography key={i} variant="body2" sx={{ '&::before': { content: '"✓  "', color: 'success.main' } }}>{b.trim()}</Typography>
                        ))}
                      </Box>
                    )}
                  </CardContent>
                  <Divider />
                  <CardActions>
                    <IconButton size="small" onClick={() => setEditPlan(plan)}><Edit fontSize="small" /></IconButton>
                    <IconButton size="small" color="error" onClick={async () => {
                      try {
                        await deletePlan(plan.plan_id).unwrap();
                        toast.success('Plan deleted');
                      } catch {
                        toast.error('Failed to delete plan');
                      }
                    }}><Delete fontSize="small" /></IconButton>
                  </CardActions>
                </Card>
              </Grid>
            ))}
            {(plans ?? []).length === 0 && (
              <Grid item xs={12}><Alert severity="info">No membership plans yet. Create one to get started.</Alert></Grid>
            )}
          </Grid>
        )
      )}

      {tab === 1 && (
        <Paper>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Customer</TableCell>
                  <TableCell>Plan</TableCell>
                  <TableCell>Start</TableCell>
                  <TableCell>End</TableCell>
                  <TableCell>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {memLoading ? (
                  <TableRow><TableCell colSpan={5} align="center"><CircularProgress size={24} /></TableCell></TableRow>
                ) : (memberships ?? []).map((m) => (
                  <TableRow key={m.membership_id} hover>
                    <TableCell>{m.customer_name}</TableCell>
                    <TableCell>{m.plan_name}</TableCell>
                    <TableCell>{new Date(m.start_date).toLocaleDateString()}</TableCell>
                    <TableCell>{new Date(m.end_date).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Chip label={m.status} size="small" color={m.status === 'Active' ? 'success' : 'default'} />
                    </TableCell>
                  </TableRow>
                ))}
                {!memLoading && (memberships ?? []).length === 0 && (
                  <TableRow><TableCell colSpan={5} align="center" sx={{ py: 3 }}>No memberships assigned yet.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {/* Create plan dialog */}
      <Dialog open={showCreate} onClose={() => setShowCreate(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create Membership Plan</DialogTitle>
        <PlanForm onClose={() => setShowCreate(false)} />
      </Dialog>

      {/* Edit plan dialog */}
      <Dialog open={!!editPlan} onClose={() => setEditPlan(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Plan</DialogTitle>
        {editPlan && <PlanForm plan={editPlan} onClose={() => setEditPlan(null)} />}
      </Dialog>

      {/* Assign dialog */}
      <Dialog open={showAssign} onClose={() => setShowAssign(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Assign Membership</DialogTitle>
        <AssignForm onClose={() => setShowAssign(false)} />
      </Dialog>
    </Box>
  );
}
