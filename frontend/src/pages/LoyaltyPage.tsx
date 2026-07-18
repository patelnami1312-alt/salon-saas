import { useState, Fragment } from 'react';
import {
  Box, Typography, Paper, TextField, InputAdornment, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Chip, Avatar,
  CircularProgress, Alert, Card, CardContent, Grid,
} from '@mui/material';
import { Search, Loyalty, TrendingUp, Redeem } from '@mui/icons-material';
import { useGetCustomersQuery, useGetCustomerLoyaltyQuery } from '@/features/api/apiSlice';
import { useSalon } from '@/context/SalonContext';
import type { Customer } from '@/types';

function CustomerLoyaltyDetail({ customer }: { customer: Customer }) {
  const { formatCurrency } = useSalon();
  const { data, isLoading } = useGetCustomerLoyaltyQuery(customer.customer_id);

  if (isLoading) return <CircularProgress size={20} />;
  if (!data) return null;

  return (
    <Box sx={{ mt: 2 }}>
      <Grid container spacing={2} mb={2}>
        <Grid item xs={6} sm={3}>
          <Card variant="outlined">
            <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
              <Typography variant="caption" color="text.secondary">Balance</Typography>
              <Typography fontWeight={700} color="primary">{data.balance} pts</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Card variant="outlined">
            <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
              <Typography variant="caption" color="text.secondary">Est. Value</Typography>
              <Typography fontWeight={700}>{formatCurrency(data.balance * 0.01)}</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Date</TableCell>
              <TableCell>Description</TableCell>
              <TableCell>Type</TableCell>
              <TableCell align="right">Points</TableCell>
              <TableCell align="right">Balance</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.transactions.map((t) => (
              <TableRow key={t.transaction_id}>
                <TableCell>{new Date(t.created_at).toLocaleDateString()}</TableCell>
                <TableCell>{t.description || '—'}</TableCell>
                <TableCell>
                  <Chip
                    label={t.transaction_type}
                    size="small"
                    color={t.transaction_type === 'Earned' ? 'success' : 'error'}
                  />
                </TableCell>
                <TableCell align="right" sx={{ color: t.points > 0 ? 'success.main' : 'error.main', fontWeight: 600 }}>
                  {t.points > 0 ? '+' : ''}{t.points}
                </TableCell>
                <TableCell align="right">{t.balance_after}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

export default function LoyaltyPage() {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Customer | null>(null);

  const { data: customersData, isLoading } = useGetCustomersQuery({ search, page_size: 20 });
  const customers = customersData?.items ?? [];

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
        <Loyalty color="primary" />
        <Typography variant="h5" fontWeight={700}>Loyalty Program</Typography>
      </Box>

      <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
        <TextField
          placeholder="Search customer..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          size="small"
          sx={{ width: 300 }}
          InputProps={{ startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment> }}
        />
      </Box>

      <Paper>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Customer</TableCell>
                <TableCell align="right">Points</TableCell>
                <TableCell align="right">Est. Value</TableCell>
                <TableCell>Total Visits</TableCell>
                <TableCell>Last Visit</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} align="center" sx={{ py: 3 }}><CircularProgress size={24} /></TableCell></TableRow>
              ) : customers.length === 0 ? (
                <TableRow><TableCell colSpan={5} align="center" sx={{ py: 3 }}><Alert severity="info">No customers found</Alert></TableCell></TableRow>
              ) : customers.map((c) => (
                <Fragment key={c.customer_id}>
                  <TableRow
                    hover
                    onClick={() => setSelected(selected?.customer_id === c.customer_id ? null : c)}
                    sx={{ cursor: 'pointer', bgcolor: selected?.customer_id === c.customer_id ? 'action.selected' : undefined }}
                  >
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Avatar sx={{ width: 28, height: 28, fontSize: 12, bgcolor: '#9B72E8' }}>{c.first_name.charAt(0)}</Avatar>
                        {c.first_name} {c.last_name}
                      </Box>
                    </TableCell>
                    <TableCell align="right">
                      <Chip label={`${c.loyalty_points} pts`} size="small" color={c.loyalty_points > 0 ? 'primary' : 'default'} />
                    </TableCell>
                    <TableCell align="right">${(c.loyalty_points * 0.01).toFixed(2)}</TableCell>
                    <TableCell>{c.total_visits}</TableCell>
                    <TableCell>{c.last_visit_date ? new Date(c.last_visit_date).toLocaleDateString() : '—'}</TableCell>
                  </TableRow>
                  {selected?.customer_id === c.customer_id && (
                    <TableRow>
                      <TableCell colSpan={5} sx={{ bgcolor: 'background.default', px: 3 }}>
                        <CustomerLoyaltyDetail customer={c} />
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
}
