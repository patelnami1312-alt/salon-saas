import { useState } from 'react';
import {
  Box, Card, Typography, Button, TextField, InputAdornment,
  Avatar, Chip, IconButton, Tooltip,
} from '@mui/material';
import { DataGrid, type GridColDef } from '@mui/x-data-grid';
import { Search, Add, Visibility, Star } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useGetStaffQuery } from '@/features/api/apiSlice';
import { useAppSelector } from '@/app/hooks';

export default function StaffPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const branchId = useAppSelector((s) => s.dashboard.selectedBranchId) ?? undefined;

  const { data, isLoading } = useGetStaffQuery({ branch_id: branchId, search, page: page + 1, page_size: 20 });

  const columns: GridColDef[] = [
    {
      field: 'full_name',
      headerName: 'Staff Member',
      flex: 1.5,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 0.5 }}>
          <Avatar src={params.row.profile_picture_url || undefined} sx={{ width: 36, height: 36, bgcolor: 'secondary.main', fontSize: 12 }}>
            {params.row.first_name?.[0] ?? ''}{params.row.last_name?.[0] ?? ''}
          </Avatar>
          <Box>
            <Typography variant="body2" fontWeight={600}>{params.value}</Typography>
            <Typography variant="caption" color="text.secondary">{params.row.email}</Typography>
          </Box>
        </Box>
      ),
    },
    { field: 'phone', headerName: 'Contact', flex: 0.9, valueFormatter: (v: string) => v || '—' },
    { field: 'job_title', headerName: 'Job Title', flex: 1, valueFormatter: (v: string) => v || '—' },
    { field: 'experience', headerName: 'Experience', flex: 0.7, type: 'number', align: 'center', headerAlign: 'center', valueFormatter: (v: number) => `${v}y` },
    { field: 'total_serviced', headerName: 'Serviced', flex: 0.7, type: 'number', align: 'center', headerAlign: 'center', renderCell: (p) => <Typography variant="body2" fontWeight={600}>{p.value}</Typography> },
    {
      field: 'commission_percent',
      headerName: 'Commission',
      flex: 0.8,
      type: 'number',
      align: 'center',
      headerAlign: 'center',
      renderCell: (p) => <Chip label={`${p.value}%`} size="small" color="primary" variant="outlined" />,
    },
    {
      field: 'average_rating',
      headerName: 'Rating',
      flex: 0.7,
      type: 'number',
      align: 'center',
      headerAlign: 'center',
      renderCell: (p) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
          <Star sx={{ fontSize: 13, color: '#FF9800' }} />
          <Typography variant="body2">{(p.value as number).toFixed(1)}</Typography>
        </Box>
      ),
    },
    {
      field: 'is_active',
      headerName: 'Status',
      flex: 0.7,
      align: 'center',
      headerAlign: 'center',
      renderCell: (p) => <Chip label={p.value ? 'Active' : 'Inactive'} size="small" color={p.value ? 'success' : 'default'} />,
    },
    {
      field: '_actions',
      headerName: 'Actions',
      width: 90,
      sortable: false,
      align: 'center',
      headerAlign: 'center',
      renderCell: (params) => (
        <Tooltip title="View Profile">
          <IconButton size="small" onClick={() => navigate(`/staff/${params.row.staff_id}`)}>
            <Visibility fontSize="small" />
          </IconButton>
        </Tooltip>
      ),
    },
  ];

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Staff Management</Typography>
          <Typography variant="body2" color="text.secondary">{data?.total ?? 0} staff members</Typography>
        </Box>
        <Button variant="contained" startIcon={<Add />} onClick={() => navigate('/staff/new')}>Add Staff</Button>
      </Box>

      <Card sx={{ mb: 2 }}>
        <Box sx={{ p: 2 }}>
          <TextField
            placeholder="Search staff…"
            size="small"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            sx={{ minWidth: 300 }}
            InputProps={{ startAdornment: <InputAdornment position="start"><Search sx={{ fontSize: 18 }} /></InputAdornment> }}
          />
        </Box>
      </Card>

      <Card>
        <DataGrid
          rows={data?.items ?? []}
          columns={columns}
          getRowId={(row) => row.staff_id}
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
    </Box>
  );
}
