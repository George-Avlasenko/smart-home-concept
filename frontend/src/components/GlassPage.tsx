import React from 'react';
import { Box } from '@mui/material';

const glassPanelSx = {
  flexGrow: 1,
  mx: 4,
  mb: 4,
  mt: 3,
  p: 4,
  background: 'rgba(255, 255, 255, 0.1)',
  backdropFilter: 'none',
  WebkitBackdropFilter: 'none',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  borderRadius: 2,
  boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.5)',
  position: 'relative' as const,
  zIndex: 1,
  color: '#fff',
  '& .MuiTypography-root': { color: 'inherit' },
  '& .MuiFormLabel-root': { color: 'rgba(255,255,255,0.7)' },
  '& .MuiInputBase-root': { color: '#fff' },
  '& .MuiInputBase-input': { color: '#fff' },
  '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.25)' },
  '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.4)' },
  '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#F08B5C', borderWidth: 2 },
  '& .MuiPaper-root': { background: 'rgba(255,255,255,0.08)', color: '#fff', border: '1px solid rgba(255,255,255,0.15)' },
  '& .MuiTableCell-root': { borderColor: 'rgba(255,255,255,0.12)', color: '#fff' },
  '& .MuiTableHead .MuiTableCell-root': { color: 'rgba(255,255,255,0.8)' },
  '& .MuiButton-outlined': { borderColor: 'rgba(255,255,255,0.3)', color: '#fff' },
  '& .MuiChip-root': { background: 'rgba(255,255,255,0.1)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)' },
  '& .MuiAccordion-root': { background: 'rgba(255,255,255,0.06)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' },
  '& .MuiAlert-root': { background: 'rgba(255,255,255,0.1)', color: '#fff' },
  '& .MuiDialog-paper': { background: 'rgba(20,25,45,0.98)', border: '1px solid rgba(255,255,255,0.2)' },
  '& .MuiListItemText-primary': { color: '#fff' },
  '& .MuiListItemText-secondary': { color: 'rgba(255,255,255,0.7)' },
  '& .MuiFormControlLabel-label': { color: 'rgba(255,255,255,0.9)' },
  '& .MuiSelect-icon': { color: 'rgba(255,255,255,0.7)' },
  '& .MuiFormHelperText-root': { color: 'rgba(255,255,255,0.6)' },
  '& .MuiInputLabel-outlined.Mui-focused': { color: '#F08B5C' },
};

export const GlassPage: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Box sx={{ position: 'relative', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
    <Box sx={glassPanelSx}>{children}</Box>
  </Box>
);
