import { useEffect, useRef, useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { apiSlice } from '@/features/api/apiSlice';

export interface CalendarQueryArgs {
  branch_id: number | undefined;
  start_date: string;
  end_date: string;
}

/**
 * Subscribes to the WebSocket appointment sync stream and patches the RTK Query
 * calendar cache in-place — changes arrive in < 200ms (outbox relay cycle).
 *
 * Version reconciliation: events with equal-or-lower version than the cached
 * appointment are ignored, handling echoes of own optimistic writes and stale
 * out-of-order events.
 *
 * Reconnect resync: on every reconnect the Appointment tag is invalidated so
 * RTK Query triggers a fresh fetch — catches all events missed while offline.
 */
export function useAppointmentSync(
  salonId: number | null | undefined,
  calendarArgs: CalendarQueryArgs,
) {
  const dispatch = useDispatch();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectDelay = useRef(1000);
  const calendarArgsRef = useRef(calendarArgs);
  calendarArgsRef.current = calendarArgs;

  const patchCache = useCallback((eventType: string, appt: any) => {
    const args = calendarArgsRef.current;
    if (!args.branch_id) return;

    const apptDate = appt.start?.split('T')[0];
    if (!apptDate) return;

    const inRange = apptDate >= args.start_date && apptDate <= args.end_date;
    const sameBranch = appt.branch_id === args.branch_id;
    if (!inRange || !sameBranch) return;

    dispatch(
      (apiSlice.util.updateQueryData as any)(
        'getCalendarAppointments',
        { branch_id: args.branch_id, start_date: args.start_date, end_date: args.end_date },
        (draft: any[]) => {
          if (eventType === 'created') {
            if (!draft.find((e) => e.id === appt.id)) {
              draft.push(appt);
            }
          } else if (eventType === 'updated') {
            const idx = draft.findIndex((e) => e.id === appt.id);
            if (idx < 0) {
              // Not yet in cache — insert (handles race between broadcast and initial fetch)
              draft.push(appt);
            } else {
              // Version guard: skip stale or echo events
              const existing = draft[idx];
              if (appt.version && existing.version && appt.version <= existing.version) return;
              Object.assign(draft[idx], appt);
            }
          } else if (eventType === 'cancelled') {
            const idx = draft.findIndex((e) => e.id === appt.id);
            if (idx >= 0) draft.splice(idx, 1);
          }
        },
      ),
    );
  }, [dispatch]);

  const resync = useCallback(() => {
    // Invalidate the Appointment tag so RTK Query refetches on next render
    dispatch((apiSlice.util.invalidateTags as any)(['Appointment']));
  }, [dispatch]);

  const connect = useCallback(() => {
    if (!salonId) return;
    const token = localStorage.getItem('access_token');
    if (!token) return;

    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${proto}//${window.location.host}/ws/appointments?token=${encodeURIComponent(token)}&salon_id=${salonId}`;

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      reconnectDelay.current = 1000;
    };

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type?.startsWith('appointment.')) {
          patchCache(msg.type.slice('appointment.'.length), msg.appointment);
        }
      } catch { /* malformed frame — ignore */ }
    };

    ws.onclose = () => {
      // Resync on disconnect — catches events missed while offline
      resync();
      reconnectRef.current = setTimeout(() => {
        reconnectDelay.current = Math.min(reconnectDelay.current * 2, 30_000);
        connect();
      }, reconnectDelay.current);
    };

    ws.onerror = () => ws.close();
  }, [salonId, patchCache, resync]);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [connect]);
}
