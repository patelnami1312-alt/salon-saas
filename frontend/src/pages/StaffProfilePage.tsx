import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, CircularProgress, Typography, Button, Grid, Card, CardContent,
  TextField, MenuItem, Select, FormControl, InputLabel, Divider,
  Checkbox, FormControlLabel, Alert, Chip, Paper, InputAdornment,
} from '@mui/material';
import {
  ArrowBack, Person, Email, Phone, Work, AttachMoney,
  ContentCut, CheckCircle, Badge, CalendarMonth,
} from '@mui/icons-material';
import { useGetStaffMemberQuery, useCreateStaffMutation, useUpdateStaffMutation, useGetServicesQuery, useGetBranchesQuery } from '@/features/api/apiSlice';
import { useAppSelector } from '@/app/hooks';
import toast from 'react-hot-toast';
import { v, hasNoErrors } from '@/utils/formValidation';

// ── NEW STAFF FORM ────────────────────────────────────────────────────────────
function AddStaffForm() {
  const navigate = useNavigate();
  const branchId = useAppSelector((s) => s.dashboard.selectedBranchId);

  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    branch_id: branchId ?? '',
    job_title: '',
    gender: '',
    experience: 0,
    salary: 0,
    commission_percent: 0,
    joining_date: new Date().toISOString().split('T')[0],
    skills: '',
    service_ids: [] as number[],
  });

  const [created, setCreated] = useState<{ temp_password: string; staff_code: string } | null>(null);
  const [createStaff, { isLoading, error }] = useCreateStaffMutation();
  const { data: services = [] } = useGetServicesQuery({});
  const { data: branches = [] } = useGetBranchesQuery();

  const EMPTY_ERRS = { first_name: '', last_name: '', email: '', branch_id: '' };
  const [fieldErrors, setFieldErrors] = useState(EMPTY_ERRS);
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const validateStaff = (f: typeof form) => ({
    first_name: v.required(f.first_name as string, 'First name') || v.minLen(f.first_name as string, 2, 'First name'),
    last_name: v.required(f.last_name as string, 'Last name') || v.minLen(f.last_name as string, 2, 'Last name'),
    email: v.required(f.email as string, 'Email') || v.email(f.email as string),
    branch_id: !f.branch_id ? 'Please select a branch.' : '',
  });

  const blur = (field: string) => {
    setTouched((p) => ({ ...p, [field]: true }));
    setFieldErrors(validateStaff(form));
  };

  const set = (k: string) => (e: any) => {
    const next = { ...form, [k]: e.target.value };
    setForm(next as any);
    if (touched[k]) setFieldErrors(validateStaff(next as any));
  };

  const toggleService = (id: number) => {
    setForm((p) => ({
      ...p,
      service_ids: p.service_ids.includes(id)
        ? p.service_ids.filter((s) => s !== id)
        : [...p.service_ids, id],
    }));
  };

  const handleSubmit = async () => {
    const allTouched = Object.keys(EMPTY_ERRS).reduce((a, k) => ({ ...a, [k]: true }), {} as Record<string, boolean>);
    setTouched(allTouched);
    const errs = validateStaff(form);
    setFieldErrors(errs);
    if (!hasNoErrors(errs)) return;
    try {
      const res = await createStaff({
        ...form,
        branch_id: Number(form.branch_id),
        experience: Number(form.experience),
        salary: Number(form.salary),
        commission_percent: Number(form.commission_percent),
        service_ids: form.service_ids.length ? form.service_ids : undefined,
        joining_date: form.joining_date || undefined,
        skills: form.skills || undefined,
        gender: form.gender || undefined,
        job_title: form.job_title || undefined,
      } as any).unwrap();
      setCreated({ temp_password: (res as any).temp_password, staff_code: (res as any).staff_code });
    } catch (err: any) {
      toast.error(err?.data?.detail ?? 'Failed to create staff member');
    }
  };

  // ── Success screen after creation ─────────────────────────────────────────
  if (created) {
    return (
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
          <Button startIcon={<ArrowBack />} onClick={() => navigate('/staff')} variant="outlined" size="small">
            Back to Staff
          </Button>
        </Box>

        <Paper
          sx={{
            maxWidth: 500, mx: 'auto', p: 4, borderRadius: 3, textAlign: 'center',
            border: '1.5px solid #4CAF5040',
          }}
        >
          <Box sx={{ width: 64, height: 64, bgcolor: '#E8F5E9', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 2 }}>
            <CheckCircle sx={{ fontSize: 36, color: '#4CAF50' }} />
          </Box>
          <Typography variant="h5" fontWeight={800} mb={0.5}>Staff Member Created!</Typography>
          <Typography color="text.secondary" mb={3}>
            Share these login details with <strong>{form.first_name} {form.last_name}</strong>
          </Typography>

          <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2, mb: 3, textAlign: 'left', bgcolor: '#F8F5FF' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1.5 }}>
              <Typography variant="caption" color="text.secondary" fontWeight={600}>STAFF CODE</Typography>
              <Typography fontWeight={700} color="primary">{created.staff_code}</Typography>
            </Box>
            <Divider sx={{ mb: 1.5 }} />
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="caption" color="text.secondary" fontWeight={600}>LOGIN EMAIL</Typography>
              <Typography fontWeight={600}>{form.email}</Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="caption" color="text.secondary" fontWeight={600}>TEMP PASSWORD</Typography>
              <Typography fontWeight={700} sx={{ fontFamily: 'monospace', bgcolor: '#EDE7F6', px: 1, borderRadius: 1, color: '#6C3FC5' }}>
                {created.temp_password}
              </Typography>
            </Box>
          </Paper>

          <Alert severity="warning" sx={{ mb: 3, borderRadius: 2, textAlign: 'left' }}>
            Copy the temporary password now — it won't be shown again.
          </Alert>

          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
            <Button variant="outlined" onClick={() => navigate('/staff')}>View All Staff</Button>
            <Button variant="contained" onClick={() => { setCreated(null); setForm({ first_name: '', last_name: '', email: '', phone: '', branch_id: branchId ?? '', job_title: '', gender: '', experience: 0, salary: 0, commission_percent: 0, joining_date: new Date().toISOString().split('T')[0], skills: '', service_ids: [] }); }}>
              Add Another
            </Button>
          </Box>
        </Paper>
      </Box>
    );
  }

  // ── Form ──────────────────────────────────────────────────────────────────
  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
        <Button startIcon={<ArrowBack />} onClick={() => navigate('/staff')} variant="outlined" size="small">
          Back
        </Button>
        <Box>
          <Typography variant="h5" fontWeight={700}>Add Staff Member</Typography>
          <Typography variant="body2" color="text.secondary">
            A login account is automatically created with a temporary password
          </Typography>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
          {(error as any)?.data?.detail ?? 'Failed to create staff member'}
        </Alert>
      )}

      <Grid container spacing={3}>

        {/* ── Left column ── */}
        <Grid item xs={12} md={7}>

          {/* Personal info */}
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <Person sx={{ color: 'primary.main', fontSize: 20 }} />
                <Typography fontWeight={700}>Personal Information</Typography>
              </Box>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField label="First Name *" fullWidth value={form.first_name} onChange={set('first_name')}
                    onBlur={() => blur('first_name')}
                    error={touched.first_name && !!fieldErrors.first_name}
                    helperText={touched.first_name ? fieldErrors.first_name : ''}
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }} />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField label="Last Name *" fullWidth value={form.last_name} onChange={set('last_name')}
                    onBlur={() => blur('last_name')}
                    error={touched.last_name && !!fieldErrors.last_name}
                    helperText={touched.last_name ? fieldErrors.last_name : ''}
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }} />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField label="Email *" fullWidth value={form.email} onChange={set('email')} type="email"
                    onBlur={() => blur('email')}
                    error={touched.email && !!fieldErrors.email}
                    helperText={touched.email ? fieldErrors.email : ''}
                    InputProps={{ startAdornment: <InputAdornment position="start"><Email sx={{ fontSize: 18, color: 'text.secondary' }} /></InputAdornment> }}
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }} />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField label="Phone" fullWidth value={form.phone} onChange={set('phone')}
                    InputProps={{ startAdornment: <InputAdornment position="start"><Phone sx={{ fontSize: 18, color: 'text.secondary' }} /></InputAdornment> }}
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }} />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}>
                    <InputLabel>Gender</InputLabel>
                    <Select value={form.gender} label="Gender" onChange={set('gender')}>
                      <MenuItem value="">Prefer not to say</MenuItem>
                      <MenuItem value="Male">Male</MenuItem>
                      <MenuItem value="Female">Female</MenuItem>
                      <MenuItem value="Other">Other</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField label="Joining Date" type="date" fullWidth value={form.joining_date} onChange={set('joining_date')}
                    InputLabelProps={{ shrink: true }}
                    InputProps={{ startAdornment: <InputAdornment position="start"><CalendarMonth sx={{ fontSize: 18, color: 'text.secondary' }} /></InputAdornment> }}
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }} />
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {/* Job info */}
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <Work sx={{ color: 'primary.main', fontSize: 20 }} />
                <Typography fontWeight={700}>Job Details</Typography>
              </Box>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth error={touched.branch_id && !!fieldErrors.branch_id} sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}>
                    <InputLabel>Branch *</InputLabel>
                    <Select value={form.branch_id} label="Branch *"
                      onChange={set('branch_id')}
                      onBlur={() => blur('branch_id')}>
                      {branches.map((b: any) => (
                        <MenuItem key={b.branch_id} value={b.branch_id}>{b.branch_name}</MenuItem>
                      ))}
                    </Select>
                    {touched.branch_id && fieldErrors.branch_id && (
                      <Typography variant="caption" color="error" sx={{ ml: 1.5, mt: 0.5 }}>{fieldErrors.branch_id}</Typography>
                    )}
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField label="Job Title" fullWidth value={form.job_title} onChange={set('job_title')}
                    placeholder="e.g. Senior Stylist"
                    InputProps={{ startAdornment: <InputAdornment position="start"><Badge sx={{ fontSize: 18, color: 'text.secondary' }} /></InputAdornment> }}
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }} />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField label="Experience (years)" type="number" fullWidth value={form.experience} onChange={set('experience')}
                    inputProps={{ min: 0, max: 50 }} sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }} />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField label="Monthly Salary" type="number" fullWidth value={form.salary} onChange={set('salary')}
                    inputProps={{ min: 0 }}
                    InputProps={{ startAdornment: <InputAdornment position="start"><AttachMoney sx={{ fontSize: 18, color: 'text.secondary' }} /></InputAdornment> }}
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }} />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField label="Commission %" type="number" fullWidth value={form.commission_percent} onChange={set('commission_percent')}
                    inputProps={{ min: 0, max: 100 }}
                    InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }}
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }} />
                </Grid>
                <Grid item xs={12}>
                  <TextField label="Skills / Specialisations" fullWidth value={form.skills} onChange={set('skills')}
                    placeholder="e.g. Balayage, Nail Art, Facials"
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }} />
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* ── Right column – services ── */}
        <Grid item xs={12} md={5}>
          <Card sx={{ position: { md: 'sticky' }, top: { md: 80 } }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <ContentCut sx={{ color: 'primary.main', fontSize: 20 }} />
                <Typography fontWeight={700}>Services Offered</Typography>
              </Box>
              <Typography variant="caption" color="text.secondary" display="block" mb={2}>
                Select which services this staff member can perform
              </Typography>

              {form.service_ids.length > 0 && (
                <Box sx={{ mb: 2, display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                  {form.service_ids.map((id) => {
                    const svc = services.find((s: any) => s.service_id === id);
                    return svc ? (
                      <Chip key={id} label={svc.service_name} size="small" color="primary" variant="outlined"
                        onDelete={() => toggleService(id)} />
                    ) : null;
                  })}
                </Box>
              )}

              <Divider sx={{ mb: 1.5 }} />

              <Box sx={{ maxHeight: 380, overflowY: 'auto', pr: 0.5 }}>
                {services.map((svc: any) => (
                  <FormControlLabel
                    key={svc.service_id}
                    control={
                      <Checkbox
                        size="small"
                        checked={form.service_ids.includes(svc.service_id)}
                        onChange={() => toggleService(svc.service_id)}
                      />
                    }
                    label={
                      <Box>
                        <Typography variant="body2" fontWeight={500}>{svc.service_name}</Typography>
                        <Typography variant="caption" color="text.secondary">{svc.duration}min · ${svc.price}</Typography>
                      </Box>
                    }
                    sx={{ display: 'flex', alignItems: 'flex-start', mb: 0.5, mx: 0 }}
                  />
                ))}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Submit */}
        <Grid item xs={12}>
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
            <Button variant="outlined" size="large" onClick={() => navigate('/staff')} sx={{ borderRadius: 2, px: 4 }}>
              Cancel
            </Button>
            <Button
              variant="contained" size="large" onClick={handleSubmit} disabled={isLoading}
              sx={{ borderRadius: 2, px: 5, fontWeight: 700 }}
            >
              {isLoading ? 'Creating…' : 'Create Staff Member'}
            </Button>
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
}

// ── EXISTING STAFF PROFILE (view + edit) ─────────────────────────────────────
function StaffProfile({ staffId }: { staffId: number }) {
  const navigate = useNavigate();
  const { data: staff, isLoading, refetch } = useGetStaffMemberQuery(staffId);
  const [updateStaff, { isLoading: saving }] = useUpdateStaffMutation();
  const { data: services = [] } = useGetServicesQuery({});
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState<any>(null);

  const startEdit = () => {
    if (!staff) return;
    setForm({
      first_name: (staff as any).first_name ?? '',
      last_name: (staff as any).last_name ?? '',
      phone: (staff as any).phone ?? '',
      job_title: (staff as any).job_title ?? '',
      skills: (staff as any).skills ?? '',
      experience: String((staff as any).experience ?? 0),
      salary: String((staff as any).salary ?? 0),
      commission_percent: String((staff as any).commission_percent ?? 0),
      gender: (staff as any).gender ?? '',
      service_ids: (staff as any).service_ids ?? [],
    });
    setEditMode(true);
  };

  const handleSave = async () => {
    if (!form) return;
    try {
      await updateStaff({
        id: staffId,
        data: {
          first_name: form.first_name, last_name: form.last_name,
          phone: form.phone || undefined, job_title: form.job_title || undefined,
          skills: form.skills || undefined, experience: Number(form.experience),
          salary: Number(form.salary), commission_percent: Number(form.commission_percent),
          gender: form.gender || undefined, service_ids: form.service_ids,
        },
      }).unwrap();
      toast.success('Staff profile updated');
      setEditMode(false);
      refetch();
    } catch (e: any) {
      toast.error(e?.data?.detail ?? 'Failed to update staff');
    }
  };

  const toggleSvc = (id: number) => setForm((p: any) => ({
    ...p,
    service_ids: p.service_ids.includes(id)
      ? p.service_ids.filter((s: number) => s !== id)
      : [...p.service_ids, id],
  }));

  if (isLoading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', p: 8 }}><CircularProgress /></Box>;
  }

  if (!staff) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography color="text.secondary" mb={2}>Staff member not found.</Typography>
        <Button startIcon={<ArrowBack />} onClick={() => navigate('/staff')}>Back to Staff</Button>
      </Box>
    );
  }

  const s = staff as any;

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Button startIcon={<ArrowBack />} onClick={() => navigate('/staff')} variant="outlined" size="small">
            Back
          </Button>
          <Box>
            <Typography variant="h5" fontWeight={700}>{s.full_name}</Typography>
            <Typography color="text.secondary" variant="body2">{s.job_title || 'Staff Member'} · {s.staff_code}</Typography>
          </Box>
        </Box>
        {!editMode ? (
          <Button variant="contained" onClick={startEdit}>Edit Profile</Button>
        ) : (
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button variant="outlined" onClick={() => setEditMode(false)}>Cancel</Button>
            <Button variant="contained" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save Changes'}
            </Button>
          </Box>
        )}
      </Box>

      {editMode && form ? (
        <Grid container spacing={3}>
          <Grid item xs={12} md={7}>
            <Card sx={{ mb: 2 }}>
              <CardContent>
                <Typography fontWeight={700} mb={2}>Personal Information</Typography>
                <Grid container spacing={2}>
                  <Grid item xs={6}><TextField label="First Name *" fullWidth value={form.first_name} onChange={(e) => setForm((p: any) => ({ ...p, first_name: e.target.value }))} /></Grid>
                  <Grid item xs={6}><TextField label="Last Name *" fullWidth value={form.last_name} onChange={(e) => setForm((p: any) => ({ ...p, last_name: e.target.value }))} /></Grid>
                  <Grid item xs={6}><TextField label="Phone" fullWidth value={form.phone} onChange={(e) => setForm((p: any) => ({ ...p, phone: e.target.value }))} /></Grid>
                  <Grid item xs={6}>
                    <FormControl fullWidth><InputLabel>Gender</InputLabel>
                      <Select value={form.gender} label="Gender" onChange={(e) => setForm((p: any) => ({ ...p, gender: e.target.value }))}>
                        <MenuItem value="">Prefer not to say</MenuItem>
                        <MenuItem value="Male">Male</MenuItem>
                        <MenuItem value="Female">Female</MenuItem>
                        <MenuItem value="Other">Other</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                <Typography fontWeight={700} mb={2}>Job Details</Typography>
                <Grid container spacing={2}>
                  <Grid item xs={6}><TextField label="Job Title" fullWidth value={form.job_title} onChange={(e) => setForm((p: any) => ({ ...p, job_title: e.target.value }))} /></Grid>
                  <Grid item xs={6}><TextField label="Experience (yrs)" type="number" fullWidth value={form.experience} onChange={(e) => setForm((p: any) => ({ ...p, experience: e.target.value }))} /></Grid>
                  <Grid item xs={6}><TextField label="Salary" type="number" fullWidth value={form.salary} onChange={(e) => setForm((p: any) => ({ ...p, salary: e.target.value }))} InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }} /></Grid>
                  <Grid item xs={6}><TextField label="Commission %" type="number" fullWidth value={form.commission_percent} onChange={(e) => setForm((p: any) => ({ ...p, commission_percent: e.target.value }))} InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }} /></Grid>
                  <Grid item xs={12}><TextField label="Skills" fullWidth value={form.skills} onChange={(e) => setForm((p: any) => ({ ...p, skills: e.target.value }))} placeholder="e.g. Balayage, Nail Art" /></Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={5}>
            <Card sx={{ position: { md: 'sticky' }, top: { md: 80 } }}>
              <CardContent>
                <Typography fontWeight={700} mb={1}>Services Offered</Typography>
                <Box sx={{ maxHeight: 400, overflowY: 'auto' }}>
                  {(services as any[]).map((svc: any) => (
                    <FormControlLabel key={svc.service_id}
                      control={<Checkbox size="small" checked={form.service_ids.includes(svc.service_id)} onChange={() => toggleSvc(svc.service_id)} />}
                      label={<Typography variant="body2">{svc.service_name}</Typography>}
                      sx={{ display: 'flex', mx: 0, mb: 0.5 }}
                    />
                  ))}
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      ) : (
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography fontWeight={700} mb={2}>Profile</Typography>
                {[
                  { label: 'Email', value: s.email },
                  { label: 'Phone', value: s.phone || '—' },
                  { label: 'Gender', value: s.gender || '—' },
                  { label: 'Experience', value: s.experience ? `${s.experience} years` : '—' },
                  { label: 'Salary', value: s.salary ? `$${s.salary}` : '—' },
                  { label: 'Commission', value: `${s.commission_percent}%` },
                  { label: 'Skills', value: s.skills || '—' },
                ].map(({ label, value }) => (
                  <Box key={label} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.75, borderBottom: '1px solid #F3F4F6' }}>
                    <Typography variant="body2" color="text.secondary">{label}</Typography>
                    <Typography variant="body2" fontWeight={600}>{value}</Typography>
                  </Box>
                ))}
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography fontWeight={700} mb={2}>Services ({(s.service_ids ?? []).length})</Typography>
                {(s.service_ids ?? []).length === 0 ? (
                  <Typography variant="body2" color="text.secondary">No services assigned</Typography>
                ) : (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                    {(s.service_ids ?? []).map((id: number) => {
                      const svc = (services as any[]).find((sv: any) => sv.service_id === id);
                      return svc ? <Chip key={id} label={svc.service_name} size="small" color="primary" variant="outlined" /> : null;
                    })}
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}
    </Box>
  );
}

// ── MAIN EXPORT ───────────────────────────────────────────────────────────────
export default function StaffProfilePage() {
  const { id } = useParams<{ id: string }>();
  const staffId = id && id !== 'new' ? parseInt(id, 10) : null;

  if (id === 'new' || staffId === null) return <AddStaffForm />;
  if (isNaN(staffId)) return <AddStaffForm />;
  return <StaffProfile staffId={staffId} />;
}
