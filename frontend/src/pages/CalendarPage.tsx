import { useRef, useState, useCallback } from 'react';
import type { DatesSetArg, EventClickArg, EventDropArg } from '@fullcalendar/core';
import type { DateClickArg } from '@fullcalendar/interaction';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import {
  Box, Card, Typography, Button, Chip, Dialog, DialogTitle, DialogContent,
  DialogActions, Grid, CircularProgress, TextField, Autocomplete, Avatar,
  ToggleButton, ToggleButtonGroup, Stepper, Step, StepLabel, Divider,
  FormControl, InputLabel, Select, MenuItem, Alert,
} from '@mui/material';
import { Add, CalendarMonth, AccessTime, Person, ContentCut, CheckCircle } from '@mui/icons-material';
import dayjs from 'dayjs';
import toast from 'react-hot-toast';
import {
  useGetCalendarAppointmentsQuery,
  useUpdateAppointmentStatusMutation,
  useCancelAppointmentMutation,
  useGetAvailableSlotsQuery,
  useGetServicesQuery,
  useGetStaffQuery,
  useGetCustomersQuery,
  useCreateAppointmentMutation,
} from '@/features/api/apiSlice';
import { useAppSelector } from '@/app/hooks';
import type { Appointment, Customer, Service, Staff, TimeSlot } from '@/types';
import { useAppointmentSync } from '@/hooks/useAppointmentSync';

const STATUS_COLORS: Record<string, string> = {
  Scheduled: '#2196F3',
  Confirmed: '#4CAF50',
  CheckedIn: '#FF9800',
  InService: '#9C27B0',
  Completed: '#607D8B',
  Cancelled: '#F44336',
  NoShow: '#795548',
};

// ── Booking Dialog ──────────────────────────────────────────────────────────

interface BookingDialogProps {
  open: boolean;
  date: string;
  prefilledTime?: string;
  branchId: number;
  onClose: () => void;
  onBooked: () => void;
}

function BookingDialog({ open, date, prefilledTime, branchId, onClose, onBooked }: BookingDialogProps) {
  const [step, setStep] = useState(0);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);
  const [selectedTime, setSelectedTime] = useState<string>(prefilledTime || '');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [notes, setNotes] = useState('');

  const { data: services = [] } = useGetServicesQuery({});
  const { data: staffData } = useGetStaffQuery({ branch_id: branchId, page_size: 100 });
  const staffList: Staff[] = staffData?.items ?? [];

  const { data: slots = [], isFetching: slotsLoading } = useGetAvailableSlotsQuery(
    { branch_id: branchId, service_id: selectedService?.service_id ?? 0, date, staff_id: selectedStaff?.staff_id },
    { skip: !selectedService }
  );

  const { data: customersData } = useGetCustomersQuery(
    { search: customerSearch, page_size: 20 },
    { skip: customerSearch.length < 2 }
  );
  const customers: Customer[] = customersData?.items ?? [];

  const [createAppointment, { isLoading: booking }] = useCreateAppointmentMutation();

  const slotsArray: TimeSlot[] = Array.isArray(slots) ? slots : (slots as unknown as { slots?: TimeSlot[] })?.slots ?? [];
  const availableSlots = slotsArray.filter((s) => s.is_available);

  const handleBook = async () => {
    if (!selectedService || !selectedTime) return;
    const duration = selectedService.duration ?? 60;
    const end = dayjs(`${date} ${selectedTime}`).add(duration, 'minute').format('HH:mm:ss');
    try {
      await createAppointment({
        branch_id: branchId,
        customer_id: selectedCustomer?.customer_id ?? undefined,
        service_id: selectedService.service_id,
        staff_id: selectedStaff?.staff_id ?? undefined,
        appointment_date: date,
        start_time: selectedTime,
        end_time: end,
        notes: notes || undefined,
        booking_source: 'walk-in',
        status: 'Scheduled',
      } as Partial<Appointment>).unwrap();
      toast.success('Appointment booked!');
      onBooked();
      handleClose();
    } catch (err: unknown) {
      const msg = (err as { data?: { detail?: string } })?.data?.detail ?? 'Failed to book appointment';
      toast.error(msg);
    }
  };

  const handleClose = () => {
    setStep(0);
    setSelectedService(null);
    setSelectedStaff(null);
    setSelectedTime('');
    setSelectedCustomer(null);
    setCustomerSearch('');
    setNotes('');
    onClose();
  };

  const canGoNext = step === 0 ? !!selectedService : step === 1 ? !!selectedTime : true;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle sx={{ pb: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CalendarMonth color="primary" />
          <Box>
            <Typography variant="h6" fontWeight={700}>New Appointment</Typography>
            <Typography variant="caption" color="text.secondary">
              {dayjs(date).format('dddd, MMMM D, YYYY')}
            </Typography>
          </Box>
        </Box>
      </DialogTitle>

      <Box sx={{ px: 3, pt: 2 }}>
        <Stepper activeStep={step} alternativeLabel>
          {['Service', 'Time Slot', 'Customer'].map((label) => (
            <Step key={label}><StepLabel>{label}</StepLabel></Step>
          ))}
        </Stepper>
      </Box>

      <DialogContent sx={{ pt: 2 }}>

        {/* Step 0 — Service & Staff */}
        {step === 0 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant="subtitle2" color="text.secondary">Select a service</Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, maxHeight: 220, overflowY: 'auto' }}>
              {services.map((svc) => (
                <Chip
                  key={svc.service_id}
                  icon={<ContentCut sx={{ fontSize: 14 }} />}
                  label={`${svc.service_name} · ${svc.duration}min`}
                  clickable
                  onClick={() => setSelectedService(svc)}
                  variant={selectedService?.service_id === svc.service_id ? 'filled' : 'outlined'}
                  color={selectedService?.service_id === svc.service_id ? 'primary' : 'default'}
                  sx={{ fontWeight: selectedService?.service_id === svc.service_id ? 700 : 400 }}
                />
              ))}
            </Box>

            <Divider />

            <Typography variant="subtitle2" color="text.secondary">Preferred staff (optional)</Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              <Chip
                label="Any available"
                clickable
                onClick={() => setSelectedStaff(null)}
                variant={!selectedStaff ? 'filled' : 'outlined'}
                color={!selectedStaff ? 'primary' : 'default'}
              />
              {staffList.map((s) => (
                <Chip
                  key={s.staff_id}
                  avatar={<Avatar sx={{ width: 20, height: 20, fontSize: 10 }}>{s.first_name?.[0] ?? ''}</Avatar>}
                  label={s.full_name ?? `${s.first_name} ${s.last_name}`}
                  clickable
                  onClick={() => setSelectedStaff(s)}
                  variant={selectedStaff?.staff_id === s.staff_id ? 'filled' : 'outlined'}
                  color={selectedStaff?.staff_id === s.staff_id ? 'secondary' : 'default'}
                />
              ))}
            </Box>
          </Box>
        )}

        {/* Step 1 — Time Slots */}
        {step === 1 && (
          <Box>
            {slotsLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress size={32} />
              </Box>
            ) : availableSlots.length === 0 ? (
              <Alert severity="warning" sx={{ mt: 1 }}>
                No available slots for this date. Try a different day or staff member.
              </Alert>
            ) : (
              <>
                <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                  {availableSlots.length} slots available — pick a time
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, maxHeight: 280, overflowY: 'auto' }}>
                  {availableSlots.map((slot) => {
                    const label = dayjs(`${date} ${slot.start_time}`).format('h:mm A');
                    const active = selectedTime === slot.start_time;
                    return (
                      <Chip
                        key={slot.start_time}
                        icon={<AccessTime sx={{ fontSize: 14 }} />}
                        label={label}
                        clickable
                        onClick={() => setSelectedTime(slot.start_time)}
                        variant={active ? 'filled' : 'outlined'}
                        color={active ? 'primary' : 'default'}
                        sx={{ fontWeight: active ? 700 : 400, minWidth: 90 }}
                      />
                    );
                  })}
                </Box>
              </>
            )}
          </Box>
        )}

        {/* Step 2 — Customer & Notes */}
        {step === 2 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Autocomplete
              options={customers}
              getOptionLabel={(c) => `${c.full_name} · ${c.mobile}`}
              value={selectedCustomer}
              onChange={(_, v) => setSelectedCustomer(v)}
              inputValue={customerSearch}
              onInputChange={(_, v) => setCustomerSearch(v)}
              filterOptions={(x) => x}
              noOptionsText={customerSearch.length < 2 ? 'Type at least 2 characters' : 'No customers found'}
              renderInput={(params) => (
                <TextField {...params} label="Search customer" placeholder="Name or phone…" InputProps={{ ...params.InputProps, startAdornment: <Person sx={{ mr: 1, color: 'text.disabled' }} /> }} />
              )}
              renderOption={(props, c) => (
                <li {...props} key={c.customer_id}>
                  <Box>
                    <Typography variant="body2" fontWeight={600}>{c.full_name}</Typography>
                    <Typography variant="caption" color="text.secondary">{c.mobile}</Typography>
                  </Box>
                </li>
              )}
            />

            <TextField
              label="Notes (optional)"
              multiline
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any special requests…"
            />

            {/* Summary */}
            <Box sx={{ bgcolor: 'primary.50', border: '1px solid', borderColor: 'primary.200', borderRadius: 2, p: 2 }}>
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Booking Summary</Typography>
              <Grid container spacing={1}>
                <Grid item xs={6}><Typography variant="caption" color="text.secondary">Date</Typography>
                  <Typography variant="body2" fontWeight={600}>{dayjs(date).format('DD MMM YYYY')}</Typography></Grid>
                <Grid item xs={6}><Typography variant="caption" color="text.secondary">Time</Typography>
                  <Typography variant="body2" fontWeight={600}>{dayjs(`${date} ${selectedTime}`).format('h:mm A')}</Typography></Grid>
                <Grid item xs={6}><Typography variant="caption" color="text.secondary">Service</Typography>
                  <Typography variant="body2" fontWeight={600}>{selectedService?.service_name}</Typography></Grid>
                <Grid item xs={6}><Typography variant="caption" color="text.secondary">Staff</Typography>
                  <Typography variant="body2" fontWeight={600}>{selectedStaff ? (selectedStaff.full_name ?? `${selectedStaff.first_name}`) : 'Any available'}</Typography></Grid>
                {selectedCustomer && (
                  <Grid item xs={12}><Typography variant="caption" color="text.secondary">Customer</Typography>
                    <Typography variant="body2" fontWeight={600}>{selectedCustomer.full_name} · {selectedCustomer.mobile}</Typography></Grid>
                )}
              </Grid>
            </Box>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
        <Button onClick={handleClose} color="inherit">Cancel</Button>
        {step > 0 && <Button onClick={() => setStep(step - 1)}>Back</Button>}
        {step < 2 ? (
          <Button variant="contained" disabled={!canGoNext} onClick={() => setStep(step + 1)}>
            Next
          </Button>
        ) : (
          <Button
            variant="contained"
            color="primary"
            startIcon={booking ? <CircularProgress size={16} color="inherit" /> : <CheckCircle />}
            disabled={booking || !selectedService || !selectedTime}
            onClick={handleBook}
          >
            Book Appointment
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

// ── Main Calendar Page ──────────────────────────────────────────────────────

export default function CalendarPage() {
  const calendarRef = useRef<FullCalendar>(null);
  const branchId = useAppSelector((s) => s.dashboard.selectedBranchId) ?? undefined;
  const salonId = useAppSelector((s) => s.auth.user?.salon_id);
  const [dateRange, setDateRange] = useState({
    start: dayjs().startOf('week').format('YYYY-MM-DD'),
    end: dayjs().endOf('week').format('YYYY-MM-DD'),
  });

  // Live sync — patches RTK Query cache directly, no refetch
  useAppointmentSync(salonId, {
    branch_id: branchId,
    start_date: dateRange.start,
    end_date: dateRange.end,
  });
  const [selectedEvent, setSelectedEvent] = useState<EventClickArg['event'] | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [clickedDate, setClickedDate] = useState('');
  const [clickedTime, setClickedTime] = useState<string | undefined>(undefined);

  const { data: events = [], isLoading, refetch } = useGetCalendarAppointmentsQuery({
    branch_id: branchId,
    start_date: dateRange.start,
    end_date: dateRange.end,
  });

  const [updateStatus] = useUpdateAppointmentStatusMutation();
  const [cancelAppointment] = useCancelAppointmentMutation();

  const handleDatesSet = useCallback((info: DatesSetArg) => {
    setDateRange({
      start: dayjs(info.start).format('YYYY-MM-DD'),
      end: dayjs(info.end).format('YYYY-MM-DD'),
    });
  }, []);

  const handleDateClick = useCallback((info: DateClickArg) => {
    const d = dayjs(info.date);
    setClickedDate(d.format('YYYY-MM-DD'));
    // If click is on a specific time slot (not all-day), pre-fill the time
    setClickedTime(info.allDay ? undefined : d.format('HH:mm:ss'));
    setBookingOpen(true);
  }, []);

  const handleEventClick = useCallback((info: EventClickArg) => {
    setSelectedEvent(info.event);
    setDetailOpen(true);
  }, []);

  const handleEventDrop = useCallback(async (info: EventDropArg) => {
    const apptId = parseInt(info.event.id);
    const newDate = dayjs(info.event.start).format('YYYY-MM-DD');
    const newTime = dayjs(info.event.start).format('HH:mm:ss');
    try {
      await updateStatus({ id: apptId, data: { appointment_date: newDate, start_time: newTime } }).unwrap();
      toast.success('Appointment rescheduled');
      refetch();
    } catch (e: any) {
      info.revert();
      toast.error(e?.data?.detail ?? 'Failed to reschedule appointment');
    }
  }, [updateStatus, refetch]);

  const handleCancel = async () => {
    if (selectedEvent) {
      try {
        await cancelAppointment({ id: parseInt(selectedEvent.id), reason: 'Cancelled via calendar' }).unwrap();
        toast.success('Appointment cancelled');
        setDetailOpen(false);
        refetch();
      } catch (e: any) {
        toast.error(e?.data?.detail ?? 'Failed to cancel appointment');
      }
    }
  };

  const fcEvents = events.map((e) => ({
    id: String(e.id),
    title: e.title,
    start: e.start,
    end: e.end,
    backgroundColor: STATUS_COLORS[e.status] || '#9E9E9E',
    borderColor: STATUS_COLORS[e.status] || '#9E9E9E',
    extendedProps: e,
  }));

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Appointment Calendar</Typography>
          <Typography variant="body2" color="text.secondary">Click any date or time slot to book · Drag & drop to reschedule</Typography>
        </Box>
        <Button variant="contained" startIcon={<Add />} onClick={() => { setClickedDate(dayjs().format('YYYY-MM-DD')); setClickedTime(undefined); setBookingOpen(true); }}>
          New Appointment
        </Button>
      </Box>

      {/* Legend */}
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
        {Object.entries(STATUS_COLORS).map(([status, color]) => (
          <Chip
            key={status}
            label={status}
            size="small"
            sx={{ bgcolor: `${color}20`, color, borderColor: color, border: '1px solid' }}
          />
        ))}
      </Box>

      <Card sx={{ p: 0, overflow: 'hidden' }}>
        {isLoading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        )}
        <Box sx={{ p: 2 }}>
          <FullCalendar
            ref={calendarRef}
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView="timeGridWeek"
            headerToolbar={{
              left: 'prev,next today',
              center: 'title',
              right: 'dayGridMonth,timeGridWeek,timeGridDay',
            }}
            events={fcEvents}
            editable
            droppable
            selectable
            datesSet={handleDatesSet}
            dateClick={handleDateClick}
            eventClick={handleEventClick}
            eventDrop={handleEventDrop}
            slotMinTime="07:00:00"
            slotMaxTime="22:00:00"
            allDaySlot={false}
            height={650}
            eventTimeFormat={{ hour: '2-digit', minute: '2-digit', meridiem: 'short' }}
            slotDuration="00:30:00"
            nowIndicator
            businessHours={{
              daysOfWeek: [1, 2, 3, 4, 5, 6],
              startTime: '09:00',
              endTime: '20:00',
            }}
          />
        </Box>
      </Card>

      {/* Appointment Detail Dialog */}
      <Dialog open={detailOpen} onClose={() => setDetailOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle>Appointment Details</DialogTitle>
        <DialogContent>
          {selectedEvent && (
            <Box>
              <Chip
                label={selectedEvent.extendedProps?.status}
                size="small"
                sx={{
                  mb: 2,
                  bgcolor: `${STATUS_COLORS[selectedEvent.extendedProps?.status]}20`,
                  color: STATUS_COLORS[selectedEvent.extendedProps?.status],
                }}
              />
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">Customer</Typography>
                  <Typography variant="body2" fontWeight={600}>{selectedEvent.extendedProps?.customer_id || 'N/A'}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">Staff</Typography>
                  <Typography variant="body2" fontWeight={600}>{selectedEvent.extendedProps?.staff_id || 'Any'}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">Date</Typography>
                  <Typography variant="body2" fontWeight={600}>{dayjs(selectedEvent.start).format('DD MMM YYYY')}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">Time</Typography>
                  <Typography variant="body2" fontWeight={600}>
                    {dayjs(selectedEvent.start).format('h:mm A')} - {dayjs(selectedEvent.end).format('h:mm A')}
                  </Typography>
                </Grid>
                {selectedEvent.extendedProps?.notes && (
                  <Grid item xs={12}>
                    <Typography variant="caption" color="text.secondary">Notes</Typography>
                    <Typography variant="body2">{selectedEvent.extendedProps.notes}</Typography>
                  </Grid>
                )}
              </Grid>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDetailOpen(false)}>Close</Button>
          <Button
            color="success"
            variant="outlined"
            onClick={() => {
              if (selectedEvent) updateStatus({ id: parseInt(selectedEvent.id), data: { status: 'Confirmed' } });
              setDetailOpen(false);
            }}
          >
            Confirm
          </Button>
          <Button color="error" variant="outlined" onClick={handleCancel}>Cancel</Button>
        </DialogActions>
      </Dialog>

      {/* Booking Dialog */}
      {bookingOpen && (
        <BookingDialog
          open={bookingOpen}
          date={clickedDate}
          prefilledTime={clickedTime}
          branchId={branchId ?? 0}
          onClose={() => setBookingOpen(false)}
          onBooked={() => { refetch(); setBookingOpen(false); }}
        />
      )}
    </Box>
  );
}
