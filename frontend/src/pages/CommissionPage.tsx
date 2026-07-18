import { useState } from 'react';
import {
  Box, Typography, Paper, Grid, Card, CardContent, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Chip, Avatar,
  TextField, MenuItem, CircularProgress, Alert,
} from '@mui/material';
import { AttachMoney, TrendingUp, ContentCut, Person } from '@mui/icons-material';
import { useGetCommissionsQuery, useGetCommissionSummaryQuery } from '@/features/api/apiSlice';
import { useSalon } from '@/context/SalonContext';

export default function CommissionPage() {
  const { formatCurrency } = useSalon();
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);

  const { data: summaryData, isLoading: summaryLoading } = useGetCommissionSummaryQuery({ date_from: dateFrom, date_to: dateTo });
  const { data: commissionsData, isLoading: listLoading } = useGetCommissionsQuery({ date_from: dateFrom, date_to: dateTo, page: 1 });

  const summary = summaryData?.summary ?? [];
  const commissions = commissionsData?.items ?? [];

  const totalCommission = summary.reduce((s, r) => s + r.total_commission, 0);
  const totalRevenue = summary.reduce((s, r) => s + r.total_revenue, 0);
  const totalServices = summary.reduce((s, r) => s + r.service_count, 0);

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" fontWeight={700} mb={3}>Staff Commissions</Typography>

      {/* Date filter */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
        <TextField label="From" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} size="small" InputLabelProps={{ shrink: true }} />
        <TextField label="To" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} size="small" InputLabelProps={{ shrink: true }} />
      </Box>

      {/* Summary cards */}
      <Grid container spacing={2} mb={3}>
        {[
          { label: 'Total Commissions', value: formatCurrency(totalCommission), icon: <AttachMoney />, color: '#9B72E8' },
          { label: 'Total Revenue', value: formatCurrency(totalRevenue), icon: <TrendingUp />, color: '#4CAF50' },
          { label: 'Services Performed', value: totalServices, icon: <ContentCut />, color: '#2196F3' },
          { label: 'Active Staff', value: summary.length, icon: <Person />, color: '#FF9800' },
        ].map((card) => (
          <Grid item xs={12} sm={6} md={3} key={card.label}>
            <Card>
              <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Avatar sx={{ bgcolor: card.color }}>{card.icon}</Avatar>
                <Box>
                  <Typography variant="caption" color="text.secondary">{card.label}</Typography>
                  <Typography variant="h6" fontWeight={700}>{card.value}</Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Staff summary table */}
      <Paper sx={{ mb: 3 }}>
        <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Typography variant="h6" fontWeight={600}>By Staff Member</Typography>
        </Box>
        {summaryLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : summary.length === 0 ? (
          <Alert severity="info" sx={{ m: 2 }}>No commission records for this period.</Alert>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Staff</TableCell>
                  <TableCell>Role</TableCell>
                  <TableCell align="center">Services</TableCell>
                  <TableCell align="right">Revenue Generated</TableCell>
                  <TableCell align="center">Rate</TableCell>
                  <TableCell align="right">Commission Earned</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {summary.map((row) => (
                  <TableRow key={row.staff_id} hover>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Avatar sx={{ width: 28, height: 28, fontSize: 12, bgcolor: '#9B72E8' }}>
                          {row.staff_name.charAt(0)}
                        </Avatar>
                        {row.staff_name}
                      </Box>
                    </TableCell>
                    <TableCell>{row.job_title || '—'}</TableCell>
                    <TableCell align="center">{row.service_count}</TableCell>
                    <TableCell align="right">{formatCurrency(row.total_revenue)}</TableCell>
                    <TableCell align="center">
                      <Chip label={`${row.commission_percent}%`} size="small" color="primary" variant="outlined" />
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, color: 'success.main' }}>
                      {formatCurrency(row.total_commission)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {/* Transaction list */}
      <Paper>
        <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Typography variant="h6" fontWeight={600}>Commission Transactions</Typography>
        </Box>
        {listLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell>Staff</TableCell>
                  <TableCell>Invoice #</TableCell>
                  <TableCell align="right">Service Amount</TableCell>
                  <TableCell align="center">Rate</TableCell>
                  <TableCell align="right">Commission</TableCell>
                  <TableCell>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {commissions.map((c) => (
                  <TableRow key={c.commission_id} hover>
                    <TableCell>{new Date(c.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>{c.staff_name}</TableCell>
                    <TableCell>#{c.invoice_id}</TableCell>
                    <TableCell align="right">{formatCurrency(c.base_amount)}</TableCell>
                    <TableCell align="center">{c.commission_percent}%</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600, color: 'success.main' }}>{formatCurrency(c.amount)}</TableCell>
                    <TableCell>
                      <Chip label={c.status} size="small" color={c.status === 'Paid' ? 'success' : 'warning'} />
                    </TableCell>
                  </TableRow>
                ))}
                {commissions.length === 0 && (
                  <TableRow><TableCell colSpan={7} align="center" sx={{ py: 3, color: 'text.secondary' }}>No transactions found</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>
    </Box>
  );
}
