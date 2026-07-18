import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import dayjs from 'dayjs';
import { useAppSelector } from '@/app/hooks';

export interface SalonSettings {
  salon_id: number;
  salon_name: string;
  email: string;
  phone: string;
  address: string;
  currency: string;
  timezone: string;
  locale: string;
  date_format: string;
  time_format: string;
  tax_percent: number;
  loyalty_points_per_currency: number;
  loyalty_points_redemption_rate: number;
  appointment_reminder: boolean;
  birthday_wishes: boolean;
  marketing_emails: boolean;
  sms_alerts: boolean;
}

interface SalonContextValue {
  settings: SalonSettings;
  isLoaded: boolean;
  formatCurrency: (amount: number) => string;
  formatDate: (date: string | Date | null | undefined) => string;
  formatTime: (time: string | null | undefined) => string;
  formatNumber: (n: number) => string;
  currencyLabel: (label: string) => string;
}

const DEFAULT_SETTINGS: SalonSettings = {
  salon_id: 0,
  salon_name: '',
  email: '',
  phone: '',
  address: '',
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

const STORAGE_KEY = 'salon_settings';

const SalonContext = createContext<SalonContextValue>({
  settings: DEFAULT_SETTINGS,
  isLoaded: false,
  formatCurrency: (n) => `$${n.toFixed(2)}`,
  formatDate: (d) => (d ? dayjs(d).format('MMM D, YYYY') : '—'),
  formatTime: (t) => t ?? '—',
  formatNumber: (n) => n.toLocaleString(),
  currencyLabel: (label) => label,
});

function buildFormatter(settings: SalonSettings) {
  const { currency, locale, date_format, time_format } = settings;

  const currencyFmt = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

  const numberFmt = new Intl.NumberFormat(locale);

  // Get the currency symbol from Intl
  const currencySymbol = currencyFmt
    .formatToParts(0)
    .find((p) => p.type === 'currency')?.value ?? currency;

  const formatCurrency = (amount: number) => currencyFmt.format(amount);

  const formatDate = (date: string | Date | null | undefined): string => {
    if (!date) return '—';
    const d = dayjs(date);
    if (!d.isValid()) return '—';
    return d.format(date_format);
  };

  const formatTime = (time: string | null | undefined): string => {
    if (!time) return '—';
    const parsed = dayjs(`2000-01-01T${time}`);
    if (!parsed.isValid()) return time;
    return parsed.format(time_format === '12h' ? 'h:mm A' : 'HH:mm');
  };

  const formatNumber = (n: number) => numberFmt.format(n);

  const currencyLabel = (label: string) =>
    label.replace('{currency}', currency).replace('{symbol}', currencySymbol);

  return { formatCurrency, formatDate, formatTime, formatNumber, currencyLabel, currencySymbol };
}

export function SalonProvider({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAppSelector((s) => s.auth.isAuthenticated);
  const accessToken = useAppSelector((s) => s.auth.accessToken);

  const [settings, setSettings] = useState<SalonSettings>(() => {
    try {
      const cached = localStorage.getItem(STORAGE_KEY);
      return cached ? (JSON.parse(cached) as SalonSettings) : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  });
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !accessToken) return;

    const BASE = import.meta.env.VITE_API_URL || '/api/v1';
    fetch(`${BASE}/salon/settings`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: SalonSettings | null) => {
        if (data) {
          setSettings(data);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        }
        setIsLoaded(true);
      })
      .catch(() => setIsLoaded(true));
  }, [isAuthenticated, accessToken]);

  const { formatCurrency, formatDate, formatTime, formatNumber, currencyLabel } =
    buildFormatter(settings);

  const value: SalonContextValue = {
    settings,
    isLoaded,
    formatCurrency,
    formatDate,
    formatTime,
    formatNumber,
    currencyLabel,
  };

  return <SalonContext.Provider value={value}>{children}</SalonContext.Provider>;
}

export function useSalon() {
  return useContext(SalonContext);
}
