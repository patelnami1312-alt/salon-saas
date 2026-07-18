import { useEffect, useRef, useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { apiSlice } from '@/features/api/apiSlice';

/**
 * Subscribes to the existing /ws/appointments WebSocket and patches the
 * RTK Query `getQueue` cache in-place on every checkin.created / checkin.updated
 * event — delivering sub-100ms queue updates without polling.
 */
export function useQueueSync(
  salonId: number | null | undefined,
  branchId: number | null | undefined,
) {
  const dispatch = useDispatch();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectDelay = useRef(1000);
  const branchIdRef = useRef(branchId);
  branchIdRef.current = branchId;

  const patchCache = useCallback((eventType: string, checkin: any) => {
    const bid = branchIdRef.current;
    if (!bid || checkin.branch_id !== bid) return;

    dispatch(
      (apiSlice.util.updateQueryData as any)(
        'getQueue',
        bid,
        (draft: { queue: any[]; total: number }) => {
          const q = draft.queue;

          if (eventType === 'created') {
            if (!q.find((c) => c.checkin_id === checkin.checkin_id)) {
              q.push(checkin);
              draft.total = q.length;
            }
            return;
          }

          const idx = q.findIndex((c) => c.checkin_id === checkin.checkin_id);

          if (eventType === 'updated') {
            if (checkin.status === 'Completed' || checkin.status === 'Cancelled') {
              // Remove from visible queue
              if (idx >= 0) { q.splice(idx, 1); draft.total = q.length; }
            } else {
              // Update in-place
              if (idx >= 0) Object.assign(q[idx], checkin);
            }
          }
        },
      ),
    );
  }, [dispatch]);

  const connect = useCallback(() => {
    if (!salonId) return;
    const token = localStorage.getItem('access_token');
    if (!token) return;

    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${proto}//${window.location.host}/ws/appointments?token=${encodeURIComponent(token)}&salon_id=${salonId}`;

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => { reconnectDelay.current = 1000; };

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type?.startsWith('checkin.')) {
          patchCache(msg.type.slice('checkin.'.length), msg.checkin);
        }
      } catch { /* malformed frame — ignore */ }
    };

    ws.onclose = () => {
      reconnectRef.current = setTimeout(() => {
        reconnectDelay.current = Math.min(reconnectDelay.current * 2, 30_000);
        connect();
      }, reconnectDelay.current);
    };

    ws.onerror = () => ws.close();
  }, [salonId, patchCache]);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [connect]);
}
