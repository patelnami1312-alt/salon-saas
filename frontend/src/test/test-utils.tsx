import { type ReactElement, type ReactNode } from 'react';
import { render, type RenderOptions } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import { CssBaseline } from '@mui/material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { makeStore } from '@/app/store';
import type { RootState } from '@/app/store';
import { theme } from '@/theme';
import { SalonProvider } from '@/context/SalonContext';
import type { User } from '@/types';

const TEST_USER: User = {
  user_id: 1,
  salon_id: 1,
  branch_id: 1,
  first_name: 'Test',
  last_name: 'User',
  email: 'test@example.com',
  role_code: 'admin',
  role_name: 'Admin',
  phone: null,
  profile_picture_url: null,
  is_email_verified: true,
};

const TEST_AUTH_PRELOAD: Partial<RootState> = {
  auth: {
    user: TEST_USER,
    accessToken: 'test-token',
    refreshToken: 'test-refresh',
    isAuthenticated: true,
    isInitializing: false,
    isLoading: false,
    error: null,
  },
};

interface ProvidersProps {
  children: ReactNode;
  initialEntries?: string[];
}

function AllProviders({ children, initialEntries = ['/'] }: ProvidersProps) {
  // Fresh store per render — prevents cross-test RTK Query cache bleed
  const store = makeStore(TEST_AUTH_PRELOAD);
  return (
    <Provider store={store}>
      <LocalizationProvider dateAdapter={AdapterDayjs}>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <MemoryRouter initialEntries={initialEntries}>
            <SalonProvider>
              {children}
            </SalonProvider>
          </MemoryRouter>
        </ThemeProvider>
      </LocalizationProvider>
    </Provider>
  );
}

interface ExtendedRenderOptions extends RenderOptions {
  initialEntries?: string[];
}

export function renderWithProviders(ui: ReactElement, options: ExtendedRenderOptions = {}) {
  const { initialEntries, ...rest } = options;
  return render(ui, {
    wrapper: ({ children }) => (
      <AllProviders initialEntries={initialEntries}>{children}</AllProviders>
    ),
    ...rest,
  });
}

// Re-export RTL so test files import from a single place
export * from '@testing-library/react';
