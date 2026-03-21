import React, { useEffect, useState } from 'react';
import { Box, Typography, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import { LinearProgress } from '@mui/material';

const DURATION_MS = 5000;

interface ToastProps {
  open: boolean;
  message: string;
  severity: 'success' | 'error';
  onClose: () => void;
  /** Убрать backdrop-filter (легче для GPU) */
  disableBackdropBlur?: boolean;
}

const DURATION_SEC = DURATION_MS / 1000;

export const Toast: React.FC<ToastProps> = ({ open, message, severity, onClose, disableBackdropBlur = true }) => {
  const [progress, setProgress] = useState(100);
  const [secondsLeft, setSecondsLeft] = useState(DURATION_SEC);

  useEffect(() => {
    if (!open) {
      setProgress(100);
      setSecondsLeft(DURATION_SEC);
      return;
    }
    setSecondsLeft(DURATION_SEC);
    const start = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - start;
      const left = Math.max(0, 100 - (elapsed / DURATION_MS) * 100);
      setProgress(left);
      setSecondsLeft(Math.ceil(Math.max(0, (DURATION_MS - elapsed) / 1000)));
      if (elapsed >= DURATION_MS) {
        clearInterval(interval);
        onClose();
      }
    }, 50);
    return () => clearInterval(interval);
  }, [open, onClose]);

  if (!open) return null;

  const isError = severity === 'error';
  return (
    <Box
      sx={{
        position: 'fixed',
        top: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 99999,
        minWidth: 320,
        maxWidth: 480,
        display: 'flex',
        flexDirection: 'column',
        background: isError ? 'rgba(40, 20, 20, 0.98)' : 'rgba(20, 40, 30, 0.98)',
        backdropFilter: disableBackdropBlur ? 'none' : 'blur(12px)',
        WebkitBackdropFilter: disableBackdropBlur ? 'none' : 'blur(12px)',
        border: isError ? '1px solid rgba(255, 100, 100, 0.5)' : '1px solid rgba(100, 255, 150, 0.4)',
        borderRadius: 2,
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        overflow: 'hidden',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 2, pr: 1 }}>
        {isError ? (
          <ErrorIcon sx={{ color: '#ff8a8a', fontSize: 28 }} />
        ) : (
          <CheckCircleIcon sx={{ color: '#8aff8a', fontSize: 28 }} />
        )}
        <Typography sx={{ flex: 1, color: '#fff', fontSize: '0.95rem' }}>{message}</Typography>
        <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.8rem', minWidth: 28 }}>
          {secondsLeft} с
        </Typography>
        <IconButton size="small" onClick={onClose} sx={{ color: 'rgba(255,255,255,0.8)' }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>
      <LinearProgress
        variant="determinate"
        value={progress}
        sx={{
          height: 3,
          bgcolor: 'rgba(255,255,255,0.2)',
          '& .MuiLinearProgress-bar': {
            bgcolor: isError ? '#ff6b6b' : '#4ECDC4',
          },
        }}
      />
    </Box>
  );
};
