import { useEffect } from 'react';
import { ThemeProvider, CssBaseline, CircularProgress, Box } from '@mui/material';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { store } from '@/app/store';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { fetchMe } from '@/features/auth/authSlice';
import { setSelectedBranch } from '@/features/dashboard/dashboardSlice';
import { useGetBranchesQuery } from '@/features/api/apiSlice';
import { theme } from '@/theme';
import AppRoutes from '@/routes/AppRoutes';
import { SalonProvider } from '@/context/SalonContext';
import { BranchProvider } from '@/context/BranchContext';

function BranchBootstrap() {
  const dispatch = useAppDispatch();
  const selectedBranchId = useAppSelector((s) => s.dashboard.selectedBranchId);
  const { data: branches } = useGetBranchesQuery();

  useEffect(() => {
    if (branches && branches.length > 0 && !selectedBranchId) {
      dispatch(setSelectedBranch(branches[0].branch_id));
    }
  }, [branches, selectedBranchId]);

  return null;
}

function AppInner() {
  const dispatch = useAppDispatch();
  const isInitializing = useAppSelector((s) => s.auth.isInitializing);
  const isAuthenticated = useAppSelector((s) => s.auth.isAuthenticated);

  useEffect(() => {
    if (isInitializing) {
      dispatch(fetchMe());
    }
  }, []);

  if (isInitializing) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', bgcolor: '#F8F5FF' }}>
        <CircularProgress color="primary" />
      </Box>
    );
  }

  return (
    <BrowserRouter>
      <SalonProvider>
        <BranchProvider>
          {isAuthenticated && <BranchBootstrap />}
          <AppRoutes />
        </BranchProvider>
      </SalonProvider>
    </BrowserRouter>
  );
}

export default function App() {
  return (
    <Provider store={store}>
      <LocalizationProvider dateAdapter={AdapterDayjs}>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <AppInner />
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 3500,
              style: { borderRadius: 10, fontSize: 14 },
              success: { iconTheme: { primary: '#6C3FC5', secondary: '#fff' } },
            }}
          />
        </ThemeProvider>
      </LocalizationProvider>
    </Provider>
  );
}
