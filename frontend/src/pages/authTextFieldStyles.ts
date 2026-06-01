import type { SxProps, Theme } from '@mui/material/styles';

const FIELD_FILL = 'var(--auth-textfield-fill, rgba(255, 255, 255, 0.06))';

export const glassAuthTextFieldSx: SxProps<Theme> = {
  '& .MuiOutlinedInput-root': {
    backgroundColor: FIELD_FILL,
    color: '#fff',
    '&:has(input:-webkit-autofill)': {
      backgroundColor: `${FIELD_FILL} !important`,
    },
    '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.2)' },
    '&:hover fieldset': { borderColor: 'rgba(255, 255, 255, 0.35)' },
    '&.Mui-focused fieldset': { borderColor: '#F08B5C', borderWidth: 2 },
    '&.Mui-error fieldset': { borderColor: '#FF6B6B' },
  },
  '& .MuiInputLabel-outlined': { color: 'rgba(255, 255, 255, 0.7)' },
  '& .MuiInputLabel-outlined.Mui-focused': { color: '#F08B5C' },
  '& .MuiFormHelperText-root': { color: 'rgba(255, 255, 255, 0.6)' },
  '& .MuiFormHelperText-root.Mui-error': { color: '#FF8A8A' },
};
