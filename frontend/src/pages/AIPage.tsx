import { useState } from 'react';
import {
  Box, Typography, Paper, Grid, Card, CardContent, Button, TextField,
  CircularProgress, Alert, Chip, Avatar, List, ListItem, ListItemText,
  ListItemAvatar, Divider, Tab, Tabs, MenuItem, LinearProgress,
} from '@mui/material';
import {
  AutoAwesome, Campaign, Warning, CalendarMonth, Person,
  TrendingDown, CheckCircle, SmartToy,
} from '@mui/icons-material';
import {
  useGetAIAppointmentSuggestionMutation, useGenerateAICampaignMutation,
  useGetRetentionAlertsQuery,
} from '@/features/api/apiSlice';
import { useSalon } from '@/context/SalonContext';

function AppointmentAssistant() {
  const [form, setForm] = useState({ customer_name: '', preferred_services: '', date_preference: '', special_requests: '' });
  const [suggest, { isLoading, data }] = useGetAIAppointmentSuggestionMutation();

  const handleSubmit = () => suggest(form);

  return (
    <Box>
      <Typography variant="h6" fontWeight={600} mb={2} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <AutoAwesome color="primary" /> Appointment Assistant
      </Typography>
      <Typography variant="body2" color="text.secondary" mb={3}>
        Describe the customer's needs and get AI-powered service recommendations.
      </Typography>
      <Grid container spacing={2}>
        <Grid item xs={12} sm={6}>
          <TextField label="Customer Name" fullWidth value={form.customer_name} onChange={e => setForm(f => ({ ...f, customer_name: e.target.value }))} size="small" />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField label="Date Preference" fullWidth value={form.date_preference} onChange={e => setForm(f => ({ ...f, date_preference: e.target.value }))} size="small" placeholder="e.g. Saturday afternoon" />
        </Grid>
        <Grid item xs={12}>
          <TextField label="Preferred Services / Hair Type" fullWidth value={form.preferred_services} onChange={e => setForm(f => ({ ...f, preferred_services: e.target.value }))} size="small" placeholder="e.g. balayage, long hair, first time coloring" />
        </Grid>
        <Grid item xs={12}>
          <TextField label="Special Requests / Notes" fullWidth multiline rows={2} value={form.special_requests} onChange={e => setForm(f => ({ ...f, special_requests: e.target.value }))} size="small" />
        </Grid>
        <Grid item xs={12}>
          <Button variant="contained" startIcon={isLoading ? <CircularProgress size={16} color="inherit" /> : <AutoAwesome />} onClick={handleSubmit} disabled={isLoading}>
            Get AI Recommendations
          </Button>
        </Grid>
      </Grid>
      {data?.suggestion && (
        <Paper sx={{ mt: 3, p: 2.5, bgcolor: '#f9f4ff', border: '1px solid #9B72E8' }}>
          <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
            <SmartToy color="primary" fontSize="small" />
            <Typography variant="subtitle2" fontWeight={600} color="primary">AI Recommendation</Typography>
          </Box>
          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{data.suggestion}</Typography>
        </Paper>
      )}
    </Box>
  );
}

function CampaignGenerator() {
  const [form, setForm] = useState({ campaign_type: 'retention', target_segment: '', offer_details: '', tone: 'friendly' });
  const [generate, { isLoading, data }] = useGenerateAICampaignMutation();

  const campaign = data?.campaign;

  return (
    <Box>
      <Typography variant="h6" fontWeight={600} mb={2} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Campaign color="primary" /> Campaign Generator
      </Typography>
      <Typography variant="body2" color="text.secondary" mb={3}>
        Generate targeted marketing campaigns with AI-crafted messaging.
      </Typography>
      <Grid container spacing={2}>
        <Grid item xs={12} sm={4}>
          <TextField select label="Campaign Type" fullWidth value={form.campaign_type} onChange={e => setForm(f => ({ ...f, campaign_type: e.target.value }))} size="small">
            <MenuItem value="retention">Win-Back / Retention</MenuItem>
            <MenuItem value="promo">Service Promotion</MenuItem>
            <MenuItem value="birthday">Birthday Special</MenuItem>
            <MenuItem value="reactivation">Reactivation</MenuItem>
          </TextField>
        </Grid>
        <Grid item xs={12} sm={4}>
          <TextField select label="Tone" fullWidth value={form.tone} onChange={e => setForm(f => ({ ...f, tone: e.target.value }))} size="small">
            <MenuItem value="friendly">Friendly</MenuItem>
            <MenuItem value="professional">Professional</MenuItem>
            <MenuItem value="urgent">Urgent</MenuItem>
            <MenuItem value="exclusive">Exclusive/Luxury</MenuItem>
          </TextField>
        </Grid>
        <Grid item xs={12} sm={4}>
          <TextField label="Target Segment" fullWidth value={form.target_segment} onChange={e => setForm(f => ({ ...f, target_segment: e.target.value }))} size="small" placeholder="e.g. VIP customers" />
        </Grid>
        <Grid item xs={12}>
          <TextField label="Offer Details" fullWidth value={form.offer_details} onChange={e => setForm(f => ({ ...f, offer_details: e.target.value }))} size="small" placeholder="e.g. 20% off any service, complimentary blowout" />
        </Grid>
        <Grid item xs={12}>
          <Button variant="contained" startIcon={isLoading ? <CircularProgress size={16} color="inherit" /> : <Campaign />} onClick={() => generate(form)} disabled={isLoading}>
            Generate Campaign
          </Button>
        </Grid>
      </Grid>

      {campaign && (
        <Box mt={3}>
          {campaign.raw_response ? (
            <Paper sx={{ p: 2, bgcolor: '#f9f4ff' }}>
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{campaign.raw_response}</Typography>
            </Paper>
          ) : (
            <Grid container spacing={2}>
              {campaign.subject_line && (
                <Grid item xs={12}>
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>EMAIL SUBJECT</Typography>
                    <Typography fontWeight={700}>{campaign.subject_line}</Typography>
                  </Paper>
                </Grid>
              )}
              {campaign.sms_message && (
                <Grid item xs={12} md={6}>
                  <Paper variant="outlined" sx={{ p: 2, height: '100%' }}>
                    <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>SMS (160 chars)</Typography>
                    <Typography variant="body2">{campaign.sms_message}</Typography>
                  </Paper>
                </Grid>
              )}
              {campaign.email_body && (
                <Grid item xs={12} md={6}>
                  <Paper variant="outlined" sx={{ p: 2, height: '100%' }}>
                    <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>EMAIL BODY</Typography>
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{campaign.email_body}</Typography>
                  </Paper>
                </Grid>
              )}
              {campaign.cta_text && (
                <Grid item xs={12}>
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>CTA BUTTON</Typography>
                    <Button variant="contained" size="small">{campaign.cta_text}</Button>
                  </Paper>
                </Grid>
              )}
            </Grid>
          )}
        </Box>
      )}
    </Box>
  );
}

function RetentionAlerts() {
  const { formatCurrency } = useSalon();
  const [days, setDays] = useState(30);
  const { data, isLoading } = useGetRetentionAlertsQuery({ days_inactive: days, limit: 20 });

  return (
    <Box>
      <Typography variant="h6" fontWeight={600} mb={2} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Warning color="warning" /> At-Risk Customer Alerts
      </Typography>
      <Box sx={{ display: 'flex', gap: 2, mb: 3, alignItems: 'center' }}>
        <TextField
          select label="Inactive for" value={days} onChange={e => setDays(Number(e.target.value))}
          size="small" sx={{ width: 150 }}
        >
          <MenuItem value={14}>14 days</MenuItem>
          <MenuItem value={30}>30 days</MenuItem>
          <MenuItem value={60}>60 days</MenuItem>
          <MenuItem value={90}>90 days</MenuItem>
        </TextField>
        {data && (
          <Chip label={`${data.total_at_risk} at-risk customers`} color="warning" icon={<TrendingDown />} />
        )}
      </Box>

      {isLoading && <LinearProgress />}

      {data?.ai_insight && (
        <Paper sx={{ p: 2.5, mb: 3, bgcolor: '#fff8e1', border: '1px solid #FFB300' }}>
          <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
            <SmartToy sx={{ color: '#FF8F00' }} fontSize="small" />
            <Typography variant="subtitle2" fontWeight={600} sx={{ color: '#FF8F00' }}>AI Insight</Typography>
          </Box>
          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{data.ai_insight}</Typography>
        </Paper>
      )}

      <List>
        {(data?.at_risk_customers ?? []).map((c, i) => (
          <Box key={c.customer_id}>
            <ListItem alignItems="flex-start">
              <ListItemAvatar>
                <Avatar sx={{ bgcolor: c.days_since_visit > 60 ? 'error.main' : 'warning.main' }}>
                  {c.name.charAt(0)}
                </Avatar>
              </ListItemAvatar>
              <ListItemText
                primary={
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography fontWeight={600}>{c.name}</Typography>
                    <Chip
                      label={`${c.days_since_visit}d inactive`}
                      size="small"
                      color={c.days_since_visit > 60 ? 'error' : 'warning'}
                    />
                  </Box>
                }
                secondary={
                  <Box sx={{ display: 'flex', gap: 2, mt: 0.5 }}>
                    <Typography variant="caption">{c.mobile}</Typography>
                    <Typography variant="caption">{c.total_visits} visits</Typography>
                    <Typography variant="caption" color="success.main">{formatCurrency(c.total_spent)} spent</Typography>
                    <Typography variant="caption">{c.loyalty_points} pts</Typography>
                  </Box>
                }
              />
            </ListItem>
            {i < (data?.at_risk_customers ?? []).length - 1 && <Divider variant="inset" component="li" />}
          </Box>
        ))}
        {!isLoading && (data?.at_risk_customers ?? []).length === 0 && (
          <ListItem>
            <Alert severity="success" icon={<CheckCircle />} sx={{ width: '100%' }}>
              No at-risk customers for this period. Great retention!
            </Alert>
          </ListItem>
        )}
      </List>
    </Box>
  );
}

export default function AIPage() {
  const [tab, setTab] = useState(0);

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <SmartToy color="primary" sx={{ fontSize: 28 }} />
        <Typography variant="h5" fontWeight={700}>AI Features</Typography>
        <Chip label="Powered by Claude" size="small" sx={{ bgcolor: '#9B72E8', color: '#fff' }} />
      </Box>
      <Typography variant="body2" color="text.secondary" mb={3}>
        AI-powered tools to grow your salon business and enhance customer experience.
      </Typography>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Tab label="Appointment Assistant" icon={<AutoAwesome />} iconPosition="start" />
        <Tab label="Campaign Generator" icon={<Campaign />} iconPosition="start" />
        <Tab label="Retention Alerts" icon={<Warning />} iconPosition="start" />
      </Tabs>

      <Paper sx={{ p: 3 }}>
        {tab === 0 && <AppointmentAssistant />}
        {tab === 1 && <CampaignGenerator />}
        {tab === 2 && <RetentionAlerts />}
      </Paper>
    </Box>
  );
}
