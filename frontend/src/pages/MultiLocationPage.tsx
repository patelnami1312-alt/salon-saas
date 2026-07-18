import { useState } from 'react';
import {
  Box, Typography, Grid, Card, CardContent, Chip, Button,
  Table, TableHead, TableRow, TableCell, TableBody, TableContainer,
  Paper, LinearProgress, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, Switch, FormControlLabel, Alert,
  IconButton, Divider,
} from '@mui/material';
import { Add, Edit, LocationOn, People, ContentCut, CheckCircle } from '@mui/icons-material';
import { useSalon } from '@/context/SalonContext';
import { useGetBranchesQuery, useCreateBranchMutation, useUpdateBranchMutation } from '@/features/api/apiSlice';
import { v, hasNoErrors, mapBackendError } from '@/utils/formValidation';

const BRANCH_EMPTY_ERRORS = { branch_name: '', email: '', phone: '', slot_duration: '', closing_time: '' };

function validateBranchForm(form: { branch_name: string; email: string; phone: string; slot_duration: string; opening_time: string; closing_time: string }) {
  const closingErr = form.opening_time && form.closing_time && form.closing_time <= form.opening_time
    ? 'Closing time must be after opening time.'
    : '';
  return {
    branch_name: v.required(form.branch_name, 'Branch name') || v.minLen(form.branch_name, 2, 'Branch name') || v.maxLen(form.branch_name, 200, 'Branch name'),
    email: v.email(form.email),
    phone: v.phone(form.phone),
    slot_duration: v.range(form.slot_duration, 5, 240, 'Slot duration'),
    closing_time: closingErr,
  };
}

function BranchDialog({ open, onClose, editBranch }: { open: boolean; onClose: () => void; editBranch?: any }) {
  const [form, setForm] = useState({
    branch_name: editBranch?.branch_name ?? '',
    branch_code: editBranch?.branch_code ?? '',
    phone: editBranch?.phone ?? '',
    email: editBranch?.email ?? '',
    address: editBranch?.address ?? '',
    city: editBranch?.city ?? '',
    state: editBranch?.state ?? '',
    postal_code: editBranch?.postal_code ?? '',
    country: editBranch?.country ?? 'US',
    opening_time: editBranch?.opening_time ?? '09:00',
    closing_time: editBranch?.closing_time ?? '20:00',
    slot_duration: String(editBranch?.slot_duration ?? 30),
    is_active: editBranch?.is_active ?? true,
  });
  const [fieldErrors, setFieldErrors] = useState(BRANCH_EMPTY_ERRORS);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitError, setSubmitError] = useState('');

  const [create, { isLoading: creating }] = useCreateBranchMutation();
  const [update, { isLoading: updating }] = useUpdateBranchMutation();
  const isLoading = creating || updating;

  const handleBlur = (field: string) => {
    setTouched((p) => ({ ...p, [field]: true }));
    setFieldErrors(validateBranchForm(form));
  };

  const handleChange = (k: keyof typeof form, val: string) => {
    const next = { ...form, [k]: val };
    setForm(next);
    const errField = k as keyof typeof BRANCH_EMPTY_ERRORS;
    if (errField in BRANCH_EMPTY_ERRORS && touched[k]) setFieldErrors(validateBranchForm(next));
  };

  const handleSubmit = async () => {
    const allTouched = Object.keys(BRANCH_EMPTY_ERRORS).reduce((a, k) => ({ ...a, [k]: true }), {} as Record<string, boolean>);
    setTouched(allTouched);
    const errs = validateBranchForm(form);
    setFieldErrors(errs);
    if (!hasNoErrors(errs)) return;
    setSubmitError('');
    const payload = { ...form, slot_duration: Number(form.slot_duration) };
    try {
      if (editBranch) {
        await update({ id: editBranch.branch_id, data: payload }).unwrap();
      } else {
        await create(payload).unwrap();
      }
      onClose();
    } catch (err: unknown) {
      const { fieldErrors: be, general } = mapBackendError(err, {
        branch_name: 'branch_name',
        email: 'email',
        phone: 'phone',
        slot_duration: 'slot_duration',
      });
      setFieldErrors((p) => ({ ...p, ...be }));
      setSubmitError(general);
    }
  };

  const f = (k: keyof typeof form) => (e: any) => handleChange(k, e.target.value);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{editBranch ? 'Edit Branch' : 'Add New Branch'}</DialogTitle>
      <DialogContent>
        {submitError && <Alert severity="error" sx={{ mb: 2 }}>{submitError}</Alert>}
        <Grid container spacing={2} mt={0}>
          <Grid item xs={12} sm={8}>
            <TextField
              label="Branch Name *" fullWidth value={form.branch_name}
              onChange={f('branch_name')} onBlur={() => handleBlur('branch_name')}
              error={touched.branch_name && !!fieldErrors.branch_name}
              helperText={touched.branch_name ? fieldErrors.branch_name : ''}
            />
          </Grid>
          <Grid item xs={12} sm={4}><TextField label="Branch Code" fullWidth value={form.branch_code} onChange={f('branch_code')} /></Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Phone" fullWidth value={form.phone}
              onChange={f('phone')} onBlur={() => handleBlur('phone')}
              error={touched.phone && !!fieldErrors.phone}
              helperText={touched.phone ? fieldErrors.phone : ''}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Email" fullWidth value={form.email}
              onChange={f('email')} onBlur={() => handleBlur('email')}
              error={touched.email && !!fieldErrors.email}
              helperText={touched.email ? fieldErrors.email : ''}
            />
          </Grid>
          <Grid item xs={12}><TextField label="Address" fullWidth value={form.address} onChange={f('address')} /></Grid>
          <Grid item xs={12} sm={4}><TextField label="City" fullWidth value={form.city} onChange={f('city')} /></Grid>
          <Grid item xs={12} sm={4}><TextField label="State" fullWidth value={form.state} onChange={f('state')} /></Grid>
          <Grid item xs={12} sm={4}><TextField label="Postal Code" fullWidth value={form.postal_code} onChange={f('postal_code')} /></Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Opening Time" type="time" fullWidth value={form.opening_time}
              onChange={f('opening_time')} onBlur={() => handleBlur('closing_time')}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Closing Time" type="time" fullWidth value={form.closing_time}
              onChange={f('closing_time')} onBlur={() => handleBlur('closing_time')}
              InputLabelProps={{ shrink: true }}
              error={touched.closing_time && !!fieldErrors.closing_time}
              helperText={touched.closing_time ? fieldErrors.closing_time : ''}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Slot Duration (min)" type="number" fullWidth value={form.slot_duration}
              onChange={f('slot_duration')} onBlur={() => handleBlur('slot_duration')}
              error={touched.slot_duration && !!fieldErrors.slot_duration}
              helperText={touched.slot_duration ? fieldErrors.slot_duration : ''}
              inputProps={{ min: 5, max: 240, step: 5 }}
            />
          </Grid>
          <Grid item xs={12}>
            <FormControlLabel
              control={<Switch checked={form.is_active} onChange={(e) => setForm((p) => ({ ...p, is_active: e.target.checked }))} />}
              label="Branch Active"
            />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSubmit} variant="contained" disabled={isLoading}>
          {isLoading ? 'Saving…' : (editBranch ? 'Update Branch' : 'Add Branch')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

const BRANCH_COLORS = ['#6C3FC5', '#2196F3', '#4CAF50', '#FF9800', '#E91E63', '#009688'];

export default function MultiLocationPage() {
  const { formatCurrency } = useSalon();
  const [addOpen, setAddOpen] = useState(false);
  const [editBranch, setEditBranch] = useState<any | null>(null);
  const [selectedBranch, setSelectedBranch] = useState<number | null>(null);

  const { data: branches, isLoading } = useGetBranchesQuery();
  const branchList = Array.isArray(branches) ? branches : [];

  // Mock per-branch metrics (in production would come from a branch stats API)
  const mockMetrics: Record<number, { revenue: number; appointments: number; customers: number; utilization: number }> = {};
  branchList.forEach((b: any, i: number) => {
    mockMetrics[b.branch_id] = {
      revenue: 8000 + i * 3200,
      appointments: 120 + i * 45,
      customers: 300 + i * 90,
      utilization: 65 + i * 8,
    };
  });

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Multi-Location Management</Typography>
          <Typography variant="body2" color="text.secondary">
            {branchList.length} {branchList.length === 1 ? 'location' : 'locations'} · Compare performance across all branches
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<Add />} onClick={() => setAddOpen(true)}>
          Add Location
        </Button>
      </Box>

      {isLoading ? (
        <Typography color="text.secondary">Loading branches…</Typography>
      ) : (
        <>
          {/* Branch cards */}
          <Grid container spacing={2.5} mb={3}>
            {branchList.map((branch: any, idx: number) => {
              const color = BRANCH_COLORS[idx % BRANCH_COLORS.length];
              const metrics = mockMetrics[branch.branch_id] ?? { revenue: 0, appointments: 0, customers: 0, utilization: 0 };
              const isSelected = selectedBranch === branch.branch_id;
              return (
                <Grid item xs={12} sm={6} lg={4} key={branch.branch_id}>
                  <Card
                    onClick={() => setSelectedBranch(isSelected ? null : branch.branch_id)}
                    sx={{
                      cursor: 'pointer',
                      border: `2px solid ${isSelected ? color : 'transparent'}`,
                      transition: 'border-color 0.2s',
                      '&:hover': { border: `2px solid ${color}60` },
                    }}
                  >
                    <CardContent sx={{ p: 2.5 }}>
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1.5 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: color }} />
                          <Typography fontWeight={700}>{branch.branch_name}</Typography>
                        </Box>
                        <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                          <Chip
                            label={branch.is_active ? 'Active' : 'Inactive'}
                            size="small"
                            color={branch.is_active ? 'success' : 'default'}
                          />
                          <IconButton size="small" onClick={(e) => { e.stopPropagation(); setEditBranch(branch); }}>
                            <Edit fontSize="small" />
                          </IconButton>
                        </Box>
                      </Box>

                      {(branch.city || branch.address) && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1.5 }}>
                          <LocationOn sx={{ fontSize: 14, color: 'text.disabled' }} />
                          <Typography variant="caption" color="text.secondary">
                            {[branch.address, branch.city, branch.state].filter(Boolean).join(', ')}
                          </Typography>
                        </Box>
                      )}

                      <Grid container spacing={1}>
                        {[
                          { label: 'Revenue', value: formatCurrency(metrics.revenue), color },
                          { label: 'Appts', value: metrics.appointments, color: '#2196F3' },
                          { label: 'Customers', value: metrics.customers, color: '#4CAF50' },
                        ].map((m) => (
                          <Grid item xs={4} key={m.label}>
                            <Box sx={{ textAlign: 'center', p: 0.75, bgcolor: '#F4F6F9', borderRadius: 1 }}>
                              <Typography variant="body2" fontWeight={700} sx={{ color: m.color }}>{m.value}</Typography>
                              <Typography variant="caption" color="text.secondary" fontSize={10}>{m.label}</Typography>
                            </Box>
                          </Grid>
                        ))}
                      </Grid>

                      <Box sx={{ mt: 1.5 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                          <Typography variant="caption" color="text.secondary">Chair utilization</Typography>
                          <Typography variant="caption" fontWeight={600}>{metrics.utilization}%</Typography>
                        </Box>
                        <LinearProgress
                          variant="determinate" value={metrics.utilization}
                          sx={{ height: 6, borderRadius: 3, bgcolor: `${color}20`, '& .MuiLinearProgress-bar': { bgcolor: color, borderRadius: 3 } }}
                        />
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              );
            })}

            {branchList.length === 0 && (
              <Grid item xs={12}>
                <Card sx={{ p: 8, textAlign: 'center' }}>
                  <LocationOn sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
                  <Typography variant="h6" color="text.secondary">No branches yet</Typography>
                  <Typography variant="body2" color="text.disabled" mb={3}>
                    Add your first location to start managing multiple branches
                  </Typography>
                  <Button variant="contained" startIcon={<Add />} onClick={() => setAddOpen(true)}>
                    Add First Location
                  </Button>
                </Card>
              </Grid>
            )}
          </Grid>

          {/* Comparison Table */}
          {branchList.length > 1 && (
            <Card>
              <CardContent sx={{ p: 2.5 }}>
                <Typography variant="h6" fontWeight={600} mb={2}>Performance Comparison</Typography>
                <TableContainer component={Paper} variant="outlined">
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Branch</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell align="right">Revenue</TableCell>
                        <TableCell align="right">Appointments</TableCell>
                        <TableCell align="right">Customers</TableCell>
                        <TableCell align="right">Utilization</TableCell>
                        <TableCell>Hours</TableCell>
                        <TableCell>Slot</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {branchList.map((branch: any, idx: number) => {
                        const color = BRANCH_COLORS[idx % BRANCH_COLORS.length];
                        const metrics = mockMetrics[branch.branch_id] ?? { revenue: 0, appointments: 0, customers: 0, utilization: 0 };
                        return (
                          <TableRow key={branch.branch_id} hover>
                            <TableCell>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: color }} />
                                <Typography fontWeight={600}>{branch.branch_name}</Typography>
                              </Box>
                            </TableCell>
                            <TableCell>
                              <Chip label={branch.is_active ? 'Active' : 'Inactive'} size="small" color={branch.is_active ? 'success' : 'default'} />
                            </TableCell>
                            <TableCell align="right"><Typography fontWeight={600}>{formatCurrency(metrics.revenue)}</Typography></TableCell>
                            <TableCell align="right">{metrics.appointments}</TableCell>
                            <TableCell align="right">{metrics.customers}</TableCell>
                            <TableCell align="right">
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, justifyContent: 'flex-end' }}>
                                <LinearProgress
                                  variant="determinate" value={metrics.utilization}
                                  sx={{ width: 60, height: 6, borderRadius: 3, bgcolor: `${color}20`, '& .MuiLinearProgress-bar': { bgcolor: color } }}
                                />
                                <Typography variant="body2">{metrics.utilization}%</Typography>
                              </Box>
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2" color="text.secondary">
                                {branch.opening_time?.slice(0, 5) ?? '—'} – {branch.closing_time?.slice(0, 5) ?? '—'}
                              </Typography>
                            </TableCell>
                            <TableCell>{branch.slot_duration}min</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          )}
        </>
      )}

      <BranchDialog open={addOpen} onClose={() => setAddOpen(false)} />
      {editBranch && <BranchDialog open={!!editBranch} onClose={() => setEditBranch(null)} editBranch={editBranch} />}
    </Box>
  );
}
