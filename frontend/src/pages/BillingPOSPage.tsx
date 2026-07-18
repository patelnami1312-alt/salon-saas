import React, { useState, useRef, useEffect } from 'react';
import {
  Box, Typography, Chip, Button, Avatar, Divider,
  CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Paper, LinearProgress, Grid, Card, CardContent,
  Badge, IconButton,
} from '@mui/material';
import {
  ContentCut, AccessTime, Add,
  CreditCard, AttachMoney, Person, PlayArrow, HowToReg,
  ShoppingCart, CheckCircleOutline, Search,
  QueuePlayNext, Timer, HourglassEmpty, PeopleAlt,
  CheckCircle, Cancel, Refresh, Close, Smartphone, Nfc, ErrorOutline,
} from '@mui/icons-material';
import dayjs from 'dayjs';
import toast from 'react-hot-toast';
import {
  useGetQueueQuery,
  useCreateCheckInMutation,
  useUpdateCheckInStatusMutation,
  useGetServicesQuery,
  useGetAppointmentsQuery,
  useCreateInvoiceMutation,
  useRecordPaymentMutation,
  useInitiateTerminalPaymentMutation,
  useLazyGetTerminalStatusQuery,
  useCreateStripeIntentMutation,
} from '@/features/api/apiSlice';
import { useAppSelector } from '@/app/hooks';
import { useSalon } from '@/context/SalonContext';
import { useQueueSync } from '@/hooks/useQueueSync';
import StripePaymentForm from '@/components/StripePaymentForm';
import PhoneCheckInDialog from '@/components/PhoneCheckInDialog';

const TAX_RATE = 0.08;

// Avatar background palette — consistent per first letter
const AV_COLORS: Record<string, string> = {
  A:'#F59E0B',B:'#6366F1',C:'#14B8A6',D:'#3B82F6',E:'#EC4899',
  F:'#22C55E',G:'#8B5CF6',H:'#F97316',I:'#06B6D4',J:'#84CC16',
  K:'#7C3AED',L:'#EF4444',M:'#14B8A6',N:'#EC4899',O:'#F59E0B',
  P:'#10B981',Q:'#6366F1',R:'#3B82F6',S:'#0EA5E9',T:'#A855F7',
  U:'#6C3FC5',V:'#F97316',W:'#22C55E',X:'#EF4444',Y:'#84CC16',Z:'#EC4899',
};
const avColor = (name?: string) => AV_COLORS[(name?.[0] ?? 'A').toUpperCase()] ?? '#6C3FC5';

interface ExtraService { service_id: number; name: string; price: number }
interface CheckoutClient {
  checkin_id: number;
  customer_id: number;
  customer_name: string;
  mobile?: string;
  branch_id: number;
  staff_id?: number;
  appointment_id?: number;
  services: { service_id: number; name: string; price: number }[];
}
interface PaymentResult { total: number; invoice_number?: string }

// ── Helpers ───────────────────────────────────────────────────────────────────
function TimerChip({ minutes, color = '#F97316' }: { minutes: number | null; color?: string }) {
  const label = minutes === null ? '—'
    : minutes < 60 ? `${minutes}m`
    : `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  return (
    <Box sx={{
      display:'inline-flex', alignItems:'center', gap:'4px',
      bgcolor:`${color}18`, color, borderRadius:'20px', px:'9px', py:'3px',
      fontSize:11, fontWeight:700,
    }}>
      <AccessTime sx={{ fontSize:'11px !important' }} />
      {label}
    </Box>
  );
}

function ColHeader({ title, count, color }: { title: string; count: number; color: string }) {
  return (
    <Box sx={{ display:'flex', alignItems:'center', justifyContent:'space-between', mb:1.5 }}>
      <Box sx={{ display:'flex', alignItems:'center', gap:1 }}>
        <Typography fontWeight={700} variant="body2" sx={{ color:'#1F2937', letterSpacing:'-.2px' }}>
          {title}
        </Typography>
        <Box sx={{
          minWidth:20, height:20, borderRadius:'10px', px:'6px',
          bgcolor:`${color}18`, color, fontSize:11, fontWeight:800,
          display:'inline-flex', alignItems:'center', justifyContent:'center',
        }}>
          {count}
        </Box>
      </Box>
      <Typography variant="caption" color="text.secondary" fontWeight={500}>{count} clients</Typography>
    </Box>
  );
}

function SectionDivider({ label }: { label: string }) {
  return (
    <Box sx={{ display:'flex', alignItems:'center', gap:1, my:0.75 }}>
      <Box sx={{ flex:1, height:'1px', bgcolor:'#F3F4F6' }} />
      <Typography sx={{ fontSize:10, fontWeight:800, color:'#9CA3AF', textTransform:'uppercase', letterSpacing:'.7px' }}>
        {label}
      </Typography>
      <Box sx={{ flex:1, height:'1px', bgcolor:'#F3F4F6' }} />
    </Box>
  );
}

// ── Service Catalog Dialog ────────────────────────────────────────────────────
function ServiceCatalogDialog({ open, onClose, onSelect, alreadyAdded }: {
  open: boolean; onClose: () => void;
  onSelect: (svc: ExtraService) => void; alreadyAdded: number[];
}) {
  const [search, setSearch] = useState('');
  const { data: services = [] } = useGetServicesQuery({});
  const filtered = (services as any[]).filter((s) =>
    s.service_name.toLowerCase().includes(search.toLowerCase())
  );
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pb:1 }}>
        <Typography fontWeight={800} fontSize={15}>Add Service</Typography>
        <TextField
          size="small" fullWidth placeholder="Search services…" value={search}
          onChange={(e) => setSearch(e.target.value)} sx={{ mt:1.5 }}
          InputProps={{ sx:{ borderRadius:'10px', fontSize:13 } }}
        />
      </DialogTitle>
      <DialogContent sx={{ pt:1 }}>
        <Box sx={{ display:'flex', flexWrap:'wrap', gap:1, maxHeight:320, overflowY:'auto' }}>
          {filtered.map((svc: any) => {
            const added = alreadyAdded.includes(svc.service_id);
            return (
              <Chip
                key={svc.service_id}
                icon={<ContentCut sx={{ fontSize:13 }} />}
                label={`${svc.service_name} · $${svc.price}`}
                clickable={!added}
                onClick={() => {
                  if (!added) {
                    onSelect({ service_id: svc.service_id, name: svc.service_name, price: parseFloat(svc.price) });
                    onClose();
                  }
                }}
                variant="outlined"
                sx={{
                  fontSize:12, fontWeight:600,
                  opacity: added ? .5 : 1,
                  bgcolor: added ? '#F3F4F6' : '#F5F0FF',
                  borderColor: added ? '#E5E7EB' : '#C4AEFF',
                  color: added ? '#9CA3AF' : '#6C3FC5',
                  '&:hover': !added ? { bgcolor:'#EDE7FF', borderColor:'#6C3FC5' } : {},
                  cursor: added ? 'default' : 'pointer',
                }}
              />
            );
          })}
          {filtered.length === 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ py:2 }}>No services found</Typography>
          )}
        </Box>
      </DialogContent>
    </Dialog>
  );
}

// ── Lobby Card ────────────────────────────────────────────────────────────────
function LobbyCard({ item, isScheduled, onCheckIn, onSeat }: {
  item: any; isScheduled: boolean; onCheckIn: () => void; onSeat: () => void;
}) {
  const accentColor = isScheduled ? '#22C55E' : '#F97316';
  return (
    <Paper elevation={0} sx={{
      p:'14px 16px', borderRadius:'14px', mb:1,
      border:'1.5px solid #E5E7EB',
      borderLeft:`3px solid ${accentColor}`,
      boxShadow:'0 1px 4px rgba(0,0,0,.04)',
      display:'flex', flexDirection:'column', gap:'10px',
      transition:'all .15s',
      '&:hover':{ borderColor: accentColor, boxShadow:`0 3px 12px ${accentColor}22` },
    }}>
      <Box sx={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between' }}>
        <Box sx={{ display:'flex', alignItems:'center', gap:'10px' }}>
          <Avatar sx={{ width:38, height:38, fontSize:14, fontWeight:800, bgcolor: avColor(item.customer_name) }}>
            {item.customer_name?.[0] ?? '?'}
          </Avatar>
          <Box>
            <Typography fontWeight={700} fontSize={13} color="#1F2937" noWrap sx={{ maxWidth:140 }}>
              {item.customer_name ?? 'Walk-in'}
            </Typography>
            <Typography fontSize={11} color="#9CA3AF" fontWeight={500} noWrap sx={{ maxWidth:140, display:'block' }}>
              {item.service_name}
            </Typography>
          </Box>
        </Box>
        <Typography fontWeight={800} fontSize={14} color="#6C3FC5">
          ${(item.service_price ?? 0).toFixed(2)}
        </Typography>
      </Box>

      <Box sx={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        {isScheduled
          ? <TimerChip minutes={null} color="#6B7280" />
          : <TimerChip minutes={item.wait_minutes ?? 0} color="#F97316" />
        }
        {isScheduled ? (
          <Button size="small" variant="contained" startIcon={<HowToReg sx={{ fontSize:13 }} />}
            onClick={onCheckIn}
            sx={{ borderRadius:'20px', px:1.5, py:'5px', fontSize:12, fontWeight:700,
              bgcolor:'#22C55E', '&:hover':{ bgcolor:'#16A34A' }, textTransform:'none' }}>
            Check In
          </Button>
        ) : (
          <Button size="small" variant="contained" startIcon={<PlayArrow sx={{ fontSize:13 }} />}
            onClick={onSeat}
            sx={{ borderRadius:'20px', px:1.5, py:'5px', fontSize:12, fontWeight:700,
              bgcolor:'#6C3FC5', '&:hover':{ bgcolor:'#5a33a8' }, textTransform:'none' }}>
            Seat
          </Button>
        )}
      </Box>
    </Paper>
  );
}

// ── In Service Card ───────────────────────────────────────────────────────────
function InServiceCard({ item, extras, onAddService, onRemoveExtra, onFinish }: {
  item: any; extras: ExtraService[];
  onAddService: () => void; onRemoveExtra: (id: number) => void; onFinish: () => void;
}) {
  const totalPrice = (item.service_price ?? 0) + extras.reduce((s, e) => s + e.price, 0);
  const progress = item.service_duration && item.service_minutes
    ? Math.min(100, Math.round((item.service_minutes / item.service_duration) * 100))
    : null;

  return (
    <Paper elevation={0} sx={{
      p:'14px 16px', borderRadius:'14px', mb:1,
      border:'1.5px solid #E9D8FD', bgcolor:'#FDFCFF',
      boxShadow:'0 1px 6px rgba(108,63,197,.07)',
      display:'flex', flexDirection:'column', gap:'10px',
      '&:hover':{ boxShadow:'0 4px 16px rgba(108,63,197,.12)' },
      transition:'box-shadow .15s',
    }}>
      <Box sx={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between' }}>
        <Box sx={{ display:'flex', alignItems:'center', gap:'10px' }}>
          <Avatar sx={{ width:38, height:38, fontSize:14, fontWeight:800, bgcolor: avColor(item.customer_name) }}>
            {item.customer_name?.[0] ?? '?'}
          </Avatar>
          <Box>
            <Typography fontWeight={700} fontSize={13} color="#1F2937" noWrap sx={{ maxWidth:130 }}>
              {item.customer_name ?? 'Walk-in'}
            </Typography>
            <Typography fontSize={11} color="#9CA3AF" fontWeight={500} noWrap sx={{ maxWidth:130, display:'block' }}>
              {item.staff_name ? `Chair · ${item.staff_name}` : item.service_name}
            </Typography>
          </Box>
        </Box>
        <Typography fontWeight={800} fontSize={14} color="#6C3FC5">${totalPrice.toFixed(2)}</Typography>
      </Box>

      {/* Service tag row */}
      <Box sx={{ display:'flex', flexWrap:'wrap', gap:'5px' }}>
        <Chip label={item.service_name} size="small" variant="outlined"
          sx={{ fontSize:11, fontWeight:600, bgcolor:'#EDE7FF', borderColor:'#C4AEFF', color:'#6C3FC5' }} />
        {extras.map((e) => (
          <Chip key={e.service_id} label={e.name} size="small" variant="outlined"
            onDelete={() => onRemoveExtra(e.service_id)}
            sx={{ fontSize:11, fontWeight:600, bgcolor:'#EFF6FF', borderColor:'#BFDBFE', color:'#3B82F6' }} />
        ))}
        <Chip
          icon={<Add sx={{ fontSize:'11px !important' }} />}
          label="Add" size="small" variant="outlined" onClick={onAddService}
          sx={{ fontSize:11, fontWeight:700, color:'#9CA3AF', borderColor:'#E5E7EB', borderStyle:'dashed',
            bgcolor:'transparent', cursor:'pointer',
            '&:hover':{ borderColor:'#6C3FC5', color:'#6C3FC5', borderStyle:'solid' } }}
        />
      </Box>

      {/* Progress bar */}
      {progress !== null && (
        <LinearProgress variant="determinate" value={progress}
          sx={{ height:3, borderRadius:2, bgcolor:'#F3F4F6',
            '& .MuiLinearProgress-bar':{ bgcolor:'#6C3FC5', borderRadius:2 } }} />
      )}

      <Box sx={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <TimerChip minutes={item.service_minutes ?? 0} color="#7C3AED" />
        <Button size="small" variant="contained" onClick={onFinish}
          sx={{ borderRadius:'20px', px:1.5, py:'5px', fontSize:12, fontWeight:700,
            bgcolor:'#7C3AED', '&:hover':{ bgcolor:'#6D28D9' }, textTransform:'none' }}>
          Finish
        </Button>
      </Box>
    </Paper>
  );
}

// ── Check-In Dialog ───────────────────────────────────────────────────────────
const CI_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  Waiting:   { label: 'Waiting',    color: '#F97316', bg: '#FFF7ED' },
  CheckedIn: { label: 'Checked In', color: '#2196F3', bg: '#E3F2FD' },
  InService: { label: 'In Service', color: '#7C3AED', bg: '#F3E5F5' },
  Completed: { label: 'Completed',  color: '#22C55E', bg: '#F0FDF4' },
  Cancelled: { label: 'Cancelled',  color: '#EF4444', bg: '#FEF2F2' },
};

function CheckInDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const branchId = useAppSelector((s) => s.dashboard.selectedBranchId);
  const [walkInOpen, setWalkInOpen] = useState(false);

  const { data: queueData, isLoading: qLoading, refetch: refetchCI } = useGetQueueQuery(
    branchId ?? 0, { skip: !branchId || !open },
  );
  const [updateCI] = useUpdateCheckInStatusMutation();

  const queue: any[] = queueData?.queue ?? [];
  const active = queue.filter((c) => c.status !== 'Completed' && c.status !== 'Cancelled');

  const stats = [
    { label: 'Waiting',      count: queue.filter((c) => c.status === 'Waiting').length,   color: '#F97316', bg: '#FFF7ED', icon: <HourglassEmpty sx={{ fontSize: 26, opacity: .6 }} /> },
    { label: 'In Service',   count: queue.filter((c) => c.status === 'InService' || c.status === 'CheckedIn').length, color: '#7C3AED', bg: '#F3E5F5', icon: <ContentCut sx={{ fontSize: 26, opacity: .6 }} /> },
    { label: 'Completed',    count: queue.filter((c) => c.status === 'Completed').length,  color: '#22C55E', bg: '#F0FDF4', icon: <CheckCircle sx={{ fontSize: 26, opacity: .6 }} /> },
    { label: 'Total',        count: queue.length,                                           color: '#2196F3', bg: '#E3F2FD', icon: <PeopleAlt sx={{ fontSize: 26, opacity: .6 }} /> },
  ];

  const handleStatus = async (id: number, newStatus: string) => {
    try {
      await updateCI({ id, data: { status: newStatus } }).unwrap();
      const labels: Record<string, string> = { CheckedIn: 'Checked in', InService: 'Service started', Completed: 'Completed', Cancelled: 'Cancelled' };
      toast.success(labels[newStatus] ?? 'Updated');
      refetchCI();
    } catch { toast.error('Failed to update status'); }
  };

  const nextAction: Record<string, { label: string; status: string; icon: React.ReactElement } | undefined> = {
    Waiting:   { label: 'Check In',      status: 'CheckedIn', icon: <HowToReg sx={{ fontSize: 15 }} /> },
    CheckedIn: { label: 'Start Service', status: 'InService', icon: <PlayArrow sx={{ fontSize: 15 }} /> },
    InService: { label: 'Complete',      status: 'Completed', icon: <CheckCircle sx={{ fontSize: 15 }} /> },
  };

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth
        PaperProps={{ sx: { borderRadius: 3, maxHeight: '90vh' } }}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
          <Box>
            <Typography fontWeight={800} fontSize={17}>Reception / Check-In</Typography>
            <Typography fontSize={12} color="text.secondary">{active.length} in queue</Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button size="small" variant="outlined" startIcon={<Refresh sx={{ fontSize: 15 }} />} onClick={() => refetchCI()}>
              Refresh
            </Button>
            <Button size="small" variant="contained" startIcon={<Add sx={{ fontSize: 15 }} />}
              onClick={() => setWalkInOpen(true)}
              sx={{ bgcolor: '#6C3FC5', '&:hover': { bgcolor: '#5a33a8' } }}>
              Walk-In
            </Button>
            <IconButton size="small" onClick={onClose}><Close fontSize="small" /></IconButton>
          </Box>
        </DialogTitle>

        <DialogContent dividers sx={{ bgcolor: '#FAFAFA' }}>
          {/* Stats row */}
          <Grid container spacing={1.5} mb={2}>
            {stats.map((s) => (
              <Grid item xs={6} sm={3} key={s.label}>
                <Card elevation={0} sx={{ bgcolor: s.bg, border: `1px solid ${s.color}25`, borderRadius: 2 }}>
                  <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Typography fontWeight={900} fontSize={26} sx={{ color: s.color, lineHeight: 1 }}>{s.count}</Typography>
                      <Box sx={{ color: s.color }}>{s.icon}</Box>
                    </Box>
                    <Typography fontSize={11} fontWeight={700} sx={{ color: s.color, mt: .5 }}>{s.label}</Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          {/* Queue grid */}
          {qLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
          ) : active.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 8 }}>
              <QueuePlayNext sx={{ fontSize: 48, color: '#D1D5DB', mb: 1.5 }} />
              <Typography fontWeight={600} color="text.secondary">Queue is empty</Typography>
              <Typography fontSize={13} color="text.secondary" mb={2}>Add a walk-in customer to get started</Typography>
              <Button variant="contained" startIcon={<Add />} onClick={() => setWalkInOpen(true)}
                sx={{ bgcolor: '#6C3FC5', '&:hover': { bgcolor: '#5a33a8' } }}>
                Add Walk-In
              </Button>
            </Box>
          ) : (
            <Grid container spacing={1.5}>
              {active
                .sort((a: any, b: any) => (a.queue_number ?? 0) - (b.queue_number ?? 0))
                .map((c: any) => {
                  const cfg = CI_STATUS[c.status] ?? CI_STATUS.Waiting;
                  const action = nextAction[c.status];
                  return (
                    <Grid item xs={12} sm={6} md={4} key={c.checkin_id}>
                      <Card elevation={0} sx={{
                        borderLeft: `4px solid ${cfg.color}`,
                        border: `1px solid ${cfg.color}30`,
                        borderRadius: 2,
                        '&:hover': { boxShadow: 3 },
                      }}>
                        <CardContent sx={{ p: 1.75, '&:last-child': { pb: 1.75 } }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                              <Badge badgeContent={c.queue_number} color="primary"
                                sx={{ '& .MuiBadge-badge': { fontSize: 10, fontWeight: 700 } }}>
                                <Avatar sx={{ width: 38, height: 38, bgcolor: cfg.color + '25', color: cfg.color, fontWeight: 700, fontSize: 14 }}>
                                  {c.customer_name?.[0] ?? '?'}
                                </Avatar>
                              </Badge>
                              <Box>
                                <Typography fontSize={13} fontWeight={700}>{c.customer_name ?? 'Walk-in'}</Typography>
                                <Typography fontSize={11} color="text.secondary">{c.customer_mobile}</Typography>
                              </Box>
                            </Box>
                            <Chip label={cfg.label} size="small"
                              sx={{ bgcolor: cfg.bg, color: cfg.color, fontWeight: 600, fontSize: 10 }} />
                          </Box>
                          <Divider sx={{ mb: 1 }} />
                          <Box sx={{ display: 'flex', gap: 2, mb: 1 }}>
                            <Box>
                              <Typography fontSize={10} color="text.secondary">Service</Typography>
                              <Typography fontSize={12} fontWeight={600}>{c.service_name}</Typography>
                            </Box>
                            <Box>
                              <Typography fontSize={10} color="text.secondary">Staff</Typography>
                              <Typography fontSize={12} fontWeight={600}>{c.staff_name ?? 'Any'}</Typography>
                            </Box>
                            {c.wait_minutes !== null && (
                              <Box sx={{ ml: 'auto' }}>
                                <Typography fontSize={10} color="text.secondary">Wait</Typography>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: .3 }}>
                                  <Timer sx={{ fontSize: 13, color: c.wait_minutes > 30 ? '#EF4444' : '#22C55E' }} />
                                  <Typography fontSize={12} fontWeight={700}
                                    color={c.wait_minutes > 30 ? 'error' : 'success.main'}>
                                    {c.wait_minutes}m
                                  </Typography>
                                </Box>
                              </Box>
                            )}
                          </Box>
                          <Box sx={{ display: 'flex', gap: .75 }}>
                            {action && (
                              <Button size="small" variant="contained" startIcon={action.icon}
                                onClick={() => handleStatus(c.checkin_id, action.status)}
                                sx={{ flex: 1, fontSize: 11, textTransform: 'none', borderRadius: '8px',
                                  bgcolor: cfg.color, '&:hover': { filter: 'brightness(.9)', bgcolor: cfg.color } }}>
                                {action.label}
                              </Button>
                            )}
                            <IconButton size="small" color="error"
                              onClick={() => handleStatus(c.checkin_id, 'Cancelled')}>
                              <Cancel sx={{ fontSize: 18 }} />
                            </IconButton>
                          </Box>
                        </CardContent>
                      </Card>
                    </Grid>
                  );
                })}
            </Grid>
          )}
        </DialogContent>
      </Dialog>

      <PhoneCheckInDialog
        open={walkInOpen}
        onClose={() => setWalkInOpen(false)}
        branchId={branchId ?? null}
        onCheckedIn={refetchCI}
      />
    </>
  );
}

// ── Checkout Panel ────────────────────────────────────────────────────────────
type PayMethod = 'Card' | 'UPI' | 'Cash';
type TerminalPhase = 'idle' | 'initiating' | 'waiting' | 'failed';

function CheckoutPanel({ client, onDone }: { client: CheckoutClient; onDone: () => void }) {
  const { formatCurrency } = useSalon();
  const branchId = useAppSelector((s) => s.dashboard.selectedBranchId);

  const [tip, setTip]         = useState<'18'|'20'|'25'|'custom'>('20');
  const [customTip, setCustomTip]     = useState('');
  const [payMethod, setPayMethod]     = useState<PayMethod>('Card');
  const [result, setResult]           = useState<PaymentResult | null>(null);
  const [terminalPhase, setTerminalPhase] = useState<TerminalPhase>('idle');
  const [terminalError, setTerminalError] = useState('');
  const [waitSeconds, setWaitSeconds] = useState(0);
  const [stripeData, setStripeData] = useState<{
    invoiceId: number; invoiceNumber: string; clientSecret: string; publishableKey: string;
  } | null>(null);

  const pollRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [createInvoice,      { isLoading: invoicing }]  = useCreateInvoiceMutation();
  const [recordPayment,      { isLoading: paying }]      = useRecordPaymentMutation();
  const [initiateTerminal,   { isLoading: initiating }]  = useInitiateTerminalPaymentMutation();
  const [getTerminalStatus]                               = useLazyGetTerminalStatusQuery();
  const [createStripeIntent, { isLoading: startingStripe }] = useCreateStripeIntentMutation();

  // Cleanup polling on unmount
  useEffect(() => () => stopPolling(), []);

  const subtotal = client.services.reduce((s, sv) => s + sv.price, 0);
  const taxAmt   = subtotal * TAX_RATE;
  const tipAmt   = tip === 'custom' ? parseFloat(customTip || '0') : subtotal * parseInt(tip) / 100;
  const total    = subtotal + taxAmt + tipAmt;

  const busy = invoicing || paying || initiating || startingStripe || terminalPhase === 'waiting';

  const invoicePayload = {
    branch_id:   branchId ?? client.branch_id,
    customer_id: client.customer_id,
    checkin_id:  client.checkin_id,
    ...(client.appointment_id ? { appointment_id: client.appointment_id } : {}),
    items: client.services.map((sv) => ({
      item_type:   'Service',
      item_ref_id: sv.service_id,
      item_name:   sv.name,
      quantity:    1,
      unit_price:  sv.price,
      ...(client.staff_id ? { staff_id: client.staff_id } : {}),
    })),
  };

  const stopPolling = () => {
    if (pollRef.current)  { clearInterval(pollRef.current);  pollRef.current  = null; }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  };

  const finalize = async (opts?: {
    invoiceId?: number; invoiceNumber?: string; transactionId?: string; gatewayResponse?: string;
  }) => {
    try {
      let invoiceId = opts?.invoiceId;
      let invoiceNumber = opts?.invoiceNumber;
      if (!invoiceId) {
        const inv = await createInvoice(invoicePayload as any).unwrap();
        invoiceId = inv.invoice_id;
        invoiceNumber = inv.invoice_number;
      }
      await recordPayment({
        invoice_id:       invoiceId,
        payment_method:   payMethod,
        amount:           total,
        ...(opts?.transactionId ? { transaction_id: opts.transactionId, gateway_response: opts.gatewayResponse } : {}),
      }).unwrap();
      stopPolling();
      setTerminalPhase('idle');
      setStripeData(null);
      setResult({ total, invoice_number: invoiceNumber! });
    } catch (err: any) {
      toast.error(err?.data?.detail ?? 'Payment failed');
      setTerminalPhase('idle');
    }
  };

  const startPolling = (merchantTxnId: string) => {
    setTerminalPhase('waiting');
    setWaitSeconds(0);
    let attempts = 0;
    const MAX = 40; // 40 × 3 s = 2 min

    timerRef.current = setInterval(() => setWaitSeconds((s) => s + 1), 1000);

    pollRef.current = setInterval(async () => {
      attempts++;
      try {
        const status = await getTerminalStatus(merchantTxnId).unwrap();
        if (status.done) {
          stopPolling();
          if (status.success) {
            await finalize({ transactionId: status.transaction_id, gatewayResponse: JSON.stringify(status) });
          } else {
            setTerminalPhase('failed');
            setTerminalError(status.response_message || 'Payment declined by bank');
          }
          return;
        }
      } catch { /* network hiccup — keep polling */ }

      if (attempts >= MAX) {
        stopPolling();
        setTerminalPhase('failed');
        setTerminalError('Terminal timed out after 2 minutes. Please retry.');
      }
    }, 3000);
  };

  const handleCharge = async () => {
    if (payMethod === 'Cash') {
      await finalize();
      return;
    }

    if (payMethod === 'Card') {
      setTerminalPhase('initiating');
      try {
        const inv = await createInvoice(invoicePayload as any).unwrap();
        try {
          const intent = await createStripeIntent({ invoice_id: inv.invoice_id, amount: total }).unwrap();
          setStripeData({
            invoiceId: inv.invoice_id,
            invoiceNumber: inv.invoice_number,
            clientSecret: intent.client_secret,
            publishableKey: intent.publishable_key,
          });
          setTerminalPhase('idle');
        } catch (err: any) {
          const detail: string = err?.data?.detail ?? '';
          // 503 = Stripe not configured — fall back to manual recording against the invoice we already created
          if (err?.status === 503 || detail.toLowerCase().includes('not configured')) {
            toast('Card payments not connected – recording manually', { icon: '⚠️' });
            setTerminalPhase('idle');
            await finalize({ invoiceId: inv.invoice_id, invoiceNumber: inv.invoice_number });
          } else {
            setTerminalPhase('failed');
            setTerminalError(detail || 'Failed to start card payment');
          }
        }
      } catch (err: any) {
        setTerminalPhase('idle');
        toast.error(err?.data?.detail ?? 'Failed to create invoice');
      }
      return;
    }

    // UPI — physical card-present terminal flow (no gateway wired in yet, falls back to manual)
    setTerminalPhase('initiating');
    try {
      const { merchant_txn_id } = await initiateTerminal({
        amount:       total,
        payment_mode: payMethod,
      }).unwrap();
      startPolling(merchant_txn_id);
    } catch (err: any) {
      const detail: string = err?.data?.detail ?? '';
      // 503 = terminal not configured — silently fall back to manual recording
      if (err?.status === 503 || detail.toLowerCase().includes('not configured')) {
        toast('Terminal not connected – recording payment manually', { icon: '⚠️' });
        setTerminalPhase('idle');
        await finalize();
      } else {
        setTerminalPhase('failed');
        setTerminalError(detail || 'Failed to reach payment terminal');
      }
    }
  };

  const handleCancel = () => {
    stopPolling();
    setTerminalPhase('idle');
    setTerminalError('');
    setWaitSeconds(0);
  };

  const handleRetry = () => {
    setTerminalPhase('idle');
    setTerminalError('');
  };

  const handleManualOverride = async () => {
    stopPolling();
    setTerminalPhase('idle');
    await finalize();
  };

  const handleStripeCancel = () => {
    setStripeData(null);
  };

  const handleStripeSuccess = async (paymentIntentId: string) => {
    if (!stripeData) return;
    await finalize({
      invoiceId: stripeData.invoiceId,
      invoiceNumber: stripeData.invoiceNumber,
      transactionId: paymentIntentId,
      gatewayResponse: 'Stripe PaymentIntent succeeded',
    });
  };

  const handleStripeError = (message: string) => {
    setStripeData(null);
    setTerminalPhase('failed');
    setTerminalError(message);
  };

  // ── Success receipt ────────────────────────────────────────────────────────
  if (result) {
    return (
      <Box sx={{ display:'flex', flexDirection:'column', alignItems:'center', gap:2, py:3, textAlign:'center' }}>
        <Box sx={{
          width:60, height:60, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center',
          background:'linear-gradient(135deg,#4ADE80,#22C55E)',
          boxShadow:'0 6px 20px rgba(34,197,94,.35)',
        }}>
          <CheckCircleOutline sx={{ fontSize:30, color:'white' }} />
        </Box>
        <Box>
          <Typography fontWeight={900} fontSize={17} color="#1F2937">Payment Received</Typography>
          <Typography fontSize={12} color="#9CA3AF" mt={0.5}>
            {client.customer_name} · {payMethod} · {dayjs().format('MMM D, h:mm A')}
          </Typography>
        </Box>
        <Typography fontWeight={900} fontSize={34} color="#22C55E" sx={{ letterSpacing:'-1.5px' }}>
          {formatCurrency(result.total)}
        </Typography>
        <Box sx={{ display:'flex', gap:1, width:'100%' }}>
          {[
            { label:'Invoice', val: result.invoice_number ?? '—' },
            { label:'Tip',     val: formatCurrency(tipAmt) },
            { label:'Change',  val: payMethod === 'Cash' ? formatCurrency(0) : '—' },
          ].map(({ label, val }) => (
            <Box key={label} sx={{
              flex:1, bgcolor:'#F9FAFB', border:'1.5px solid #E5E7EB',
              borderRadius:'10px', p:'8px', textAlign:'center',
            }}>
              <Typography fontSize={10} color="#9CA3AF" fontWeight={600}>{label}</Typography>
              <Typography fontSize={13} fontWeight={800} color="#1F2937" mt={0.25}>{val}</Typography>
            </Box>
          ))}
        </Box>
        <Button fullWidth variant="contained" onClick={onDone}
          sx={{ borderRadius:'12px', fontWeight:800, fontSize:14, py:1.5, bgcolor:'#6C3FC5',
            '&:hover':{ bgcolor:'#5a33a8' }, textTransform:'none' }}>
          Next Client
        </Button>
      </Box>
    );
  }

  // ── Stripe: card entry form ─────────────────────────────────────────────────
  if (stripeData) {
    return (
      <Box sx={{ display:'flex', flexDirection:'column', gap:1.5, py:1 }}>
        <Box sx={{ display:'flex', alignItems:'center', justifyContent:'center', mb:0.5 }}>
          <Typography fontWeight={900} fontSize={16} color="#1F2937">
            {formatCurrency(total)}
          </Typography>
        </Box>
        <StripePaymentForm
          clientSecret={stripeData.clientSecret}
          publishableKey={stripeData.publishableKey}
          amountLabel={formatCurrency(total)}
          onSuccess={handleStripeSuccess}
          onError={handleStripeError}
          onCancel={handleStripeCancel}
        />
      </Box>
    );
  }

  // ── Terminal: Waiting for customer ─────────────────────────────────────────
  if (terminalPhase === 'waiting' || terminalPhase === 'initiating') {
    const elapsed = `${Math.floor(waitSeconds / 60)}:${String(waitSeconds % 60).padStart(2, '0')}`;
    return (
      <Box sx={{ display:'flex', flexDirection:'column', alignItems:'center', gap:2, py:3, textAlign:'center' }}>
        <Box sx={{
          width:72, height:72, borderRadius:'50%',
          background:'linear-gradient(135deg,#A78BFA,#6C3FC5)',
          display:'flex', alignItems:'center', justifyContent:'center',
          boxShadow:'0 0 0 0 rgba(108,63,197,.4)',
          animation:'pulse 1.8s ease-in-out infinite',
          '@keyframes pulse': {
            '0%':   { boxShadow:'0 0 0 0 rgba(108,63,197,.4)' },
            '70%':  { boxShadow:'0 0 0 18px rgba(108,63,197,0)' },
            '100%': { boxShadow:'0 0 0 0 rgba(108,63,197,0)' },
          },
        }}>
          {payMethod === 'UPI'
            ? <Smartphone sx={{ fontSize:32, color:'white' }} />
            : <Nfc sx={{ fontSize:32, color:'white' }} />
          }
        </Box>
        <Box>
          <Typography fontWeight={900} fontSize={16} color="#1F2937">
            {terminalPhase === 'initiating'
              ? (payMethod === 'Card' ? 'Preparing secure payment form…' : 'Connecting to terminal…')
              : `Waiting for ${payMethod === 'UPI' ? 'UPI scan' : 'card tap / insert'}…`}
          </Typography>
          <Typography fontSize={12} color="#9CA3AF" mt={0.5}>
            Amount: <strong style={{ color:'#6C3FC5' }}>{formatCurrency(total)}</strong>
          </Typography>
        </Box>
        {terminalPhase === 'waiting' && (
          <Box sx={{ display:'flex', alignItems:'center', gap:0.5,
            bgcolor:'#F5F3FF', px:2, py:0.75, borderRadius:'20px' }}>
            <Timer sx={{ fontSize:14, color:'#7C3AED' }} />
            <Typography fontSize={13} fontWeight={700} color="#7C3AED" sx={{ fontVariantNumeric:'tabular-nums' }}>
              {elapsed}
            </Typography>
          </Box>
        )}
        <Typography fontSize={11} color="#D1D5DB" sx={{ maxWidth:200 }}>
          {payMethod === 'UPI'
            ? 'QR code is displayed on the terminal'
            : 'Ask the customer to tap, swipe, or insert their card'}
        </Typography>
        {terminalPhase === 'waiting' && (
          <Button variant="outlined" color="error" size="small" onClick={handleCancel}
            sx={{ borderRadius:'10px', textTransform:'none', fontWeight:700 }}>
            Cancel
          </Button>
        )}
      </Box>
    );
  }

  // ── Terminal: Failed ───────────────────────────────────────────────────────
  if (terminalPhase === 'failed') {
    return (
      <Box sx={{ display:'flex', flexDirection:'column', alignItems:'center', gap:2, py:3, textAlign:'center' }}>
        <Box sx={{
          width:64, height:64, borderRadius:'50%',
          bgcolor:'#FEF2F2', display:'flex', alignItems:'center', justifyContent:'center',
          border:'2px solid #FECACA',
        }}>
          <ErrorOutline sx={{ fontSize:30, color:'#EF4444' }} />
        </Box>
        <Box>
          <Typography fontWeight={800} fontSize={15} color="#1F2937">Payment Failed</Typography>
          <Typography fontSize={12} color="#6B7280" mt={0.5} sx={{ maxWidth:220 }}>
            {terminalError}
          </Typography>
        </Box>
        <Box sx={{ display:'flex', flexDirection:'column', gap:1, width:'100%' }}>
          <Button fullWidth variant="contained" onClick={handleRetry}
            sx={{ borderRadius:'11px', fontWeight:700, textTransform:'none', py:1.25,
              bgcolor:'#6C3FC5', '&:hover':{ bgcolor:'#5a33a8' } }}>
            Retry on Terminal
          </Button>
          <Button fullWidth variant="outlined" onClick={handleManualOverride}
            sx={{ borderRadius:'11px', fontWeight:700, textTransform:'none', py:1.25,
              borderColor:'#D1D5DB', color:'#6B7280' }}>
            Record {payMethod} Manually
          </Button>
          <Button fullWidth size="small" onClick={() => { handleRetry(); setPayMethod('Cash'); }}
            sx={{ textTransform:'none', color:'#9CA3AF', fontSize:12 }}>
            Switch to Cash
          </Button>
        </Box>
      </Box>
    );
  }

  // ── Checkout form ──────────────────────────────────────────────────────────
  return (
    <Box sx={{ height:'100%', display:'flex', flexDirection:'column' }}>
      {/* Header */}
      <Box sx={{ display:'flex', alignItems:'center', gap:1.5, mb:2 }}>
        <Avatar sx={{ width:46, height:46, fontWeight:800, fontSize:16, bgcolor: avColor(client.customer_name) }}>
          {client.customer_name?.[0] ?? '?'}
        </Avatar>
        <Box>
          <Typography fontWeight={800} fontSize={15} color="#1F2937">{client.customer_name}</Typography>
          {client.mobile && <Typography fontSize={11} color="#9CA3AF">{client.mobile}</Typography>}
        </Box>
        <Box sx={{ ml:'auto', bgcolor:'#FFF7ED', color:'#C2410C', borderRadius:'8px',
          px:'10px', py:'3px', fontSize:10, fontWeight:800, whiteSpace:'nowrap' }}>
          Just finished
        </Box>
      </Box>

      <Box sx={{ flex:1, overflowY:'auto' }}>
        {/* Service lines */}
        {client.services.map((sv, i) => (
          <Box key={sv.service_id} sx={{ display:'flex', alignItems:'center', justifyContent:'space-between', mb:1 }}>
            <Box sx={{ display:'flex', alignItems:'center', gap:'7px' }}>
              <ContentCut sx={{ fontSize:13, color:'#9CA3AF' }} />
              <Typography fontSize={13} color="#4B5563">{sv.name}</Typography>
              {i > 0 && (
                <Box sx={{ bgcolor:'#EFF6FF', color:'#3B82F6', borderRadius:'4px', px:'5px', py:'1px', fontSize:10, fontWeight:700 }}>
                  Add-on
                </Box>
              )}
            </Box>
            <Typography fontSize={13} fontWeight={700} color="#1F2937">{formatCurrency(sv.price)}</Typography>
          </Box>
        ))}

        <Divider sx={{ my:1.5 }} />

        {/* Tip */}
        <Typography fontSize={10} fontWeight={800} color="#9CA3AF" sx={{ textTransform:'uppercase', letterSpacing:'.8px', mb:1 }}>
          Add Tip
        </Typography>
        <Box sx={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'6px', mb:1.5 }}>
          {(['18','20','25','custom'] as const).map((t) => (
            <Box key={t} onClick={() => setTip(t)} sx={{
              bgcolor: tip === t ? '#EDE7FF' : '#F9FAFB',
              border: `1.5px solid ${tip === t ? '#6C3FC5' : '#E5E7EB'}`,
              borderRadius:'10px', py:'8px', textAlign:'center',
              fontSize:13, fontWeight:700,
              color: tip === t ? '#6C3FC5' : '#4B5563',
              cursor:'pointer', transition:'all .12s',
            }}>
              {t === 'custom' ? 'Custom' : `${t}%`}
            </Box>
          ))}
        </Box>
        {tip === 'custom' && (
          <TextField size="small" fullWidth type="number" placeholder="Enter tip amount"
            value={customTip}
            onChange={(e) => { const v = e.target.value; if (v === '' || parseFloat(v) >= 0) setCustomTip(v); }}
            inputProps={{ min: 0, step: 0.01 }}
            InputProps={{ startAdornment: <Typography sx={{ mr:.5, color:'#9CA3AF' }}>₹</Typography>,
              sx:{ borderRadius:'10px', fontSize:13 } }}
            sx={{ mb:1.5 }} />
        )}

        <Divider sx={{ my:1.5 }} />

        {/* Totals */}
        {[
          { label:'Subtotal',                               val: subtotal },
          { label:`Tax (${(TAX_RATE*100).toFixed(0)}%)`,   val: taxAmt },
          { label:`Tip (${tip === 'custom' ? 'Custom' : tip+'%'})`, val: tipAmt },
        ].map(({ label, val }) => (
          <Box key={label} sx={{ display:'flex', justifyContent:'space-between', mb:1 }}>
            <Typography fontSize={12} color="#9CA3AF">{label}</Typography>
            <Typography fontSize={12} fontWeight={600} color="#374151">{formatCurrency(val)}</Typography>
          </Box>
        ))}
        <Box sx={{
          display:'flex', justifyContent:'space-between', alignItems:'center',
          bgcolor:'#EDE7FF', borderRadius:'11px', px:'13px', py:'11px', mt:1,
        }}>
          <Typography fontWeight={800} fontSize={14} color="#6C3FC5">Total</Typography>
          <Typography fontWeight={900} fontSize={17} color="#6C3FC5">{formatCurrency(total)}</Typography>
        </Box>
      </Box>

      {/* Payment method + charge */}
      <Box sx={{ pt:1.5 }}>
        {/* 3 method buttons */}
        <Box sx={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'6px', mb:1 }}>
          {([
            { key:'Card', icon:<CreditCard sx={{ fontSize:14 }} />, activeColor:'#6C3FC5', activeHover:'#5a33a8' },
            { key:'UPI',  icon:<Smartphone sx={{ fontSize:14 }} />, activeColor:'#0EA5E9', activeHover:'#0284C7' },
            { key:'Cash', icon:<AttachMoney sx={{ fontSize:14 }} />, activeColor:'#22C55E', activeHover:'#16A34A' },
          ] as const).map(({ key, icon, activeColor, activeHover }) => (
            <Button key={key} fullWidth
              variant={payMethod === key ? 'contained' : 'outlined'}
              startIcon={icon}
              onClick={() => setPayMethod(key)}
              sx={{
                borderRadius:'11px', fontWeight:700, fontSize:12, py:1.1,
                textTransform:'none', minWidth:0,
                ...(payMethod === key ? { bgcolor: activeColor, '&:hover':{ bgcolor: activeHover } } : {}),
              }}>
              {key}
            </Button>
          ))}
        </Box>

        {/* Context hint */}
        {payMethod !== 'Cash' && (
          <Typography fontSize={10.5} color="#9CA3AF" textAlign="center" mb={0.75}>
            {payMethod === 'UPI'
              ? 'Terminal will display a QR code for the customer to scan'
              : 'Opens a secure card entry form (Stripe) — no physical terminal required'}
          </Typography>
        )}

        <Button fullWidth variant="contained" size="large"
          disabled={busy}
          onClick={handleCharge}
          startIcon={busy
            ? <CircularProgress size={16} color="inherit" />
            : payMethod === 'Cash'
              ? <AttachMoney sx={{ fontSize:18 }} />
              : payMethod === 'Card'
                ? <CreditCard sx={{ fontSize:18 }} />
                : <Nfc sx={{ fontSize:18 }} />
          }
          sx={{
            borderRadius:'13px', fontWeight:900, fontSize:15, py:1.75,
            letterSpacing:'-.3px', textTransform:'none',
            background: payMethod === 'Cash'
              ? 'linear-gradient(135deg,#34D399,#22C55E)'
              : payMethod === 'UPI'
                ? 'linear-gradient(135deg,#38BDF8,#0EA5E9)'
                : 'linear-gradient(135deg,#7C3AED,#6C3FC5)',
            boxShadow: payMethod === 'Cash'
              ? '0 4px 16px rgba(34,197,94,.35)'
              : payMethod === 'UPI'
                ? '0 4px 16px rgba(14,165,233,.35)'
                : '0 4px 16px rgba(108,63,197,.35)',
            '&:hover':{ opacity:.9 },
          }}>
          {payMethod === 'Cash'
            ? `Record Cash · ${formatCurrency(total)}`
            : payMethod === 'Card'
              ? `Enter Card Details · ${formatCurrency(total)}`
              : `Charge ${formatCurrency(total)} via ${payMethod}`}
        </Button>
      </Box>
    </Box>
  );
}

// ── MAIN PAGE ─────────────────────────────────────────────────────────────────
export default function BillingPOSPage() {
  const branchId = useAppSelector((s) => s.dashboard.selectedBranchId);
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [extraServices, setExtraServices] = useState<Record<number, ExtraService[]>>({});
  const [checkoutClients, setCheckoutClients] = useState<CheckoutClient[]>([]);
  const [activeCheckout, setActiveCheckout] = useState<CheckoutClient | null>(null);
  const [addServiceFor, setAddServiceFor] = useState<number | null>(null);

  const salonId = useAppSelector((s) => s.auth.user?.salon_id);

  useQueueSync(salonId, branchId);

  const { data: queueData, refetch: refetchQueue } = useGetQueueQuery(
    branchId ?? 0,
    { pollingInterval: 500, skip: !branchId, refetchOnFocus: true, refetchOnReconnect: true }
  );
  const today = dayjs().format('YYYY-MM-DD');
  const { data: apptData, refetch: refetchAppts } = useGetAppointmentsQuery(
    { branch_id: branchId, date_from: today, date_to: today, page_size: 100 } as any,
    { skip: !branchId, pollingInterval: 5_000, refetchOnFocus: true }
  );
  useGetServicesQuery({});
  const [createCheckIn] = useCreateCheckInMutation();
  const [updateStatus]  = useUpdateCheckInStatusMutation();

  const queue: any[]    = queueData?.queue ?? [];
  const allAppts: any[] = apptData?.items ?? [];

  const lobbyCheckins     = queue.filter((q) => q.status === 'Waiting' || q.status === 'CheckedIn');
  const inServiceCheckins = queue.filter((q) => q.status === 'InService');
  const checkedInApptIds  = new Set(queue.map((q: any) => q.appointment_id).filter(Boolean));
  const scheduledAppts    = allAppts.filter(
    (a: any) => a.status === 'Scheduled' && !checkedInApptIds.has(a.appointment_id)
  );
  const lobbyCount     = lobbyCheckins.length + scheduledAppts.length;
  const completedToday = queue.filter((q) => q.status === 'Completed').length;

  const handleCheckIn = async (appt: any) => {
    if (!branchId) return;
    try {
      await createCheckIn({
        branch_id: branchId, customer_id: appt.customer_id,
        service_id: appt.service_id, staff_id: appt.staff_id,
        appointment_id: appt.appointment_id,
      }).unwrap();
      toast.success(`${appt.customer_name} checked in`);
      refetchQueue(); refetchAppts();
    } catch (e: any) { toast.error(e?.data?.detail ?? 'Check-in failed'); }
  };

  const handleSeat = async (checkin: any) => {
    try {
      if (checkin.status === 'Waiting')
        await updateStatus({ id: checkin.checkin_id, data: { status:'CheckedIn' } }).unwrap();
      await updateStatus({ id: checkin.checkin_id, data: { status:'InService' } }).unwrap();
      toast.success(`${checkin.customer_name} seated`);
      refetchQueue();
    } catch (e: any) { toast.error(e?.data?.detail ?? 'Failed to seat'); }
  };

  const handleFinish = async (checkin: any) => {
    try {
      await updateStatus({ id: checkin.checkin_id, data: { status:'Completed' } }).unwrap();
      const extras = extraServices[checkin.checkin_id] ?? [];
      const client: CheckoutClient = {
        checkin_id: checkin.checkin_id, customer_id: checkin.customer_id,
        customer_name: checkin.customer_name ?? 'Walk-in', mobile: checkin.customer_mobile,
        branch_id: branchId ?? checkin.branch_id, staff_id: checkin.staff_id,
        appointment_id: checkin.appointment_id,
        services: [
          { service_id: checkin.service_id, name: checkin.service_name, price: checkin.service_price ?? 0 },
          ...extras,
        ],
      };
      setCheckoutClients((prev) => [...prev, client]);
      setActiveCheckout(client);
      setExtraServices((prev) => { const n = { ...prev }; delete n[checkin.checkin_id]; return n; });
      refetchQueue();
    } catch (e: any) { toast.error(e?.data?.detail ?? 'Failed to finish'); }
  };

  const handlePaymentDone = (checkinId: number) => {
    setCheckoutClients((prev) => prev.filter((c) => c.checkin_id !== checkinId));
    setActiveCheckout((prev) => prev?.checkin_id === checkinId ? null : prev);
  };

  const addExtra = (id: number, svc: ExtraService) =>
    setExtraServices((p) => ({ ...p, [id]: [...(p[id] ?? []), svc] }));
  const removeExtra = (id: number, svcId: number) =>
    setExtraServices((p) => ({ ...p, [id]: (p[id] ?? []).filter((s) => s.service_id !== svcId) }));

  // ── Layout ────────────────────────────────────────────────────────────────
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 72px)', overflow: 'hidden' }}>

      {/* ── Top bar ── */}
      <Box sx={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        px: 2.5, py: 1.5, bgcolor: '#fff',
        borderBottom: '1px solid #F0EBFF',
        flexShrink: 0,
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography fontWeight={800} fontSize={16} color="#1F2937">Billing &amp; POS</Typography>
          <Chip label={dayjs().format('ddd, MMM D')} size="small"
            sx={{ fontSize: 11, fontWeight: 600, bgcolor: '#F5F0FF', color: '#6C3FC5', height: 22 }} />
        </Box>

        {/* Live stat pills */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          {[
            { label: 'Waiting', count: lobbyCount, color: '#F97316', bg: '#FFF7ED' },
            { label: 'In Service', count: inServiceCheckins.length, color: '#7C3AED', bg: '#F5F3FF' },
            { label: 'Done today', count: completedToday, color: '#22C55E', bg: '#F0FDF4' },
          ].map((s) => (
            <Box key={s.label} sx={{
              display: 'flex', alignItems: 'center', gap: '5px',
              bgcolor: s.bg, borderRadius: '20px', px: '11px', py: '4px',
              border: `1px solid ${s.color}25`,
            }}>
              <Typography fontSize={14} fontWeight={900} sx={{ color: s.color }}>{s.count}</Typography>
              <Typography fontSize={11} fontWeight={600} sx={{ color: s.color }}>{s.label}</Typography>
            </Box>
          ))}

          <Button
            variant="contained" startIcon={<HowToReg sx={{ fontSize: 15 }} />}
            onClick={() => setCheckInOpen(true)}
            sx={{
              borderRadius: '20px', fontSize: 12, fontWeight: 700, textTransform: 'none',
              py: '6px', px: '16px', bgcolor: '#6C3FC5', '&:hover': { bgcolor: '#5a33a8' },
              boxShadow: '0 2px 8px rgba(108,63,197,.3)',
            }}>
            Check In
          </Button>
        </Box>
      </Box>

      {/* ── 3 columns ── */}
      <Box sx={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 320px',
        gap: 0,
        flex: 1,
        minHeight: 0,
        bgcolor: '#F9F7FF',
      }}>

        {/* ══ Column 1: Waiting Room ══ */}
        <Box sx={{
          display: 'flex', flexDirection: 'column', minHeight: 0,
          borderRight: '1px solid #EDE9FF',
        }}>
          {/* Column header */}
          <Box sx={{
            px: 2, py: 1.5, bgcolor: '#fff', borderBottom: '1px solid #F0EBFF',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#F97316' }} />
              <Typography fontWeight={700} fontSize={13} color="#1F2937">Waiting Room</Typography>
              <Box sx={{
                minWidth: 20, height: 20, borderRadius: '10px', px: '6px',
                bgcolor: '#FFF7ED', color: '#F97316', fontSize: 11, fontWeight: 800,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              }}>{lobbyCount}</Box>
            </Box>
            <Typography fontSize={11} color="#9CA3AF" fontWeight={500}>{lobbyCount} clients</Typography>
          </Box>

          {/* Scrollable list */}
          <Box sx={{
            flex: 1, overflowY: 'auto', px: 1.5, py: 1.5,
            '&::-webkit-scrollbar': { width: 4 },
            '&::-webkit-scrollbar-thumb': { bgcolor: '#E5E7EB', borderRadius: 4 },
          }}>
            {scheduledAppts.length > 0 && <SectionDivider label="Scheduled Today" />}
            {scheduledAppts.map((appt: any) => (
              <LobbyCard key={`appt-${appt.appointment_id}`}
                item={{ customer_name: appt.customer_name, service_name: appt.service_name,
                  service_price: appt.service_amount, wait_minutes: null }}
                isScheduled onCheckIn={() => handleCheckIn(appt)} onSeat={() => {}} />
            ))}
            {lobbyCheckins.length > 0 && <SectionDivider label="Checked In" />}
            {lobbyCheckins.map((c: any) => (
              <LobbyCard key={`ci-${c.checkin_id}`} item={c}
                isScheduled={false} onCheckIn={() => {}} onSeat={() => handleSeat(c)} />
            ))}
            {lobbyCount === 0 && (
              <Box sx={{ textAlign: 'center', py: 8 }}>
                <HourglassEmpty sx={{ fontSize: 40, color: '#E5E7EB', mb: 1 }} />
                <Typography fontSize={13} fontWeight={600} color="#9CA3AF">No clients waiting</Typography>
                <Typography fontSize={11} color="#D1D5DB" mt={0.5}>Walk-ins and bookings appear here</Typography>
              </Box>
            )}
          </Box>
        </Box>

        {/* ══ Column 2: In Service ══ */}
        <Box sx={{
          display: 'flex', flexDirection: 'column', minHeight: 0,
          borderRight: '1px solid #EDE9FF',
        }}>
          {/* Column header */}
          <Box sx={{
            px: 2, py: 1.5, bgcolor: '#fff', borderBottom: '1px solid #F0EBFF',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#7C3AED' }} />
              <Typography fontWeight={700} fontSize={13} color="#1F2937">In Service</Typography>
              <Box sx={{
                minWidth: 20, height: 20, borderRadius: '10px', px: '6px',
                bgcolor: '#F5F3FF', color: '#7C3AED', fontSize: 11, fontWeight: 800,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              }}>{inServiceCheckins.length}</Box>
            </Box>
            <Typography fontSize={11} color="#9CA3AF" fontWeight={500}>{inServiceCheckins.length} clients</Typography>
          </Box>

          {/* Scrollable list */}
          <Box sx={{
            flex: 1, overflowY: 'auto', px: 1.5, py: 1.5,
            '&::-webkit-scrollbar': { width: 4 },
            '&::-webkit-scrollbar-thumb': { bgcolor: '#E5E7EB', borderRadius: 4 },
          }}>
            {inServiceCheckins.map((c: any) => (
              <InServiceCard key={`is-${c.checkin_id}`} item={c}
                extras={extraServices[c.checkin_id] ?? []}
                onAddService={() => setAddServiceFor(c.checkin_id)}
                onRemoveExtra={(id) => removeExtra(c.checkin_id, id)}
                onFinish={() => handleFinish(c)} />
            ))}
            {inServiceCheckins.length === 0 && (
              <Box sx={{ textAlign: 'center', py: 8 }}>
                <ContentCut sx={{ fontSize: 40, color: '#E5E7EB', mb: 1 }} />
                <Typography fontSize={13} fontWeight={600} color="#9CA3AF">No clients in service</Typography>
                <Typography fontSize={11} color="#D1D5DB" mt={0.5}>Seat a client from Waiting Room</Typography>
              </Box>
            )}
          </Box>
        </Box>

        {/* ══ Column 3: Checkout ══ */}
        <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: 0, bgcolor: '#fff' }}>
          {/* Column header */}
          <Box sx={{
            px: 2, py: 1.5, bgcolor: '#fff', borderBottom: '1px solid #F0EBFF',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#22C55E' }} />
              <Typography fontWeight={700} fontSize={13} color="#1F2937">Checkout</Typography>
              {checkoutClients.length > 0 && (
                <Box sx={{
                  minWidth: 20, height: 20, borderRadius: '10px', px: '6px',
                  bgcolor: '#FEF2F2', color: '#EF4444', fontSize: 11, fontWeight: 800,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                }}>{checkoutClients.length}</Box>
              )}
            </Box>
            {/* Multi-client switcher */}
            {checkoutClients.length > 1 && (
              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                {checkoutClients.map((c) => (
                  <Chip key={c.checkin_id} label={c.customer_name.split(' ')[0]} size="small"
                    onClick={() => setActiveCheckout(c)}
                    color={activeCheckout?.checkin_id === c.checkin_id ? 'primary' : 'default'}
                    variant={activeCheckout?.checkin_id === c.checkin_id ? 'filled' : 'outlined'}
                    sx={{ fontSize: 11, height: 22, fontWeight: 700 }} />
                ))}
              </Box>
            )}
          </Box>

          {/* Checkout content */}
          <Box sx={{
            flex: 1, overflowY: 'auto', px: 2, py: 2,
            '&::-webkit-scrollbar': { width: 4 },
            '&::-webkit-scrollbar-thumb': { bgcolor: '#E5E7EB', borderRadius: 4 },
          }}>
            {activeCheckout ? (
              <CheckoutPanel key={activeCheckout.checkin_id} client={activeCheckout}
                onDone={() => handlePaymentDone(activeCheckout.checkin_id)} />
            ) : checkoutClients.length > 0 ? (
              <Box>
                <Typography fontSize={12} color="#9CA3AF" mb={1}>Select a client:</Typography>
                {checkoutClients.map((c) => (
                  <Paper key={c.checkin_id} elevation={0} onClick={() => setActiveCheckout(c)}
                    sx={{
                      p: 1.5, mb: 1, borderRadius: '12px', border: '1.5px solid #E5E7EB',
                      cursor: 'pointer', '&:hover': { borderColor: '#C4AEFF', bgcolor: '#FDFCFF' },
                      transition: 'all .12s',
                    }}>
                    <Typography fontWeight={700} fontSize={13}>{c.customer_name}</Typography>
                    <Typography variant="caption" color="text.secondary">{c.services.map((s) => s.name).join(', ')}</Typography>
                  </Paper>
                ))}
              </Box>
            ) : (
              <Box sx={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', height: '100%', textAlign: 'center', py: 6,
              }}>
                <Box sx={{
                  width: 60, height: 60, borderRadius: '50%', bgcolor: '#F9FAFB',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 2,
                  border: '2px dashed #E5E7EB',
                }}>
                  <ShoppingCart sx={{ fontSize: 26, color: '#D1D5DB' }} />
                </Box>
                <Typography fontSize={13} fontWeight={600} color="#9CA3AF">No pending payments</Typography>
                <Typography fontSize={11} color="#D1D5DB" mt={0.5}>Press <strong>Finish</strong> on a service to checkout</Typography>
              </Box>
            )}
          </Box>
        </Box>
      </Box>

      {/* Service catalog add-on dialog */}
      {addServiceFor !== null && (() => {
        const baseEntry = queue.find((q: any) => q.checkin_id === addServiceFor);
        const alreadyAdded: number[] = [
          ...(baseEntry?.service_id != null ? [baseEntry.service_id] : []),
          ...(extraServices[addServiceFor] ?? []).map((e) => e.service_id),
        ];
        return (
          <ServiceCatalogDialog open
            onClose={() => setAddServiceFor(null)}
            onSelect={(svc) => { addExtra(addServiceFor, svc); setAddServiceFor(null); }}
            alreadyAdded={alreadyAdded}
          />
        );
      })()}

      {/* Check-In dialog */}
      <CheckInDialog open={checkInOpen} onClose={() => setCheckInOpen(false)} />
    </Box>
  );
}
