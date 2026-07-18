import React, { memo, useState } from 'react';
import {
  Box, Grid, Card, CardContent, Typography, Button,
  Avatar, Chip, Divider, IconButton, Badge, CircularProgress,
} from '@mui/material';
import {
  Add, HowToReg, PlayArrow,
  CheckCircle, Cancel, Refresh, QueuePlayNext, Timer,
  HourglassEmpty, ContentCut, PeopleAlt,
} from '@mui/icons-material';
import { useGetQueueQuery, useUpdateCheckInStatusMutation } from '@/features/api/apiSlice';
import { useAppSelector } from '@/app/hooks';
import toast from 'react-hot-toast';
import PhoneCheckInDialog from '@/components/PhoneCheckInDialog';
import type { CheckIn, CheckInStatus } from '@/types';

const STATUS_CONFIG: Record<CheckInStatus, { label: string; color: string; bgcolor: string }> = {
  Waiting: { label: 'Waiting', color: '#FF9800', bgcolor: '#FFF3E0' },
  CheckedIn: { label: 'Checked In', color: '#2196F3', bgcolor: '#E3F2FD' },
  InService: { label: 'In Service', color: '#9C27B0', bgcolor: '#F3E5F5' },
  Completed: { label: 'Completed', color: '#4CAF50', bgcolor: '#E8F5E9' },
  Cancelled: { label: 'Cancelled', color: '#F44336', bgcolor: '#FFEBEE' },
};

const QueueCard = memo(function QueueCard({ checkin, onStatusUpdate }: { checkin: CheckIn; onStatusUpdate: (id: number, status: string) => void }) {
  const config = STATUS_CONFIG[checkin.status];

  const nextAction: Partial<Record<CheckInStatus, { label: string; status: string; icon: React.ReactElement }>> = {
    Waiting: { label: 'Check In', status: 'CheckedIn', icon: <HowToReg /> },
    CheckedIn: { label: 'Start Service', status: 'InService', icon: <PlayArrow /> },
    InService: { label: 'Complete', status: 'Completed', icon: <CheckCircle /> },
  };
  const action = nextAction[checkin.status];

  return (
    <Card
      sx={{
        borderLeft: `4px solid ${config.color}`,
        transition: '0.2s',
        '&:hover': { transform: 'translateY(-1px)', boxShadow: 3 },
      }}
    >
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Badge badgeContent={checkin.queue_number} color="primary" sx={{ '& .MuiBadge-badge': { fontSize: 11, fontWeight: 700 } }}>
              <Avatar sx={{ width: 40, height: 40, bgcolor: config.color + '30', color: config.color, fontWeight: 700 }}>
                {checkin.customer_name?.[0] || '?'}
              </Avatar>
            </Badge>
            <Box>
              <Typography variant="body2" fontWeight={700}>{checkin.customer_name || 'Walk-in'}</Typography>
              <Typography variant="caption" color="text.secondary">{checkin.customer_mobile}</Typography>
            </Box>
          </Box>
          <Chip
            label={config.label}
            size="small"
            sx={{ bgcolor: config.bgcolor, color: config.color, fontWeight: 600, fontSize: 11 }}
          />
        </Box>

        <Divider sx={{ my: 1.5 }} />

        <Box sx={{ display: 'flex', gap: 2, mb: 1.5 }}>
          <Box>
            <Typography variant="caption" color="text.secondary">Service</Typography>
            <Typography variant="body2" fontWeight={500}>{checkin.service_name}</Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">Staff</Typography>
            <Typography variant="body2" fontWeight={500}>{checkin.staff_name || 'Any'}</Typography>
          </Box>
          {checkin.wait_minutes !== null && (
            <Box sx={{ ml: 'auto' }}>
              <Typography variant="caption" color="text.secondary">Wait</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
                <Timer sx={{ fontSize: 14, color: checkin.wait_minutes > 30 ? '#F44336' : '#4CAF50' }} />
                <Typography variant="body2" fontWeight={600} color={checkin.wait_minutes > 30 ? 'error' : 'success.main'}>
                  {checkin.wait_minutes}m
                </Typography>
              </Box>
            </Box>
          )}
        </Box>

        <Box sx={{ display: 'flex', gap: 1 }}>
          {action && (
            <Button
              size="small"
              variant="contained"
              startIcon={action.icon}
              onClick={() => onStatusUpdate(checkin.checkin_id, action.status)}
              sx={{ flex: 1, fontSize: 12 }}
            >
              {action.label}
            </Button>
          )}
          {checkin.status !== 'Completed' && checkin.status !== 'Cancelled' && (
            <IconButton
              size="small"
              color="error"
              onClick={() => onStatusUpdate(checkin.checkin_id, 'Cancelled')}
            >
              <Cancel fontSize="small" />
            </IconButton>
          )}
        </Box>
      </CardContent>
    </Card>
  );
});

export default function CheckInPage() {
  const branchId = useAppSelector((s) => s.dashboard.selectedBranchId) ?? undefined;
  const [walkInOpen, setWalkInOpen] = useState(false);

  const { data: queueData, isLoading, refetch } = useGetQueueQuery(branchId ?? 0, { skip: !branchId });
  const [updateStatus] = useUpdateCheckInStatusMutation();

  const queue = queueData?.queue || [];

  const queueByStatus = {
    waiting: queue.filter((c) => c.status === 'Waiting'),
    inService: queue.filter((c) => c.status === 'InService' || c.status === 'CheckedIn'),
    completed: queue.filter((c) => c.status === 'Completed'),
  };

  const handleStatusUpdate = async (id: number, newStatus: string) => {
    try {
      await updateStatus({ id, data: { status: newStatus } }).unwrap();
      const labels: Record<string, string> = {
        InService: 'Service started',
        Completed: 'Marked as completed',
        Cancelled: 'Check-in cancelled',
        Waiting: 'Moved to waiting',
      };
      toast.success(labels[newStatus] ?? 'Status updated');
      refetch();
    } catch {
      toast.error('Failed to update status');
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Reception / Check-In</Typography>
          <Typography variant="body2" color="text.secondary">
            {queue.filter(c => c.status !== 'Completed' && c.status !== 'Cancelled').length} in queue
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="outlined" startIcon={<Refresh />} size="small" onClick={() => refetch()}>
            Refresh
          </Button>
          <Button variant="contained" startIcon={<Add />} onClick={() => setWalkInOpen(true)}>
            Walk-In
          </Button>
        </Box>
      </Box>

      {/* Summary Cards */}
      <Grid container spacing={2} mb={3}>
        {[
          { label: 'Waiting', count: queueByStatus.waiting.length, color: '#FF9800', bgcolor: '#FFF3E0', icon: <HourglassEmpty /> },
          { label: 'In Service', count: queueByStatus.inService.length, color: '#9C27B0', bgcolor: '#F3E5F5', icon: <ContentCut /> },
          { label: 'Completed Today', count: queueByStatus.completed.length, color: '#4CAF50', bgcolor: '#E8F5E9', icon: <CheckCircle /> },
          { label: 'Total Queue', count: queue.length, color: '#2196F3', bgcolor: '#E3F2FD', icon: <PeopleAlt /> },
        ].map((s) => (
          <Grid item xs={6} sm={3} key={s.label}>
            <Card sx={{ bgcolor: s.bgcolor, border: `1px solid ${s.color}30` }}>
              <CardContent sx={{ py: 2, px: 2.5, '&:last-child': { pb: 2 } }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="h3" fontWeight={800} sx={{ color: s.color, lineHeight: 1 }}>{s.count}</Typography>
                  <Box sx={{ color: s.color, opacity: 0.6, '& svg': { fontSize: 28 } }}>{s.icon}</Box>
                </Box>
                <Typography variant="body2" fontWeight={600} sx={{ color: s.color }}>{s.label}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Queue Grid */}
      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}>
          <CircularProgress />
        </Box>
      ) : queue.length === 0 ? (
        <Card>
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <QueuePlayNext sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary">Queue is empty</Typography>
            <Typography color="text.secondary" variant="body2" mb={3}>Add a walk-in customer to get started</Typography>
            <Button variant="contained" startIcon={<Add />} onClick={() => setWalkInOpen(true)}>
              Add Walk-In
            </Button>
          </Box>
        </Card>
      ) : (
        <Grid container spacing={2}>
          {queue
            .filter(c => c.status !== 'Completed' && c.status !== 'Cancelled')
            .sort((a, b) => (a.queue_number ?? 0) - (b.queue_number ?? 0))
            .map((checkin) => (
              <Grid item xs={12} sm={6} lg={4} key={checkin.checkin_id}>
                <QueueCard checkin={checkin} onStatusUpdate={handleStatusUpdate} />
              </Grid>
            ))}
        </Grid>
      )}

      {/* Walk-In Dialog */}
      <PhoneCheckInDialog
        open={walkInOpen}
        onClose={() => setWalkInOpen(false)}
        branchId={branchId ?? null}
        onCheckedIn={refetch}
      />
    </Box>
  );
}
