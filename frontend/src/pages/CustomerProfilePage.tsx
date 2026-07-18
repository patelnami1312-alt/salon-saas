import { useParams } from 'react-router-dom';
import {
  Box, Grid, Card, CardContent, Typography, Avatar, Chip, Tab, Tabs,
  Table, TableBody, TableCell, TableHead, TableRow, Button, Divider,
  LinearProgress, CircularProgress,
} from '@mui/material';
import { Phone, Email, LocationOn, Star, AccountBalanceWallet, CalendarMonth, AttachMoney } from '@mui/icons-material';
import { useState } from 'react';
import { useGetCustomerQuery, useGetCustomerHistoryQuery } from '@/features/api/apiSlice';
import dayjs from 'dayjs';
import { useSalon } from '@/context/SalonContext';

export default function CustomerProfilePage() {
  const { formatCurrency, formatDate } = useSalon();
  const { id } = useParams<{ id: string }>();
  const customerId = parseInt(id!);
  const [tab, setTab] = useState(0);

  const { data: customer, isLoading } = useGetCustomerQuery(customerId);
  const { data: history } = useGetCustomerHistoryQuery(customerId);

  if (isLoading) return <Box sx={{ display: 'flex', justifyContent: 'center', p: 8 }}><CircularProgress /></Box>;
  if (!customer) return <Typography sx={{ p: 4 }}>Customer not found</Typography>;

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} mb={3}>Customer Profile</Typography>

      <Grid container spacing={2.5}>
        {/* Profile Card */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent sx={{ textAlign: 'center', pt: 4 }}>
              <Avatar sx={{ width: 80, height: 80, bgcolor: 'primary.main', fontSize: 28, mx: 'auto', mb: 2 }}>
                {customer.first_name?.[0] ?? ''}{customer.last_name?.[0] ?? ''}
              </Avatar>
              <Typography variant="h5" fontWeight={700}>{customer.full_name}</Typography>
              <Chip label={customer.gender || 'N/A'} size="small" sx={{ mt: 0.5 }} />

              <Divider sx={{ my: 2 }} />

              <Box sx={{ textAlign: 'left' }}>
                {[
                  { icon: <Phone sx={{ fontSize: 16 }} />, label: customer.mobile },
                  { icon: <Email sx={{ fontSize: 16 }} />, label: customer.email || 'N/A' },
                  { icon: <LocationOn sx={{ fontSize: 16 }} />, label: customer.city || 'N/A' },
                  { icon: <CalendarMonth sx={{ fontSize: 16 }} />, label: customer.date_of_birth ? formatDate(customer.date_of_birth) : 'N/A' },
                ].map((item, i) => (
                  <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, color: 'text.secondary' }}>
                    {item.icon}
                    <Typography variant="body2">{item.label}</Typography>
                  </Box>
                ))}
              </Box>

              <Divider sx={{ my: 2 }} />

              {/* Stats */}
              <Grid container spacing={1.5}>
                {[
                  { label: 'Visits', value: customer.total_visits, color: '#6C3FC5' },
                  { label: 'Spent', value: formatCurrency(customer.total_spent), color: '#2196F3' },
                  { label: 'Points', value: customer.loyalty_points, color: '#FF9800', icon: <Star sx={{ fontSize: 14 }} /> },
                  { label: 'Wallet', value: formatCurrency(customer.wallet_balance), color: '#4CAF50' },
                ].map((s) => (
                  <Grid item xs={6} key={s.label}>
                    <Box sx={{ p: 1.5, bgcolor: `${s.color}10`, borderRadius: 2, textAlign: 'center' }}>
                      <Typography variant="h6" fontWeight={800} sx={{ color: s.color }}>{s.value}</Typography>
                      <Typography variant="caption" color="text.secondary">{s.label}</Typography>
                    </Box>
                  </Grid>
                ))}
              </Grid>

              <Box sx={{ mt: 2 }}>
                <Button fullWidth variant="outlined" size="small">Add Wallet</Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* History Tabs */}
        <Grid item xs={12} md={8}>
          <Card>
            <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
              <Tabs value={tab} onChange={(_, v) => setTab(v)}>
                <Tab label="Appointments" />
                <Tab label="Invoices" />
                <Tab label="Loyalty" />
                <Tab label="Notes" />
              </Tabs>
            </Box>

            <CardContent>
              {tab === 0 && (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Date</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Service</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {history?.appointments?.map((a: any) => (
                      <TableRow key={a.appointment_id} hover>
                        <TableCell>{formatDate(a.date)}</TableCell>
                        <TableCell><Chip label={a.status} size="small" color={a.status === 'Completed' ? 'success' : 'default'} /></TableCell>
                        <TableCell>{a.service_id}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}

              {tab === 1 && (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Invoice #</TableCell>
                      <TableCell>Date</TableCell>
                      <TableCell align="right">Amount</TableCell>
                      <TableCell>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {history?.invoices?.map((i: any) => (
                      <TableRow key={i.invoice_id} hover>
                        <TableCell sx={{ fontWeight: 600 }}>{i.invoice_number}</TableCell>
                        <TableCell>{formatDate(i.date)}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 600 }}>{formatCurrency(i.total)}</TableCell>
                        <TableCell><Chip label={i.status} size="small" color={i.status === 'Paid' ? 'success' : 'warning'} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}

              {tab === 2 && (
                <Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                    <Box>
                      <Typography variant="h4" fontWeight={800} color="warning.main">{customer.loyalty_points}</Typography>
                      <Typography color="text.secondary" variant="body2">Available points</Typography>
                    </Box>
                    <Box sx={{ textAlign: 'right' }}>
                      <Typography variant="body2" color="text.secondary">Redemption value</Typography>
                      <Typography fontWeight={700}>{formatCurrency(customer.loyalty_points * 0.01)}</Typography>
                    </Box>
                  </Box>
                  <LinearProgress variant="determinate" value={Math.min((customer.loyalty_points / 5000) * 100, 100)} sx={{ height: 8, borderRadius: 4, mb: 1 }} />
                  <Typography variant="caption" color="text.secondary">{5000 - customer.loyalty_points} points to next tier</Typography>
                </Box>
              )}

              {tab === 3 && (
                <Box>
                  <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                    {customer.notes || 'No notes yet'}
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
