import { useState } from 'react';
import {
  Box, Typography, Card, TextField, InputAdornment, Chip,
  FormControl, InputLabel, Select, MenuItem, Button,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Grid, Alert, Divider, Paper, IconButton, Tooltip, FormHelperText,
} from '@mui/material';
import {
  Search, Add, PersonAdd, CheckCircle, LockReset, LockOpen,
} from '@mui/icons-material';
import { DataGrid, type GridColDef } from '@mui/x-data-grid';
import {
  useListAdminUsersQuery,
  useCreatePlatformUserMutation,
  useResetUserPasswordMutation,
  useUnlockUserAccountMutation,
  useListAdminSalonsQuery,
} from '@/features/api/adminApiSlice';
import toast from 'react-hot-toast';
import { v, hasNoErrors, mapBackendError } from '@/utils/formValidation';

const ROLE_COLOR: Record<string, 'error' | 'warning' | 'info' | 'success' | 'default'> = {
  super_admin: 'error',
  salon_owner: 'warning',
  branch_manager: 'info',
  receptionist: 'success',
  staff: 'default',
};

const ROLES = [
  { code: 'salon_owner',    label: 'Salon Owner' },
  { code: 'branch_manager', label: 'Branch Manager' },
  { code: 'receptionist',   label: 'Receptionist' },
  { code: 'super_admin',    label: 'Super Admin' },
];

// ── Add User Dialog ───────────────────────────────────────────────────────────
const EMPTY_USER = { first_name: '', last_name: '', email: '', phone: '', role_code: 'salon_owner', salon_id: '' as number | '' };
const EMPTY_USER_ERRORS = { first_name: '', last_name: '', email: '', phone: '', salon_id: '' };

function validateUserForm(form: typeof EMPTY_USER) {
  const needsSalon = form.role_code !== 'super_admin';
  return {
    first_name: v.required(form.first_name as string, 'First name') || v.maxLen(form.first_name as string, 100, 'First name'),
    last_name: v.required(form.last_name as string, 'Last name') || v.maxLen(form.last_name as string, 100, 'Last name'),
    email: v.required(form.email as string, 'Email') || v.email(form.email as string),
    phone: v.phone(form.phone as string),
    salon_id: needsSalon ? v.minSelect(form.salon_id, 'salon') : '',
  };
}

function AddUserDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [form, setForm] = useState(EMPTY_USER);
  const [fieldErrors, setFieldErrors] = useState(EMPTY_USER_ERRORS);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitError, setSubmitError] = useState('');
  const [created, setCreated] = useState<{ temp_password: string; full_name: string; email: string; role: string } | null>(null);

  const [createUser, { isLoading }] = useCreatePlatformUserMutation();
  const { data: salonsData } = useListAdminSalonsQuery({ page: 1, page_size: 100 });
  const salons = salonsData?.items ?? [];

  const needsSalon = form.role_code !== 'super_admin';

  const handleBlur = (field: string) => {
    setTouched((p) => ({ ...p, [field]: true }));
    setFieldErrors(validateUserForm(form));
  };

  const handleChange = (field: keyof typeof EMPTY_USER, value: string | number) => {
    const next = { ...form, [field]: value };
    if (field === 'role_code') next.salon_id = '';
    setForm(next);
    if (touched[field]) setFieldErrors(validateUserForm(next));
  };

  const handleSubmit = async () => {
    const allTouched = Object.keys(EMPTY_USER_ERRORS).reduce((a, k) => ({ ...a, [k]: true }), {} as Record<string, boolean>);
    setTouched(allTouched);
    const errs = validateUserForm(form);
    setFieldErrors(errs);
    if (!hasNoErrors(errs)) return;
    setSubmitError('');
    try {
      const res = await createUser({
        first_name: (form.first_name as string).trim(),
        last_name: (form.last_name as string).trim(),
        email: (form.email as string).trim(),
        phone: (form.phone as string) || undefined,
        role_code: form.role_code,
        salon_id: needsSalon ? Number(form.salon_id) : undefined,
      }).unwrap();
      setCreated(res);
    } catch (err: unknown) {
      const { fieldErrors: be, general } = mapBackendError(err, {
        email: 'email',
        'already registered': 'email',
        'already exists': 'email',
        first_name: 'first_name',
        last_name: 'last_name',
        phone: 'phone',
        salon: 'salon_id',
      });
      setFieldErrors((p) => ({ ...p, ...be }));
      setSubmitError(general);
    }
  };

  const handleClose = () => {
    setForm(EMPTY_USER);
    setFieldErrors(EMPTY_USER_ERRORS);
    setTouched({});
    setSubmitError('');
    setCreated(null);
    onClose();
  };

  // ── Success screen ──────────────────────────────────────────────────────────
  if (created) {
    return (
      <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
        <DialogContent sx={{ pt: 4, pb: 3, textAlign: 'center' }}>
          <Box sx={{ width: 60, height: 60, bgcolor: '#E8F5E9', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 2 }}>
            <CheckCircle sx={{ fontSize: 32, color: '#4CAF50' }} />
          </Box>
          <Typography variant="h6" fontWeight={800} mb={0.5}>User Created!</Typography>
          <Typography variant="body2" color="text.secondary" mb={1}>
            <Chip label={created.role} size="small" color={ROLE_COLOR[form.role_code] ?? 'default'} sx={{ mr: 0.5 }} />
            account for <strong>{created.full_name}</strong>
          </Typography>
          <Typography variant="body2" color="text.secondary" mb={3}>
            Share these login details with them.
          </Typography>

          <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, textAlign: 'left', bgcolor: '#F8F5FF', mb: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="caption" color="text.secondary" fontWeight={600}>LOGIN EMAIL</Typography>
              <Typography fontWeight={600} variant="body2">{created.email}</Typography>
            </Box>
            <Divider sx={{ mb: 1 }} />
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="caption" color="text.secondary" fontWeight={600}>TEMP PASSWORD</Typography>
              <Typography fontWeight={700} sx={{ fontFamily: 'monospace', bgcolor: '#EDE7F6', px: 1.5, py: 0.5, borderRadius: 1, color: '#6C3FC5', fontSize: 15 }}>
                {created.temp_password}
              </Typography>
            </Box>
          </Paper>

          <Alert severity="warning" sx={{ borderRadius: 2, textAlign: 'left' }}>
            Copy the temporary password now — it won't be shown again.
          </Alert>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button onClick={() => { setCreated(null); setForm(EMPTY_USER); setFieldErrors(EMPTY_USER_ERRORS); setTouched({}); setSubmitError(''); }} variant="outlined">Add Another</Button>
          <Button onClick={handleClose} variant="contained">Done</Button>
        </DialogActions>
      </Dialog>
    );
  }

  // ── Form ───────────────────────────────────────────────────────────────────
  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <PersonAdd color="primary" />
        Add User
      </DialogTitle>
      <DialogContent>
        {submitError && <Alert severity="error" sx={{ mb: 2 }}>{submitError}</Alert>}
        <Typography variant="body2" color="text.secondary" mb={2}>
          A login account is created automatically with a temporary password.
        </Typography>
        <Grid container spacing={2}>
          {/* Name */}
          <Grid item xs={12} sm={6}>
            <TextField
              label="First Name *" fullWidth
              value={form.first_name}
              onChange={(e) => handleChange('first_name', e.target.value)}
              onBlur={() => handleBlur('first_name')}
              error={touched.first_name && !!fieldErrors.first_name}
              helperText={touched.first_name ? fieldErrors.first_name : ''}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Last Name *" fullWidth
              value={form.last_name}
              onChange={(e) => handleChange('last_name', e.target.value)}
              onBlur={() => handleBlur('last_name')}
              error={touched.last_name && !!fieldErrors.last_name}
              helperText={touched.last_name ? fieldErrors.last_name : ''}
            />
          </Grid>

          {/* Contact */}
          <Grid item xs={12} sm={7}>
            <TextField
              label="Email *" fullWidth type="email"
              value={form.email}
              onChange={(e) => handleChange('email', e.target.value)}
              onBlur={() => handleBlur('email')}
              error={touched.email && !!fieldErrors.email}
              helperText={touched.email ? fieldErrors.email : ''}
            />
          </Grid>
          <Grid item xs={12} sm={5}>
            <TextField
              label="Phone" fullWidth
              value={form.phone}
              onChange={(e) => handleChange('phone', e.target.value)}
              onBlur={() => handleBlur('phone')}
              error={touched.phone && !!fieldErrors.phone}
              helperText={touched.phone ? fieldErrors.phone : ''}
            />
          </Grid>

          {/* Role */}
          <Grid item xs={12} sm={needsSalon ? 5 : 12}>
            <FormControl fullWidth>
              <InputLabel>Role *</InputLabel>
              <Select
                value={form.role_code}
                label="Role *"
                onChange={(e) => handleChange('role_code', e.target.value)}
              >
                {ROLES.map((r) => (
                  <MenuItem key={r.code} value={r.code}>
                    <Chip label={r.label} size="small" color={ROLE_COLOR[r.code] ?? 'default'} sx={{ mr: 1 }} />
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {/* Salon — only for non-super-admin */}
          {needsSalon && (
            <Grid item xs={12} sm={7}>
              <FormControl fullWidth error={touched.salon_id && !!fieldErrors.salon_id}>
                <InputLabel>Salon *</InputLabel>
                <Select
                  value={form.salon_id}
                  label="Salon *"
                  onChange={(e) => handleChange('salon_id', e.target.value)}
                  onClose={() => handleBlur('salon_id')}
                >
                  {salons.map((s: any) => (
                    <MenuItem key={s.salon_id} value={s.salon_id}>{s.salon_name}</MenuItem>
                  ))}
                </Select>
                {touched.salon_id && fieldErrors.salon_id && <FormHelperText>{fieldErrors.salon_id}</FormHelperText>}
              </FormControl>
            </Grid>
          )}
        </Grid>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSubmit} disabled={isLoading} startIcon={<PersonAdd />}>
          {isLoading ? 'Creating…' : 'Create User'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Reset Password Dialog ─────────────────────────────────────────────────────
function ResetPasswordDialog({ user, open, onClose }: { user: any; open: boolean; onClose: () => void }) {
  const [result, setResult] = useState<{ temp_password: string; email: string } | null>(null);
  const [resetPassword, { isLoading }] = useResetUserPasswordMutation();

  const handleReset = async () => {
    try {
      const res = await resetPassword(user.user_id).unwrap();
      setResult(res);
    } catch {
      toast.error('Failed to reset password');
    }
  };

  const handleClose = () => {
    setResult(null);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <LockReset color="warning" />
        Reset Password
      </DialogTitle>
      <DialogContent>
        {!result ? (
          <>
            <Typography variant="body2" color="text.secondary" mb={1}>
              This will generate a new temporary password for:
            </Typography>
            <Typography fontWeight={700}>{user?.full_name}</Typography>
            <Typography variant="body2" color="text.secondary">{user?.email}</Typography>
            <Alert severity="warning" sx={{ mt: 2, borderRadius: 2 }}>
              The user's current password will be replaced immediately.
            </Alert>
          </>
        ) : (
          <>
            <Box sx={{ textAlign: 'center', mb: 2 }}>
              <CheckCircle sx={{ fontSize: 40, color: '#4CAF50', mb: 1, display: 'block', mx: 'auto' }} />
              <Typography fontWeight={700}>Password Reset!</Typography>
              <Typography variant="body2" color="text.secondary">Share this with {user?.full_name}</Typography>
            </Box>
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, bgcolor: '#F8F5FF' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="caption" color="text.secondary" fontWeight={600}>LOGIN EMAIL</Typography>
                <Typography variant="body2" fontWeight={600}>{result.email}</Typography>
              </Box>
              <Divider sx={{ mb: 1 }} />
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="caption" color="text.secondary" fontWeight={600}>TEMP PASSWORD</Typography>
                <Typography fontWeight={700} sx={{ fontFamily: 'monospace', bgcolor: '#EDE7F6', px: 1.5, py: 0.5, borderRadius: 1, color: '#6C3FC5', fontSize: 15 }}>
                  {result.temp_password}
                </Typography>
              </Box>
            </Paper>
            <Alert severity="warning" sx={{ mt: 2, borderRadius: 2 }}>
              Copy this password now — it won't be shown again.
            </Alert>
          </>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        {!result ? (
          <>
            <Button onClick={handleClose}>Cancel</Button>
            <Button variant="contained" color="warning" onClick={handleReset} disabled={isLoading}>
              {isLoading ? 'Resetting…' : 'Reset Password'}
            </Button>
          </>
        ) : (
          <Button variant="contained" onClick={handleClose} fullWidth>Done</Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function AdminUsersPage() {
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('super_admin,salon_owner');
  const [page, setPage] = useState(0);
  const [addUserOpen, setAddUserOpen] = useState(false);
  const [resetUser, setResetUser] = useState<any | null>(null);

  const { data, isLoading, refetch } = useListAdminUsersQuery({ search, role, page: page + 1, page_size: 25 });
  const [unlockUser] = useUnlockUserAccountMutation();

  const handleUnlock = async (row: any) => {
    try {
      await unlockUser(row.user_id).unwrap();
      toast.success(`${row.full_name}'s account unlocked`);
      refetch();
    } catch {
      toast.error('Failed to unlock account');
    }
  };

  const columns: GridColDef[] = [
    { field: 'full_name', headerName: 'Name', flex: 1, minWidth: 140 },
    { field: 'email', headerName: 'Email', flex: 1.5, minWidth: 180 },
    { field: 'phone', headerName: 'Phone', width: 120, valueFormatter: (value: any) => value || '—' },
    { field: 'salon_name', headerName: 'Salon', flex: 1, minWidth: 130, valueFormatter: (value: any) => value || 'Platform' },
    {
      field: 'role', headerName: 'Role', width: 140,
      renderCell: ({ row }) => (
        <Chip label={row.role || '—'} size="small" color={ROLE_COLOR[row.role_code] ?? 'default'} />
      ),
    },
    {
      field: 'is_active', headerName: 'Status', width: 90,
      renderCell: ({ value }) => (
        <Chip label={value ? 'Active' : 'Locked'} size="small" color={value ? 'success' : 'error'} />
      ),
    },
    {
      field: 'last_login_at', headerName: 'Last Login', width: 120,
      valueFormatter: (value: any) => value ? new Date(value).toLocaleDateString() : 'Never',
    },
    {
      field: 'created_at', headerName: 'Joined', width: 100,
      valueFormatter: (value: any) => value ? new Date(value).toLocaleDateString() : '—',
    },
    {
      field: 'actions', headerName: 'Actions', width: 110, sortable: false,
      renderCell: ({ row }) => (
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <Tooltip title="Reset Password">
            <IconButton size="small" color="warning" onClick={(e) => { e.stopPropagation(); setResetUser(row); }}>
              <LockReset fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title={row.is_active ? 'Account is active' : 'Unlock Account'}>
            <span>
              <IconButton
                size="small" color="success"
                onClick={(e) => { e.stopPropagation(); handleUnlock(row); }}
                disabled={row.is_active}
              >
                <LockOpen fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        </Box>
      ),
    },
  ];

  const rows = (data?.items ?? []).map((u: any) => ({ id: u.user_id, ...u }));

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Platform Users</Typography>
          <Typography variant="body2" color="text.secondary">
            {data?.total ?? 0} users · owners &amp; admins
          </Typography>
        </Box>
        <Button
          variant="contained" startIcon={<Add />}
          onClick={() => setAddUserOpen(true)}
          sx={{ bgcolor: '#6C3FC5', '&:hover': { bgcolor: '#5a33a8' } }}
        >
          Add User
        </Button>
      </Box>

      {/* Filters */}
      <Card sx={{ mb: 2 }}>
        <Box sx={{ p: 2, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <TextField
            size="small" placeholder="Search by name or email…" value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            InputProps={{ startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment> }}
            sx={{ minWidth: 260 }}
          />
          <FormControl size="small" sx={{ minWidth: 210 }}>
            <InputLabel>Show</InputLabel>
            <Select value={role} label="Show" onChange={(e) => { setRole(e.target.value); setPage(0); }}>
              <MenuItem value="super_admin,salon_owner">Owners &amp; Admins</MenuItem>
              <MenuItem value="super_admin">Super Admin only</MenuItem>
              <MenuItem value="salon_owner">Salon Owner only</MenuItem>
              <MenuItem value="branch_manager">Branch Managers</MenuItem>
              <MenuItem value="receptionist">Receptionists</MenuItem>
              <MenuItem value="staff">Staff</MenuItem>
              <MenuItem value="">All Users</MenuItem>
            </Select>
          </FormControl>
        </Box>
      </Card>

      <Card>
        <DataGrid
          rows={rows}
          columns={columns}
          loading={isLoading}
          rowCount={data?.total ?? 0}
          paginationMode="server"
          paginationModel={{ page, pageSize: 25 }}
          onPaginationModelChange={(m) => setPage(m.page)}
          pageSizeOptions={[25]}
          autoHeight
          disableColumnMenu
          sx={{ border: 'none' }}
        />
      </Card>

      <AddUserDialog
        open={addUserOpen}
        onClose={() => { setAddUserOpen(false); refetch(); }}
      />

      {resetUser && (
        <ResetPasswordDialog
          user={resetUser}
          open={!!resetUser}
          onClose={() => setResetUser(null)}
        />
      )}
    </Box>
  );
}
