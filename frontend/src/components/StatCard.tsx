import { memo } from 'react';
import { Box, Card, CardContent, Typography, Skeleton, Avatar } from '@mui/material';
import { ArrowUpward, ArrowDownward } from '@mui/icons-material';

export interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactElement;
  color: string;
  trend?: number;
  loading?: boolean;
}

const StatCard = memo(function StatCard({ title, value, subtitle, icon, color, trend, loading }: StatCardProps) {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ p: 2.5 }}>
        {loading ? (
          <>
            <Skeleton variant="rectangular" height={24} width="60%" sx={{ mb: 1 }} />
            <Skeleton variant="rectangular" height={36} width="40%" />
          </>
        ) : (
          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <Box>
              <Typography
                variant="caption"
                color="text.secondary"
                fontWeight={500}
                sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}
              >
                {title}
              </Typography>
              <Typography variant="h4" fontWeight={700} mt={0.5}>{value}</Typography>
              {subtitle && (
                <Typography variant="caption" color="text.secondary">{subtitle}</Typography>
              )}
              {trend !== undefined && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                  {trend >= 0
                    ? <ArrowUpward sx={{ color: 'success.main', fontSize: 14 }} aria-hidden />
                    : <ArrowDownward sx={{ color: 'error.main', fontSize: 14 }} aria-hidden />}
                  <Typography
                    variant="caption"
                    color={trend >= 0 ? 'success.main' : 'error.main'}
                    fontWeight={600}
                  >
                    {Math.abs(trend)}% vs last week
                  </Typography>
                </Box>
              )}
            </Box>
            <Avatar sx={{ bgcolor: `${color}20`, width: 48, height: 48 }}>
              <Box sx={{ color }}>{icon}</Box>
            </Avatar>
          </Box>
        )}
      </CardContent>
    </Card>
  );
});

export default StatCard;
