import { useState } from 'react';
import {
  Box, Card, CardContent, TextField, Button, Typography,
  Alert, InputAdornment, IconButton, CircularProgress,
} from '@mui/material';
import { Visibility, VisibilityOff, ContentCut, Lock, Email } from '@mui/icons-material';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { login, clearError } from '@/features/auth/authSlice';

const schema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(1, 'Password required'),
});

type FormData = z.infer<typeof schema>;

export default function LoginPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { isLoading, error, isAuthenticated } = useAppSelector((s) => s.auth);
  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname || '/billing';
  const [showPassword, setShowPassword] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const user = useAppSelector((s) => s.auth.user);

  if (isAuthenticated) {
    // Super admins go directly to their portal
    if (user?.role_code === 'super_admin' && from === '/billing') {
      return <Navigate to="/admin/dashboard" replace />;
    }
    return <Navigate to={from} replace />;
  }

  const onSubmit = async (data: FormData) => {
    dispatch(clearError());
    const result = await dispatch(login(data));
    if (login.fulfilled.match(result)) {
      const roleCode = (result.payload as any)?.user?.role_code;
      if (roleCode === 'super_admin' && from === '/billing') {
        navigate('/admin/dashboard', { replace: true });
      } else {
        navigate(from, { replace: true });
      }
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #1A1A2E 0%, #16213E 50%, #0F3460 100%)',
        p: 2,
      }}
    >
      <Box sx={{ width: '100%', maxWidth: 440 }}>
        {/* Logo */}
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Box
            sx={{
              width: 64, height: 64, borderRadius: 3,
              background: 'linear-gradient(135deg, #6C3FC5, #9B72E8)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', mb: 2,
              boxShadow: '0 8px 32px rgba(108,63,197,0.4)',
            }}
          >
            <ContentCut sx={{ color: '#fff', fontSize: 32 }} />
          </Box>
          <Typography variant="h4" sx={{ color: '#fff', fontWeight: 700 }}>Heritage Threading Salon</Typography>
          <Typography sx={{ color: 'rgba(255,255,255,0.6)', mt: 0.5, fontSize: 14 }}>
            Enterprise Salon Management Platform
          </Typography>
        </Box>

        <Card sx={{ borderRadius: 3, boxShadow: '0 24px 64px rgba(0,0,0,0.4)' }}>
          <CardContent sx={{ p: 4 }}>
            <Typography variant="h5" fontWeight={700} mb={0.5}>Welcome back</Typography>
            <Typography color="text.secondary" fontSize={14} mb={3}>Sign in to your account</Typography>

            {error && (
              <Alert severity="error" onClose={() => dispatch(clearError())} sx={{ mb: 2, borderRadius: 2 }}>
                {error}
              </Alert>
            )}

            <form onSubmit={handleSubmit(onSubmit)}>
              <TextField
                {...register('email')}
                label="Email Address"
                fullWidth
                type="email"
                autoComplete="email"
                autoFocus
                error={!!errors.email}
                helperText={errors.email?.message}
                sx={{ mb: 2 }}
                InputProps={{
                  startAdornment: <InputAdornment position="start"><Email sx={{ color: 'text.secondary', fontSize: 20 }} /></InputAdornment>,
                }}
              />

              <TextField
                {...register('password')}
                label="Password"
                fullWidth
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                error={!!errors.password}
                helperText={errors.password?.message}
                sx={{ mb: 3 }}
                InputProps={{
                  startAdornment: <InputAdornment position="start"><Lock sx={{ color: 'text.secondary', fontSize: 20 }} /></InputAdornment>,
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowPassword(!showPassword)}
                        edge="end"
                        size="small"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />

              <Button
                type="submit"
                fullWidth
                variant="contained"
                size="large"
                disabled={isLoading}
                sx={{ py: 1.5, fontSize: 16, borderRadius: 2 }}
              >
                {isLoading ? <CircularProgress size={22} color="inherit" /> : 'Sign In'}
              </Button>
            </form>

            <Box sx={{ textAlign: 'center', mt: 2 }}>
              <Button variant="text" size="small" color="primary" onClick={() => navigate('/forgot-password')}>
                Forgot Password?
              </Button>
            </Box>

          </CardContent>
        </Card>

        <Box sx={{ textAlign: 'center', mt: 2 }}>
          <Button
            variant="text"
            size="small"
            onClick={() => navigate('/')}
            sx={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, '&:hover': { color: 'white' } }}
          >
            ← Back to Home
          </Button>
        </Box>

        <Typography sx={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)', mt: 1, fontSize: 11 }}>
          Staff & Admin Login Only
        </Typography>
      </Box>
    </Box>
  );
}
