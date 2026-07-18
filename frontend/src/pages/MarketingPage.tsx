import { useState, type ReactElement } from 'react';
import {
  Box, Card, CardContent, Typography, Button, Grid, Chip, LinearProgress, Tabs, Tab,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem, CircularProgress,
} from '@mui/material';
import { DataGrid, type GridColDef } from '@mui/x-data-grid';
import { Add, Send, Email, Sms, WhatsApp, Campaign as CampaignIcon, Schedule, Drafts } from '@mui/icons-material';
import { useGetCampaignsQuery, useCreateCampaignMutation, useSendCampaignMutation } from '@/features/api/apiSlice';
import NoRowsOverlay from '@/components/NoRowsOverlay';
import { useSalon } from '@/context/SalonContext';
import toast from 'react-hot-toast';

const CHANNEL_ICONS: Record<string, ReactElement> = {
  Email: <Email sx={{ fontSize: 16 }} />,
  SMS: <Sms sx={{ fontSize: 16 }} />,
  WhatsApp: <WhatsApp sx={{ fontSize: 16 }} />,
};

const STATUS_COLORS: Record<string, 'default' | 'info' | 'success' | 'warning' | 'error'> = {
  Draft: 'default',
  Scheduled: 'info',
  Sending: 'warning',
  Sent: 'success',
  Failed: 'error',
};

export default function MarketingPage() {
  const { formatDate } = useSalon();
  const [tab, setTab] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ campaign_name: '', type: 'Email', target_audience: 'All', message: '', subject: '' });
  const [formErrors, setFormErrors] = useState({ campaign_name: '', message: '' });
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const { data: campaigns, isLoading } = useGetCampaignsQuery();
  const [createCampaign, { isLoading: creating }] = useCreateCampaignMutation();
  const [sendCampaign] = useSendCampaignMutation();

  const validateCampaign = (f: typeof form) => ({
    campaign_name: !f.campaign_name.trim() ? 'Campaign name is required.' : f.campaign_name.trim().length < 3 ? 'Name must be at least 3 characters.' : '',
    message: !f.message.trim() ? 'Message content is required.' : f.message.trim().length < 10 ? 'Message must be at least 10 characters.' : '',
  });

  const handleCreate = async () => {
    setTouched({ campaign_name: true, message: true });
    const errs = validateCampaign(form);
    setFormErrors(errs);
    if (errs.campaign_name || errs.message) return;
    try {
      await createCampaign(form).unwrap();
      toast.success('Campaign saved successfully');
      setCreateOpen(false);
      setForm({ campaign_name: '', type: 'Email', target_audience: 'All', message: '', subject: '' });
    } catch (err: unknown) {
      const msg = (err as { data?: { detail?: string } })?.data?.detail ?? 'Failed to save campaign';
      toast.error(msg);
    }
  };

  const handleSend = async (id: number) => {
    try {
      await sendCampaign(id).unwrap();
      toast.success('Campaign sent successfully');
    } catch {
      toast.error('Failed to send campaign');
    }
  };

  const summaryStats = [
    { label: 'Total Campaigns', value: campaigns?.length || 0, color: '#6C3FC5', bgcolor: '#F3EDFF', icon: <CampaignIcon /> },
    { label: 'Sent', value: campaigns?.filter((c) => c.status === 'Sent').length || 0, color: '#4CAF50', bgcolor: '#E8F5E9', icon: <Send /> },
    { label: 'Scheduled', value: campaigns?.filter((c) => c.status === 'Scheduled').length || 0, color: '#2196F3', bgcolor: '#E3F2FD', icon: <Schedule /> },
    { label: 'Drafts', value: campaigns?.filter((c) => c.status === 'Draft').length || 0, color: '#9E9E9E', bgcolor: '#F5F5F5', icon: <Drafts /> },
  ];

  const columns: GridColDef[] = [
    {
      field: 'campaign_name',
      headerName: 'Campaign',
      flex: 1.5,
      renderCell: (params) => (
        <Box>
          <Typography variant="body2" fontWeight={600}>{params.value}</Typography>
          <Typography variant="caption" color="text.secondary">{formatDate(params.row.created_at)}</Typography>
        </Box>
      ),
    },
    {
      field: 'type',
      headerName: 'Channel',
      flex: 0.8,
      renderCell: (params) => (
        <Chip icon={CHANNEL_ICONS[params.value as string] || <Email sx={{ fontSize: 16 }} />} label={params.value} size="small" variant="outlined" />
      ),
    },
    { field: 'target_audience', headerName: 'Audience', flex: 0.9 },
    { field: 'sent_count', headerName: 'Sent', flex: 0.6, type: 'number', align: 'right', headerAlign: 'right', valueFormatter: (v: number) => (v ?? 0).toLocaleString() },
    { field: 'total_delivered', headerName: 'Delivered', flex: 0.7, type: 'number', align: 'right', headerAlign: 'right', valueFormatter: (v: number) => (v ?? 0).toLocaleString() },
    { field: 'total_opened', headerName: 'Opened', flex: 0.7, type: 'number', align: 'right', headerAlign: 'right', valueFormatter: (v: number) => (v ?? 0).toLocaleString() },
    {
      field: '_deliveryRate',
      headerName: 'Delivery Rate',
      flex: 1,
      sortable: false,
      renderCell: (params) => {
        const rate = params.row.sent_count > 0 ? Math.round(((params.row.total_delivered ?? 0) / params.row.sent_count) * 100) : 0;
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
            <LinearProgress variant="determinate" value={rate} sx={{ flex: 1, height: 6, borderRadius: 3, bgcolor: 'grey.200' }} />
            <Typography variant="caption">{rate}%</Typography>
          </Box>
        );
      },
    },
    {
      field: 'status',
      headerName: 'Status',
      flex: 0.7,
      renderCell: (params) => <Chip label={params.value} size="small" color={STATUS_COLORS[params.value as string] || 'default'} />,
    },
    {
      field: '_actions',
      headerName: 'Actions',
      width: 90,
      sortable: false,
      align: 'center',
      headerAlign: 'center',
      renderCell: (params) => (
        params.row.status === 'Draft' ? (
          <Button size="small" startIcon={<Send />} onClick={() => handleSend(params.row.campaign_id)}>Send</Button>
        ) : null
      ),
    },
  ];

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>Marketing & Campaigns</Typography>
        <Button variant="contained" startIcon={<Add />} onClick={() => setCreateOpen(true)}>New Campaign</Button>
      </Box>

      <Grid container spacing={2} mb={3}>
        {summaryStats.map((s) => (
          <Grid item xs={6} sm={3} key={s.label}>
            <Card sx={{ bgcolor: s.bgcolor, border: `1px solid ${s.color}25` }}>
              <CardContent sx={{ py: 2, px: 2.5, '&:last-child': { pb: 2 } }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="h3" fontWeight={800} sx={{ color: s.color, lineHeight: 1 }}>{s.value}</Typography>
                  <Box sx={{ color: s.color, opacity: 0.6, '& svg': { fontSize: 28 } }}>{s.icon}</Box>
                </Box>
                <Typography variant="body2" fontWeight={600} sx={{ color: s.color }}>{s.label}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)}>
          <Tab label="All Campaigns" />
          <Tab label="Templates" />
        </Tabs>
      </Box>

      {tab === 0 && (
        <Card>
          <DataGrid
            rows={campaigns ?? []}
            columns={columns}
            getRowId={(row) => row.campaign_id}
            loading={isLoading}
            autoHeight
            pageSizeOptions={[10, 25]}
            initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
            disableRowSelectionOnClick
            slots={{ noRowsOverlay: () => <NoRowsOverlay message="No campaigns yet" subtext='Click "New Campaign" to create your first marketing campaign' icon={<CampaignIcon />} /> }}
            sx={{ border: 0, '& .MuiDataGrid-columnHeaders': { bgcolor: 'grey.50' } }}
          />
        </Card>
      )}

      {tab === 1 && (
        <Grid container spacing={2}>
          {['Birthday Wish', 'Appointment Reminder', 'Promotional Offer', 'Membership Renewal'].map((t) => (
            <Grid item xs={12} sm={6} md={3} key={t}>
              <Card sx={{ '&:hover': { transform: 'translateY(-2px)' }, transition: '0.2s', cursor: 'pointer' }}>
                <CardContent sx={{ textAlign: 'center', py: 3 }}>
                  <Email sx={{ fontSize: 40, color: 'primary.main', mb: 1 }} />
                  <Typography variant="subtitle2" fontWeight={700}>{t}</Typography>
                  <Button size="small" sx={{ mt: 1 }}>Use Template</Button>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle>Create Campaign</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12}>
              <TextField
                label="Campaign Name *" fullWidth value={form.campaign_name}
                onChange={(e) => { const v = e.target.value; setForm({ ...form, campaign_name: v }); if (touched.campaign_name) setFormErrors((p) => ({ ...p, campaign_name: !v.trim() ? 'Campaign name is required.' : '' })); }}
                onBlur={() => { setTouched((p) => ({ ...p, campaign_name: true })); setFormErrors(validateCampaign(form)); }}
                error={touched.campaign_name && !!formErrors.campaign_name}
                helperText={touched.campaign_name ? formErrors.campaign_name : ''}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField select label="Channel" fullWidth value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                <MenuItem value="Email">Email</MenuItem>
                <MenuItem value="SMS">SMS</MenuItem>
                <MenuItem value="WhatsApp">WhatsApp</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={6}>
              <TextField select label="Target Audience" fullWidth value={form.target_audience} onChange={(e) => setForm({ ...form, target_audience: e.target.value })}>
                <MenuItem value="All">All Customers</MenuItem>
                <MenuItem value="Active">Active Customers</MenuItem>
                <MenuItem value="Inactive">Inactive (30+ days)</MenuItem>
                <MenuItem value="Members">Members Only</MenuItem>
              </TextField>
            </Grid>
            {form.type === 'Email' && (
              <Grid item xs={12}>
                <TextField label="Subject" fullWidth value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
              </Grid>
            )}
            <Grid item xs={12}>
              <TextField
                label="Message *" fullWidth multiline rows={4} value={form.message}
                onChange={(e) => { const v = e.target.value; setForm({ ...form, message: v }); if (touched.message) setFormErrors((p) => ({ ...p, message: !v.trim() ? 'Message is required.' : '' })); }}
                onBlur={() => { setTouched((p) => ({ ...p, message: true })); setFormErrors(validateCampaign(form)); }}
                error={touched.message && !!formErrors.message}
                helperText={touched.message && formErrors.message ? formErrors.message : "Use {name} for customer name, {salon} for salon name"}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button variant="outlined" onClick={handleCreate} disabled={creating}>Save as Draft</Button>
          <Button variant="contained" startIcon={<Send />} onClick={handleCreate} disabled={creating}>
            {creating ? 'Creating…' : 'Create & Send'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
