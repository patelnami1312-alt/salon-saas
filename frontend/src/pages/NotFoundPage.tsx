import { Box, Typography, Button } from '@mui/material';
import { useNavigate } from 'react-router-dom';

export default function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', textAlign: 'center' }}>
      <Typography variant="h1" fontWeight={900} sx={{ fontSize: 120, color: 'primary.main', lineHeight: 1 }}>404</Typography>
      <Typography variant="h5" fontWeight={700} mb={1}>Page Not Found</Typography>
      <Typography color="text.secondary" mb={3}>The page you're looking for doesn't exist or has been moved.</Typography>
      <Button variant="contained" size="large" onClick={() => navigate('/')}>Go to Dashboard</Button>
    </Box>
  );
}
