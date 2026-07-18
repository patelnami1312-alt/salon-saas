import { useState } from 'react';
import {
  Box, Typography, Card, CardContent, Chip, Button, Divider,
  List, ListItem, ListItemAvatar, ListItemText, Avatar,
  Tab, Tabs, IconButton, Tooltip, Alert,
} from '@mui/material';
import {
  Notifications, NotificationsOff, CheckCircle, Info,
  Warning, Event, Person, Payments, DeleteOutline, DoneAll,
} from '@mui/icons-material';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
dayjs.extend(relativeTime);

type NType = 'appointment' | 'payment' | 'staff' | 'system';

interface Notification {
  id: number; type: NType; title: string; body: string;
  time: string; read: boolean;
}

const ICON_MAP: Record<NType, React.ReactElement> = {
  appointment: <Event sx={{ fontSize: 20 }} />,
  payment:     <Payments sx={{ fontSize: 20 }} />,
  staff:       <Person sx={{ fontSize: 20 }} />,
  system:      <Info sx={{ fontSize: 20 }} />,
};
const COLOR_MAP: Record<NType, string> = {
  appointment: '#6C3FC5', payment: '#22C55E', staff: '#3B82F6', system: '#F97316',
};

const SAMPLE: Notification[] = [
  { id: 1, type: 'appointment', title: 'New Booking', body: 'Sarah J. booked a Haircut for tomorrow at 2:00 PM', time: dayjs().subtract(5, 'minute').toISOString(), read: false },
  { id: 2, type: 'payment', title: 'Payment Received', body: 'Invoice #INV-0042 paid — $85.00 by John D.', time: dayjs().subtract(23, 'minute').toISOString(), read: false },
  { id: 3, type: 'appointment', title: 'Appointment Cancelled', body: 'Mike R. cancelled their 3:30 PM appointment', time: dayjs().subtract(1, 'hour').toISOString(), read: true },
  { id: 4, type: 'staff', title: 'Staff Check-In', body: 'Emily Chen checked in at 9:02 AM', time: dayjs().subtract(3, 'hour').toISOString(), read: true },
  { id: 5, type: 'system', title: 'Low Stock Alert', body: 'Keratin Treatment Shampoo is running low (2 units left)', time: dayjs().subtract(1, 'day').toISOString(), read: true },
];

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>(SAMPLE);
  const [tab, setTab] = useState(0);

  const unread = notifications.filter((n) => !n.read);
  const shown = tab === 0 ? notifications : unread;

  const markRead = (id: number) =>
    setNotifications((p) => p.map((n) => n.id === id ? { ...n, read: true } : n));

  const markAllRead = () =>
    setNotifications((p) => p.map((n) => ({ ...n, read: true })));

  const dismiss = (id: number) =>
    setNotifications((p) => p.filter((n) => n.id !== id));

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Notifications color="primary" />
            <Typography variant="h5" fontWeight={700}>Notifications</Typography>
            {unread.length > 0 && (
              <Chip label={unread.length} size="small" color="error" sx={{ height: 20, fontSize: 11, fontWeight: 700 }} />
            )}
          </Box>
          <Typography variant="body2" color="text.secondary">{notifications.length} total, {unread.length} unread</Typography>
        </Box>
        {unread.length > 0 && (
          <Button startIcon={<DoneAll />} variant="outlined" size="small" onClick={markAllRead}>
            Mark all read
          </Button>
        )}
      </Box>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Tab label="All" />
        <Tab label={`Unread (${unread.length})`} />
      </Tabs>

      {shown.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 10 }}>
          <NotificationsOff sx={{ fontSize: 56, color: '#D1D5DB', mb: 2 }} />
          <Typography variant="h6" fontWeight={600} color="text.secondary">
            {tab === 1 ? 'All caught up!' : 'No notifications'}
          </Typography>
          <Typography variant="body2" color="text.disabled" mt={1}>
            {tab === 1 ? 'No unread notifications right now' : 'Notifications will appear here'}
          </Typography>
        </Box>
      ) : (
        <Card>
          <List disablePadding>
            {shown.map((n, i) => {
              const color = COLOR_MAP[n.type];
              return (
                <Box key={n.id}>
                  <ListItem
                    alignItems="flex-start"
                    sx={{
                      px: 2.5, py: 1.75,
                      bgcolor: n.read ? 'transparent' : `${color}08`,
                      transition: 'background .15s',
                      '&:hover': { bgcolor: `${color}10` },
                    }}
                    secondaryAction={
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        {!n.read && (
                          <Tooltip title="Mark read">
                            <IconButton size="small" onClick={() => markRead(n.id)}>
                              <CheckCircle sx={{ fontSize: 16, color }} />
                            </IconButton>
                          </Tooltip>
                        )}
                        <Tooltip title="Dismiss">
                          <IconButton size="small" onClick={() => dismiss(n.id)}>
                            <DeleteOutline sx={{ fontSize: 16, color: '#9CA3AF' }} />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    }
                  >
                    <ListItemAvatar>
                      <Avatar sx={{ width: 38, height: 38, bgcolor: color + '20', color }}>
                        {ICON_MAP[n.type]}
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primaryTypographyProps={{ component: 'div' }}
                      secondaryTypographyProps={{ component: 'div' }}
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="body2" fontWeight={n.read ? 500 : 700}>{n.title}</Typography>
                          {!n.read && <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: color, flexShrink: 0 }} />}
                        </Box>
                      }
                      secondary={
                        <Box>
                          <Typography variant="caption" color="text.secondary" display="block">{n.body}</Typography>
                          <Typography variant="caption" sx={{ color: '#9CA3AF', fontSize: 11 }}>
                            {dayjs(n.time).fromNow()}
                          </Typography>
                        </Box>
                      }
                    />
                  </ListItem>
                  {i < shown.length - 1 && <Divider component="li" />}
                </Box>
              );
            })}
          </List>
        </Card>
      )}
    </Box>
  );
}
