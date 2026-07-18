import type { ReactElement } from 'react';
import { Box, Typography } from '@mui/material';
import { Inbox } from '@mui/icons-material';

interface Props {
  message?: string;
  subtext?: string;
  icon?: ReactElement;
}

export default function NoRowsOverlay({ message = 'No records found', subtext, icon }: Props) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 180, py: 4, gap: 1 }}>
      <Box sx={{ color: 'text.disabled', lineHeight: 0, mb: 0.5 }}>
        {icon ? <Box sx={{ '& svg': { fontSize: 44 } }}>{icon}</Box> : <Inbox sx={{ fontSize: 44 }} />}
      </Box>
      <Typography variant="body1" color="text.secondary" fontWeight={500}>{message}</Typography>
      {subtext && <Typography variant="caption" color="text.disabled" sx={{ textAlign: 'center', maxWidth: 260 }}>{subtext}</Typography>}
    </Box>
  );
}
