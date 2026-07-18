import { useState } from 'react';
import {
  Box, Typography, Paper, Grid, Card, CardContent, Switch, FormControlLabel,
  TextField, Button, Divider, Chip, Alert, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, CircularProgress, Tab, Tabs,
  List, ListItem, ListItemText, ListItemSecondaryAction, Avatar,
} from '@mui/material';
import {
  Notifications, Cake, Campaign, Schedule, Email, Sms,
  CheckCircle, AccessTime, AutoAwesome,
} from '@mui/icons-material';
import { useSalon } from '@/context/SalonContext';

interface AutoRule {
  id: string;
  title: string;
  description: string;
  icon: React.ReactElement;
  color: string;
  channels: string[];
  enabled: boolean;
  timing?: string;
}

const defaultRules: AutoRule[] = [
  {
    id: 'reminder_24h',
    title: 'Appointment Reminder (24h)',
    description: 'Remind customers 24 hours before their appointment',
    icon: <Schedule />,
    color: '#2196F3',
    channels: ['SMS', 'Email'],
    enabled: true,
    timing: '24 hours before',
  },
  {
    id: 'reminder_1h',
    title: 'Appointment Reminder (1h)',
    description: 'Reminder 1 hour before the appointment',
    icon: <AccessTime />,
    color: '#9C27B0',
    channels: ['SMS'],
    enabled: true,
    timing: '1 hour before',
  },
  {
    id: 'birthday',
    title: 'Birthday Wishes',
    description: 'Send birthday greetings with a special discount code',
    icon: <Cake />,
    color: '#FF9800',
    channels: ['SMS', 'Email'],
    enabled: true,
    timing: 'On birthday',
  },
  {
    id: 'missed_followup',
    title: 'Missed Customer Follow-up',
    description: 'Auto-campaign for customers inactive for 30+ days',
    icon: <Campaign />,
    color: '#F44336',
    channels: ['SMS', 'Email'],
    enabled: false,
    timing: 'Every Monday',
  },
  {
    id: 'post_visit',
    title: 'Post-Visit Thank You',
    description: 'Thank you message after appointment completion',
    icon: <CheckCircle />,
    color: '#4CAF50',
    channels: ['SMS'],
    enabled: true,
    timing: '2 hours after',
  },
  {
    id: 'review_request',
    title: 'Review Request',
    description: 'Ask customers to leave a review after their visit',
    icon: <AutoAwesome />,
    color: '#FF6B35',
    channels: ['SMS', 'Email'],
    enabled: false,
    timing: '1 day after',
  },
];

const defaultTemplates: Record<string, string> = {
  reminder_24h: "Hi {name}! 👋 Reminder: You have a {service} appointment tomorrow at {time} at {salon}. Reply STOP to opt out.",
  reminder_1h: "Hi {name}! Your {service} appointment is in 1 hour at {time}. See you soon! — {salon}",
  birthday: "Happy Birthday {name}! 🎂 As a gift, enjoy 15% OFF any service today. Book now: {link}. — {salon}",
  missed_followup: "Hi {name}, we miss you at {salon}! It's been a while. Come back and enjoy 10% off your next visit. Book: {link}",
  post_visit: "Thank you {name} for visiting {salon} today! We hope you loved your {service}. See you next time! 💜",
  review_request: "Hi {name}! How was your visit to {salon}? Share your experience: {review_link}. It means a lot to us!",
};

const recentNotifications = [
  { name: 'Ashley Johnson', type: 'Reminder (24h)', channel: 'SMS', status: 'Sent', time: '2h ago' },
  { name: 'Brittany Williams', type: 'Birthday Wish', channel: 'Email', status: 'Sent', time: '3h ago' },
  { name: 'Chelsea Davis', type: 'Reminder (1h)', channel: 'SMS', status: 'Sent', time: '5h ago' },
  { name: 'Danielle Martinez', type: 'Post-Visit', channel: 'SMS', status: 'Sent', time: '1d ago' },
  { name: 'Emily Anderson', type: 'Reminder (24h)', channel: 'SMS', status: 'Failed', time: '1d ago' },
];

export default function AutomationPage() {
  const [tab, setTab] = useState(0);
  const [rules, setRules] = useState(defaultRules);
  const [templates, setTemplates] = useState(defaultTemplates);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const toggleRule = (id: string) => {
    setRules(prev => prev.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r));
  };

  const saveTemplates = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const enabledCount = rules.filter(r => r.enabled).length;

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <Notifications color="primary" sx={{ fontSize: 28 }} />
        <Typography variant="h5" fontWeight={700}>SMS & Email Automation</Typography>
        <Chip label={`${enabledCount} active`} size="small" color="success" />
      </Box>
      <Typography variant="body2" color="text.secondary" mb={3}>
        Automate customer communications to increase retention and bookings.
      </Typography>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Tab label="Automation Rules" icon={<Schedule />} iconPosition="start" />
        <Tab label="Message Templates" icon={<Sms />} iconPosition="start" />
        <Tab label="History" icon={<Notifications />} iconPosition="start" />
      </Tabs>

      {/* Tab 0: Rules */}
      {tab === 0 && (
        <Grid container spacing={2}>
          {rules.map((rule) => (
            <Grid item xs={12} sm={6} key={rule.id}>
              <Card sx={{ border: rule.enabled ? `2px solid ${rule.color}20` : undefined, opacity: rule.enabled ? 1 : 0.7 }}>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Box sx={{ display: 'flex', gap: 1.5 }}>
                      <Avatar sx={{ bgcolor: `${rule.color}20`, color: rule.color, width: 40, height: 40 }}>
                        {rule.icon}
                      </Avatar>
                      <Box>
                        <Typography fontWeight={700} variant="body1">{rule.title}</Typography>
                        <Typography variant="caption" color="text.secondary">{rule.description}</Typography>
                      </Box>
                    </Box>
                    <Switch
                      checked={rule.enabled}
                      onChange={() => toggleRule(rule.id)}
                      color="primary"
                      size="small"
                    />
                  </Box>
                  <Box sx={{ display: 'flex', gap: 1, mt: 1.5, flexWrap: 'wrap' }}>
                    {rule.channels.map((ch) => (
                      <Chip
                        key={ch}
                        label={ch}
                        size="small"
                        icon={ch === 'SMS' ? <Sms sx={{ fontSize: '14px !important' }} /> : <Email sx={{ fontSize: '14px !important' }} />}
                        variant="outlined"
                        color={ch === 'SMS' ? 'primary' : 'secondary'}
                      />
                    ))}
                    {rule.timing && (
                      <Chip label={rule.timing} size="small" icon={<AccessTime sx={{ fontSize: '14px !important' }} />} variant="outlined" />
                    )}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Tab 1: Templates */}
      {tab === 1 && (
        <Box>
          {saved && <Alert severity="success" sx={{ mb: 2 }}>Templates saved successfully!</Alert>}
          <Typography variant="body2" color="text.secondary" mb={2}>
            Variables: <code>{'{name}'}</code> <code>{'{service}'}</code> <code>{'{time}'}</code> <code>{'{salon}'}</code> <code>{'{link}'}</code>
          </Typography>
          {rules.map((rule) => (
            <Paper key={rule.id} variant="outlined" sx={{ p: 2, mb: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Avatar sx={{ bgcolor: `${rule.color}20`, color: rule.color, width: 32, height: 32 }}>
                    {rule.icon}
                  </Avatar>
                  <Typography fontWeight={600} variant="body2">{rule.title}</Typography>
                </Box>
                <Chip label={rule.enabled ? 'Active' : 'Inactive'} size="small" color={rule.enabled ? 'success' : 'default'} />
              </Box>
              <TextField
                fullWidth
                multiline
                rows={2}
                value={templates[rule.id] ?? ''}
                onChange={(e) => setTemplates(t => ({ ...t, [rule.id]: e.target.value }))}
                size="small"
                inputProps={{ style: { fontSize: 13, fontFamily: 'monospace' } }}
              />
              <Typography variant="caption" color="text.secondary" mt={0.5} display="block">
                {(templates[rule.id] ?? '').length} / 160 chars (SMS limit)
              </Typography>
            </Paper>
          ))}
          <Button variant="contained" onClick={saveTemplates} sx={{ mt: 1 }}>
            Save All Templates
          </Button>
        </Box>
      )}

      {/* Tab 2: History */}
      {tab === 2 && (
        <Paper>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Customer</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Channel</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Time</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {recentNotifications.map((n, i) => (
                  <TableRow key={i} hover>
                    <TableCell>{n.name}</TableCell>
                    <TableCell>{n.type}</TableCell>
                    <TableCell>
                      <Chip label={n.channel} size="small" icon={n.channel === 'SMS' ? <Sms sx={{ fontSize: '14px !important' }} /> : <Email sx={{ fontSize: '14px !important' }} />} variant="outlined" />
                    </TableCell>
                    <TableCell>
                      <Chip label={n.status} size="small" color={n.status === 'Sent' ? 'success' : 'error'} />
                    </TableCell>
                    <TableCell sx={{ color: 'text.secondary', fontSize: 12 }}>{n.time}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <Box sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="caption" color="text.secondary">
              Showing last 5 notifications. Full history available in Reports.
            </Typography>
          </Box>
        </Paper>
      )}
    </Box>
  );
}
