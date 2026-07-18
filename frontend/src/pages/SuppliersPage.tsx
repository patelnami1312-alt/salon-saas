import { useState } from 'react';
import {
  Box, Typography, Button, Paper, Table, TableHead, TableRow, TableCell,
  TableBody, TableContainer, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Grid, Chip, CircularProgress, Alert, IconButton, Tooltip, Avatar,
} from '@mui/material';
import { Add, Edit, Phone, Email, Business, ArrowBack } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { v, hasNoErrors } from '@/utils/formValidation';

const EMPTY = { name: '', contact_person: '', phone: '', email: '', address: '' };
const EMPTY_ERR = { name: '', phone: '', email: '' };

function validate(form: typeof EMPTY) {
  return {
    name: v.required(form.name, 'Supplier name') || v.minLen(form.name, 2, 'Supplier name'),
    phone: v.phone(form.phone),
    email: v.email(form.email),
  };
}

// Local state only — no backend yet; shows real UI pattern ready to wire up
type Supplier = typeof EMPTY & { id: number };

function SupplierDialog({ open, onClose, editing, onSave }: {
  open: boolean; onClose: () => void;
  editing: Supplier | null; onSave: (s: Supplier) => void;
}) {
  const [form, setForm] = useState(editing ?? EMPTY);
  const [errors, setErrors] = useState(EMPTY_ERR);
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const blur = (f: string) => {
    setTouched((p) => ({ ...p, [f]: true }));
    setErrors(validate(form));
  };
  const change = (f: keyof typeof EMPTY, val: string) => {
    const next = { ...form, [f]: val };
    setForm(next);
    if (touched[f]) setErrors(validate(next));
  };

  const handleSave = () => {
    setTouched({ name: true, phone: true, email: true });
    const errs = validate(form);
    setErrors(errs);
    if (!hasNoErrors(errs)) return;
    onSave({ ...form, id: editing?.id ?? Date.now() });
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle fontWeight={700}>{editing ? 'Edit Supplier' : 'Add Supplier'}</DialogTitle>
      <DialogContent>
        <Grid container spacing={2} sx={{ mt: 0.5 }}>
          <Grid item xs={12}>
            <TextField label="Company / Supplier Name *" fullWidth value={form.name}
              onChange={(e) => change('name', e.target.value)} onBlur={() => blur('name')}
              error={touched.name && !!errors.name} helperText={touched.name ? errors.name : ''} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField label="Contact Person" fullWidth value={form.contact_person}
              onChange={(e) => change('contact_person', e.target.value)} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField label="Phone" fullWidth value={form.phone}
              onChange={(e) => change('phone', e.target.value)} onBlur={() => blur('phone')}
              error={touched.phone && !!errors.phone} helperText={touched.phone ? errors.phone : ''}
              InputProps={{ startAdornment: <Phone sx={{ fontSize: 16, mr: 0.5, color: 'text.secondary' }} /> }} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField label="Email" type="email" fullWidth value={form.email}
              onChange={(e) => change('email', e.target.value)} onBlur={() => blur('email')}
              error={touched.email && !!errors.email} helperText={touched.email ? errors.email : ''}
              InputProps={{ startAdornment: <Email sx={{ fontSize: 16, mr: 0.5, color: 'text.secondary' }} /> }} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField label="Address" fullWidth value={form.address}
              onChange={(e) => change('address', e.target.value)} />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSave}>{editing ? 'Save Changes' : 'Add Supplier'}</Button>
      </DialogActions>
    </Dialog>
  );
}

export default function SuppliersPage() {
  const navigate = useNavigate();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);

  const openEdit = (s: Supplier) => { setEditing(s); setDialogOpen(true); };
  const handleClose = () => { setDialogOpen(false); setEditing(null); };
  const handleSave = (s: Supplier) => {
    if (editing) {
      setSuppliers((p) => p.map((x) => x.id === s.id ? s : x));
      toast.success('Supplier updated');
    } else {
      setSuppliers((p) => [...p, s]);
      toast.success('Supplier added');
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Button startIcon={<ArrowBack />} variant="outlined" size="small" onClick={() => navigate('/inventory')}>
            Back
          </Button>
          <Box>
            <Typography variant="h5" fontWeight={700}>Suppliers</Typography>
            <Typography variant="body2" color="text.secondary">{suppliers.length} suppliers</Typography>
          </Box>
        </Box>
        <Button variant="contained" startIcon={<Add />} onClick={() => { setEditing(null); setDialogOpen(true); }}>
          Add Supplier
        </Button>
      </Box>

      <Alert severity="info" sx={{ mb: 3 }}>
        Supplier records are saved locally in this session. Full database persistence is coming soon.
      </Alert>

      {suppliers.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 10, border: '2px dashed #E5E7EB', borderRadius: 3 }}>
          <Business sx={{ fontSize: 56, color: '#D1D5DB', mb: 2 }} />
          <Typography variant="h6" fontWeight={600} color="text.secondary" mb={1}>No suppliers yet</Typography>
          <Typography variant="body2" color="text.disabled" mb={3}>Add suppliers to track inventory orders</Typography>
          <Button variant="contained" startIcon={<Add />} onClick={() => setDialogOpen(true)}>
            Add First Supplier
          </Button>
        </Box>
      ) : (
        <Paper>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: '#F8F7FF' }}>
                  <TableCell sx={{ fontWeight: 700 }}>Company</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Contact</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Phone</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Email</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Address</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {suppliers.map((s) => (
                  <TableRow key={s.id} hover>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Avatar sx={{ width: 32, height: 32, bgcolor: '#6C3FC5', fontSize: 12 }}>
                          {s.name[0]}
                        </Avatar>
                        <Typography fontWeight={600} variant="body2">{s.name}</Typography>
                      </Box>
                    </TableCell>
                    <TableCell>{s.contact_person || '—'}</TableCell>
                    <TableCell>{s.phone || '—'}</TableCell>
                    <TableCell>{s.email || '—'}</TableCell>
                    <TableCell>{s.address || '—'}</TableCell>
                    <TableCell>
                      <Tooltip title="Edit">
                        <IconButton size="small" onClick={() => openEdit(s)}><Edit sx={{ fontSize: 16 }} /></IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      <SupplierDialog open={dialogOpen} onClose={handleClose} editing={editing} onSave={handleSave} />
    </Box>
  );
}
