import { useState } from 'react';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Button, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, Chip, CircularProgress, Alert, Grid,
  Card, CardContent, Avatar,
} from '@mui/material';
import { Add, CardGiftcard, Search, CheckCircle, Cancel } from '@mui/icons-material';
import {
  useGetGiftCardsQuery, useCreateGiftCardMutation, useValidateGiftCardQuery,
} from '@/features/api/apiSlice';
import { useSalon } from '@/context/SalonContext';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function CreateGiftCardForm({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState({ amount: '', recipient_name: '', recipient_email: '', expiry_date: '' });
  const [create] = useCreateGiftCardMutation();
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ code: string; balance: number } | null>(null);
  const [amountError, setAmountError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [submitError, setSubmitError] = useState('');

  const today = new Date().toISOString().split('T')[0];

  const handleSubmit = async () => {
    let valid = true;
    if (!form.amount || Number(form.amount) <= 0) {
      setAmountError('Amount must be greater than 0.');
      valid = false;
    } else {
      setAmountError('');
    }
    if (form.recipient_email && !EMAIL_RE.test(form.recipient_email.trim())) {
      setEmailError('Enter a valid email address.');
      valid = false;
    } else {
      setEmailError('');
    }
    if (!valid) return;
    setSubmitError('');
    setSubmitting(true);
    try {
      const res = await create({
        amount: Number(form.amount),
        recipient_name: form.recipient_name || undefined,
        recipient_email: form.recipient_email || undefined,
        expiry_date: form.expiry_date || undefined,
      }).unwrap();
      setResult(res);
    } catch (err: unknown) {
      setSubmitError((err as any)?.data?.detail ?? 'Failed to create gift card. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {submitError && <Alert severity="error">{submitError}</Alert>}
        {result ? (
          <Box sx={{ textAlign: 'center', py: 2 }}>
            <CheckCircle sx={{ fontSize: 48, color: 'success.main', mb: 1 }} />
            <Typography variant="h5" fontWeight={700} gutterBottom>Gift Card Created!</Typography>
            <Paper sx={{ p: 2, bgcolor: 'primary.main', color: 'primary.contrastText', borderRadius: 2, display: 'inline-block', px: 4 }}>
              <Typography variant="h4" fontWeight={800} letterSpacing={4}>{result.code}</Typography>
            </Paper>
            <Typography mt={2} color="text.secondary">Balance: ${result.balance.toFixed(2)}</Typography>
          </Box>
        ) : (
          <>
            <TextField
              label="Amount ($) *" type="number" value={form.amount} fullWidth
              onChange={(e) => { setForm(f => ({ ...f, amount: e.target.value })); if (amountError) setAmountError(''); }}
              error={!!amountError} helperText={amountError}
              inputProps={{ min: 1, step: 0.01 }}
            />
            <TextField label="Recipient Name" value={form.recipient_name} onChange={(e) => setForm(f => ({ ...f, recipient_name: e.target.value }))} fullWidth />
            <TextField
              label="Recipient Email" value={form.recipient_email}
              onChange={(e) => { setForm(f => ({ ...f, recipient_email: e.target.value })); if (emailError) setEmailError(''); }}
              onBlur={() => { if (form.recipient_email && !EMAIL_RE.test(form.recipient_email.trim())) setEmailError('Enter a valid email address.'); }}
              error={!!emailError} helperText={emailError} fullWidth
            />
            <TextField
              label="Expiry Date" type="date" value={form.expiry_date}
              onChange={(e) => setForm(f => ({ ...f, expiry_date: e.target.value }))}
              fullWidth InputLabelProps={{ shrink: true }}
              inputProps={{ min: today }}
              helperText="Leave blank for no expiry"
            />
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{result ? 'Close' : 'Cancel'}</Button>
        {!result && (
          <Button variant="contained" onClick={handleSubmit} disabled={submitting || !form.amount}>
            {submitting ? <CircularProgress size={20} /> : 'Create Gift Card'}
          </Button>
        )}
      </DialogActions>
    </>
  );
}

function ValidateCard() {
  const [code, setCode] = useState('');
  const [query, setQuery] = useState('');
  const { data, isLoading } = useValidateGiftCardQuery(query, { skip: !query });

  return (
    <Paper sx={{ p: 2, mb: 3 }}>
      <Typography variant="h6" fontWeight={600} mb={2}>Validate a Gift Card</Typography>
      <Box sx={{ display: 'flex', gap: 2 }}>
        <TextField
          label="Gift Card Code"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          size="small"
          sx={{ width: 280 }}
          placeholder="XXXX-XXXX-XXXX-XXXX"
        />
        <Button variant="contained" startIcon={<Search />} onClick={() => setQuery(code)} disabled={!code}>
          Validate
        </Button>
      </Box>
      {isLoading && <CircularProgress size={20} sx={{ mt: 1 }} />}
      {data && (
        <Box sx={{ mt: 2 }}>
          {data.is_valid ? (
            <Alert severity="success" icon={<CheckCircle />}>
              <strong>Valid!</strong> Balance: ${data.balance?.toFixed(2)}
              {(data as any).recipient_name && ` — For: ${(data as any).recipient_name}`}
            </Alert>
          ) : (
            <Alert severity="error" icon={<Cancel />}>{data.message}</Alert>
          )}
        </Box>
      )}
    </Paper>
  );
}

export default function GiftCardsPage() {
  const { formatCurrency } = useSalon();
  const [showCreate, setShowCreate] = useState(false);
  const { data: cards, isLoading } = useGetGiftCardsQuery({ active_only: false });

  const active = cards?.filter(c => c.is_active && c.balance > 0) ?? [];
  const totalValue = active.reduce((s, c) => s + c.balance, 0);

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CardGiftcard color="primary" />
          <Typography variant="h5" fontWeight={700}>Gift Cards</Typography>
        </Box>
        <Button variant="contained" startIcon={<Add />} onClick={() => setShowCreate(true)}>
          New Gift Card
        </Button>
      </Box>

      {/* Stats */}
      <Grid container spacing={2} mb={3}>
        {[
          { label: 'Active Cards', value: active.length, color: '#9B72E8' },
          { label: 'Total Balance', value: formatCurrency(totalValue), color: '#4CAF50' },
          { label: 'Total Issued', value: cards?.length ?? 0, color: '#2196F3' },
        ].map((stat) => (
          <Grid item xs={4} key={stat.label}>
            <Card>
              <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Avatar sx={{ bgcolor: stat.color }}>
                  <CardGiftcard />
                </Avatar>
                <Box>
                  <Typography variant="caption" color="text.secondary">{stat.label}</Typography>
                  <Typography variant="h6" fontWeight={700}>{stat.value}</Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <ValidateCard />

      <Paper>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Code</TableCell>
                <TableCell>Recipient</TableCell>
                <TableCell align="right">Initial</TableCell>
                <TableCell align="right">Balance</TableCell>
                <TableCell>Expiry</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Issued</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} align="center"><CircularProgress size={24} /></TableCell></TableRow>
              ) : (cards ?? []).map((c) => (
                <TableRow key={c.gift_card_id} hover>
                  <TableCell sx={{ fontFamily: 'monospace', fontWeight: 700, letterSpacing: 1 }}>{c.code}</TableCell>
                  <TableCell>{c.recipient_name || '—'}</TableCell>
                  <TableCell align="right">{formatCurrency(c.initial_amount)}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, color: c.balance > 0 ? 'success.main' : 'text.disabled' }}>
                    {formatCurrency(c.balance)}
                  </TableCell>
                  <TableCell>{c.expiry_date ? new Date(c.expiry_date).toLocaleDateString() : 'No expiry'}</TableCell>
                  <TableCell>
                    <Chip
                      label={c.is_active && c.balance > 0 ? 'Active' : 'Used/Expired'}
                      size="small"
                      color={c.is_active && c.balance > 0 ? 'success' : 'default'}
                    />
                  </TableCell>
                  <TableCell>{new Date(c.purchased_at).toLocaleDateString()}</TableCell>
                </TableRow>
              ))}
              {!isLoading && (cards ?? []).length === 0 && (
                <TableRow><TableCell colSpan={7} align="center" sx={{ py: 3 }}>No gift cards issued yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Dialog open={showCreate} onClose={() => setShowCreate(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create Gift Card</DialogTitle>
        <CreateGiftCardForm onClose={() => setShowCreate(false)} />
      </Dialog>
    </Box>
  );
}
