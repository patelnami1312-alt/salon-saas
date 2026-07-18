import { useState } from 'react';
import {
  Box, Card, Typography, Button, TextField, InputAdornment,
  Avatar, Chip, IconButton, Dialog, DialogTitle,
  DialogContent, DialogActions, Grid, MenuItem, Select, FormControl, InputLabel,
  Tooltip,
} from '@mui/material';
import { DataGrid, type GridColDef } from '@mui/x-data-grid';
import {
  Search, Add, Edit, Visibility, Phone, Email,
  Star, AccountBalanceWallet, FilterList,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useGetCustomersQuery, useCreateCustomerMutation, useUpdateCustomerMutation } from '@/features/api/apiSlice';
import { useSalon } from '@/context/SalonContext';
import type { Customer } from '@/types';
import toast from 'react-hot-toast';

const createSchema = z.object({
  first_name: z.string().min(1, 'Required'),
  last_name: z.string().min(1, 'Required'),
  mobile: z.string().min(7, 'Valid phone required'),
  email: z.string().email().optional().or(z.literal('')),
  gender: z.string().optional(),
  city: z.string().optional(),
  notes: z.string().optional(),
});

type CreateForm = z.infer<typeof createSchema>;

const GENDER_COLOR: Record<string, 'info' | 'secondary' | 'default'> = {
  Male: 'info',
  Female: 'secondary',
};

export default function CustomersPage() {
  const { formatCurrency, formatDate } = useSalon();
  const navigate = useNavigate();
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  const { data, isLoading } = useGetCustomersQuery({ search, page: page + 1, page_size: 20 });
  const [createCustomer, { isLoading: creating }] = useCreateCustomerMutation();
  const [updateCustomer, { isLoading: updating }] = useUpdateCustomerMutation();

  const { register, handleSubmit, control, reset, formState: { errors } } = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    defaultValues: { first_name: '', last_name: '', mobile: '', email: '', gender: '', city: '', notes: '' },
  });

  const closeDialog = () => {
    setAddOpen(false);
    setEditingCustomer(null);
    reset({ first_name: '', last_name: '', mobile: '', email: '', gender: '', city: '', notes: '' });
  };

  const openEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    reset({
      first_name: customer.first_name,
      last_name: customer.last_name,
      mobile: customer.mobile,
      email: customer.email ?? '',
      gender: customer.gender ?? '',
      city: customer.city ?? '',
      notes: customer.notes ?? '',
    });
    setAddOpen(true);
  };

  const onSubmit = async (form: CreateForm) => {
    try {
      // Backend rejects email: "" (EmailStr requires a real address or the key omitted entirely)
      const payload = { ...form, email: form.email || undefined };
      if (editingCustomer) {
        await updateCustomer({ id: editingCustomer.customer_id, data: payload }).unwrap();
        toast.success('Customer updated successfully');
      } else {
        await createCustomer(payload).unwrap();
        toast.success('Customer added successfully');
      }
      closeDialog();
    } catch (err: unknown) {
      const msg = (err as { data?: { detail?: string } })?.data?.detail ?? 'Failed to save customer';
      toast.error(msg);
    }
  };

  const columns: GridColDef<Customer>[] = [
    {
      field: 'full_name',
      headerName: 'Customer',
      flex: 1.5,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 0.5 }}>
          <Avatar sx={{ width: 34, height: 34, bgcolor: 'primary.main', fontSize: 12 }}>
            {params.row.first_name?.[0] ?? ''}{params.row.last_name?.[0] ?? ''}
          </Avatar>
          <Box>
            <Typography variant="body2" fontWeight={600}>{params.value}</Typography>
            <Typography variant="caption" color="text.secondary">{params.row.city}</Typography>
          </Box>
        </Box>
      ),
    },
    {
      field: 'mobile',
      headerName: 'Contact',
      flex: 1.2,
      renderCell: (params) => (
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Phone sx={{ fontSize: 12, color: 'text.secondary' }} />
            <Typography variant="caption">{params.value}</Typography>
          </Box>
          {params.row.email && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Email sx={{ fontSize: 12, color: 'text.secondary' }} />
              <Typography variant="caption">{params.row.email}</Typography>
            </Box>
          )}
        </Box>
      ),
    },
    {
      field: 'gender',
      headerName: 'Gender',
      flex: 0.7,
      renderCell: (params) => (
        <Chip
          label={params.value || 'N/A'}
          size="small"
          color={GENDER_COLOR[params.value as string] ?? 'default'}
          variant="outlined"
        />
      ),
    },
    { field: 'total_visits', headerName: 'Visits', flex: 0.6, type: 'number', align: 'center', headerAlign: 'center' },
    {
      field: 'total_spent',
      headerName: 'Total Spent',
      flex: 0.9,
      type: 'number',
      align: 'right',
      headerAlign: 'right',
      renderCell: (params) => (
        <Typography variant="body2" fontWeight={600}>{formatCurrency(params.value as number)}</Typography>
      ),
    },
    {
      field: 'loyalty_points',
      headerName: 'Loyalty',
      flex: 0.7,
      type: 'number',
      align: 'center',
      headerAlign: 'center',
      renderCell: (params) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
          <Star sx={{ fontSize: 13, color: '#FF9800' }} />
          <Typography variant="body2">{params.value}</Typography>
        </Box>
      ),
    },
    {
      field: 'wallet_balance',
      headerName: 'Wallet',
      flex: 0.8,
      type: 'number',
      align: 'center',
      headerAlign: 'center',
      renderCell: (params) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
          <AccountBalanceWallet sx={{ fontSize: 13, color: '#4CAF50' }} />
          <Typography variant="body2">{formatCurrency(params.value as number)}</Typography>
        </Box>
      ),
    },
    {
      field: 'created_at',
      headerName: 'Joined',
      flex: 0.8,
      valueFormatter: (v: string) => formatDate(v),
    },
    {
      field: '_actions',
      headerName: 'Actions',
      width: 90,
      sortable: false,
      align: 'center',
      headerAlign: 'center',
      renderCell: (params) => (
        <>
          <Tooltip title="View Profile">
            <IconButton size="small" onClick={() => navigate(`/customers/${params.row.customer_id}`)}>
              <Visibility fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Edit">
            <IconButton size="small" onClick={() => openEdit(params.row)}>
              <Edit fontSize="small" />
            </IconButton>
          </Tooltip>
        </>
      ),
    },
  ];

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Customers</Typography>
          <Typography variant="body2" color="text.secondary">{data?.total ?? 0} total customers</Typography>
        </Box>
        <Button variant="contained" startIcon={<Add />} onClick={() => setAddOpen(true)}>Add Customer</Button>
      </Box>

      <Card sx={{ mb: 2 }}>
        <Box sx={{ p: 2, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <TextField
            placeholder="Search by name, mobile, email…"
            size="small"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            sx={{ minWidth: 300 }}
            InputProps={{ startAdornment: <InputAdornment position="start"><Search sx={{ fontSize: 18 }} /></InputAdornment> }}
          />
          <Button variant="outlined" startIcon={<FilterList />} size="small">Filters</Button>
        </Box>
      </Card>

      <Card>
        <DataGrid
          rows={data?.items ?? []}
          columns={columns}
          getRowId={(row) => row.customer_id}
          rowCount={data?.total ?? 0}
          loading={isLoading}
          paginationMode="server"
          paginationModel={{ page, pageSize: 20 }}
          onPaginationModelChange={(model) => setPage(model.page)}
          pageSizeOptions={[20]}
          autoHeight
          rowHeight={56}
          disableRowSelectionOnClick
          sx={{ border: 0, '& .MuiDataGrid-columnHeaders': { bgcolor: 'grey.50' } }}
        />
      </Card>

      {/* Add Customer Dialog */}
      <Dialog open={addOpen} onClose={closeDialog} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ pb: 1 }}>{editingCustomer ? 'Edit Customer' : 'Add New Customer'}</DialogTitle>
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogContent>
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <TextField {...register('first_name')} label="First Name" fullWidth error={!!errors.first_name} helperText={errors.first_name?.message} />
              </Grid>
              <Grid item xs={6}>
                <TextField {...register('last_name')} label="Last Name" fullWidth error={!!errors.last_name} helperText={errors.last_name?.message} />
              </Grid>
              <Grid item xs={6}>
                <TextField {...register('mobile')} label="Mobile Number" fullWidth error={!!errors.mobile} helperText={errors.mobile?.message} />
              </Grid>
              <Grid item xs={6}>
                <TextField {...register('email')} label="Email (Optional)" fullWidth error={!!errors.email} helperText={errors.email?.message} />
              </Grid>
              <Grid item xs={6}>
                <Controller
                  name="gender"
                  control={control}
                  render={({ field }) => (
                    <FormControl fullWidth size="small">
                      <InputLabel>Gender</InputLabel>
                      <Select {...field} label="Gender">
                        <MenuItem value="Male">Male</MenuItem>
                        <MenuItem value="Female">Female</MenuItem>
                        <MenuItem value="Other">Other</MenuItem>
                      </Select>
                    </FormControl>
                  )}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField {...register('city')} label="City" fullWidth />
              </Grid>
              <Grid item xs={12}>
                <TextField {...register('notes')} label="Notes (Optional)" fullWidth multiline rows={2} />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={closeDialog}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={creating || updating}>
              {editingCustomer ? (updating ? 'Saving…' : 'Save Changes') : (creating ? 'Adding…' : 'Add Customer')}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
}
