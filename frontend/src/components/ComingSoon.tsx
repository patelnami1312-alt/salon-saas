import { Box, Typography, Chip, Button } from '@mui/material';
import { RocketLaunch, NotificationsNone } from '@mui/icons-material';

interface ComingSoonProps {
  title?: string;
  description?: string;
  eta?: string;
  features?: string[];
  compact?: boolean;
}

/**
 * Polished placeholder for features that are planned but not yet implemented.
 * Use `compact` for tabs/sections; default for full-page views.
 */
export default function ComingSoon({
  title = 'Coming Soon',
  description = 'This feature is actively being developed and will be available in a future update.',
  eta,
  features = [],
  compact = false,
}: ComingSoonProps) {
  if (compact) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          py: 8,
          textAlign: 'center',
          gap: 1.5,
        }}
      >
        <Box
          sx={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            background: 'linear-gradient(135deg,#EDE7FF,#C4AEFF)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <RocketLaunch sx={{ fontSize: 28, color: '#6C3FC5' }} />
        </Box>
        <Typography fontWeight={700} fontSize={16} color="#1F2937">{title}</Typography>
        <Typography fontSize={13} color="text.secondary" sx={{ maxWidth: 380 }}>
          {description}
        </Typography>
        {eta && (
          <Chip
            label={`Expected: ${eta}`}
            size="small"
            sx={{ bgcolor: '#EDE7FF', color: '#6C3FC5', fontWeight: 600, fontSize: 11 }}
          />
        )}
        {features.length > 0 && (
          <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: .75, justifyContent: 'center' }}>
            {features.map((f) => (
              <Chip
                key={f}
                label={f}
                size="small"
                variant="outlined"
                sx={{ fontSize: 11, borderColor: '#C4AEFF', color: '#6C3FC5' }}
              />
            ))}
          </Box>
        )}
      </Box>
    );
  }

  return (
    <Box
      sx={{
        minHeight: 420,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        py: 10,
        px: 3,
        gap: 2.5,
      }}
    >
      {/* Icon */}
      <Box
        sx={{
          width: 96,
          height: 96,
          borderRadius: '50%',
          background: 'linear-gradient(135deg,#EDE7FF 0%,#C4AEFF 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 8px 32px rgba(108,63,197,.20)',
        }}
      >
        <RocketLaunch sx={{ fontSize: 44, color: '#6C3FC5' }} />
      </Box>

      {/* Badge */}
      <Chip
        label="IN DEVELOPMENT"
        size="small"
        sx={{
          bgcolor: '#EDE7FF',
          color: '#6C3FC5',
          fontWeight: 800,
          fontSize: 10,
          letterSpacing: '.6px',
        }}
      />

      <Box>
        <Typography variant="h5" fontWeight={800} color="#1F2937" gutterBottom>
          {title}
        </Typography>
        <Typography color="text.secondary" sx={{ maxWidth: 480, mx: 'auto', lineHeight: 1.7 }}>
          {description}
        </Typography>
      </Box>

      {eta && (
        <Chip
          label={`Expected: ${eta}`}
          sx={{
            bgcolor: '#F0FDF4',
            color: '#16A34A',
            fontWeight: 700,
            border: '1px solid #BBF7D0',
          }}
        />
      )}

      {features.length > 0 && (
        <Box>
          <Typography fontSize={12} fontWeight={700} color="text.secondary" mb={1} sx={{ textTransform: 'uppercase', letterSpacing: '.6px' }}>
            What&apos;s included
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, justifyContent: 'center' }}>
            {features.map((f) => (
              <Chip
                key={f}
                label={f}
                variant="outlined"
                sx={{
                  fontSize: 12,
                  borderColor: '#C4AEFF',
                  color: '#6C3FC5',
                  fontWeight: 600,
                }}
              />
            ))}
          </Box>
        </Box>
      )}

      <Button
        variant="outlined"
        startIcon={<NotificationsNone />}
        sx={{
          borderColor: '#C4AEFF',
          color: '#6C3FC5',
          fontWeight: 700,
          borderRadius: '12px',
          px: 3,
          '&:hover': { bgcolor: '#EDE7FF', borderColor: '#6C3FC5' },
          mt: 1,
        }}
        disabled
      >
        Notify me when ready
      </Button>
    </Box>
  );
}
