import { http, HttpResponse } from 'msw';
import type { SalonSettings } from '@/context/SalonContext';

const BASE = '/api/v1';

const salonSettings: SalonSettings = {
  salon_id: 1,
  salon_name: 'Test Salon',
  email: 'test@salon.com',
  phone: '555-0100',
  address: '123 Test St',
  currency: 'USD',
  timezone: 'UTC',
  locale: 'en-US',
  date_format: 'MMM D, YYYY',
  time_format: '12h',
  tax_percent: 0,
  loyalty_points_per_currency: 1,
  loyalty_points_redemption_rate: 0.01,
  appointment_reminder: true,
  birthday_wishes: true,
  marketing_emails: false,
  sms_alerts: true,
};

export const defaultHandlers = [
  // Salon settings — fetched by SalonContext on mount
  http.get(`${BASE}/salon/settings`, () => HttpResponse.json(salonSettings)),

  // Dashboard
  http.get(`${BASE}/reports/dashboard`, () =>
    HttpResponse.json({
      today_revenue: 1200,
      today_appointments: 8,
      total_customers: 350,
      in_queue: 3,
      weekly_revenue: 8400,
      monthly_revenue: 36000,
      pending_appointments: 2,
      new_customers_today: 2,
    })
  ),
  http.get(`${BASE}/reports/revenue`, () =>
    HttpResponse.json({ data: [] })
  ),

  // Customers
  http.get(`${BASE}/customers`, () =>
    HttpResponse.json({ items: [], total: 0 })
  ),
  http.post(`${BASE}/customers`, async ({ request }) => {
    const body = await request.json() as Record<string, unknown>;
    return HttpResponse.json(
      { customer_id: 99, first_name: body.first_name, last_name: body.last_name },
      { status: 201 }
    );
  }),

  // Appointments
  http.get(`${BASE}/appointments`, () =>
    HttpResponse.json({ items: [], total: 0 })
  ),
  http.get(`${BASE}/calendar/events`, () => HttpResponse.json([])),
  http.get(`${BASE}/calendar/slots`, () => HttpResponse.json([])),

  // Staff
  http.get(`${BASE}/staff`, () =>
    HttpResponse.json({ items: [], total: 0 })
  ),

  // Services
  http.get(`${BASE}/services`, () =>
    HttpResponse.json({ items: [], total: 0 })
  ),
  http.get(`${BASE}/service-categories`, () => HttpResponse.json([])),

  // Misc
  http.get(`${BASE}/campaigns`, () => HttpResponse.json([])),
  http.get(`${BASE}/inventory/products`, () => HttpResponse.json({ items: [], total: 0 })),
  http.get(`${BASE}/checkins`, () => HttpResponse.json({ items: [], total: 0 })),
];
