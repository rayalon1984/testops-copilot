import { useState, useEffect, useMemo } from 'react';
import {
  TextField,
  InputAdornment,
  IconButton,
  useTheme,
} from '@mui/material';
import {
  Search as SearchIcon,
  Clear as ClearIcon,
} from '@mui/icons-material';
import debounce from 'lodash/debounce';

interface SearchFieldProps {
  placeholder?: string;
  value?: string;
  onChange: (value: string) => void;
  debounceMs?: number;
  fullWidth?: boolean;
  size?: 'small' | 'medium';
  disabled?: boolean;
  autoFocus?: boolean;
}

export default function SearchField({
  placeholder = 'Search...',
  value: externalValue,
  onChange,
  debounceMs = 300,
  fullWidth = true,
  size = 'medium',
  disabled = false,
  autoFocus = false,
}: SearchFieldProps) {
  const theme = useTheme();
  const [internalValue, setInternalValue] = useState(externalValue || '');

  // Update internal value when external value changes
  useEffect(() => {
    if (externalValue !== undefined) {
      setInternalValue(externalValue);
    }
  }, [externalValue]);

  // Debounced onChange handler
  const debouncedOnChange = useMemo(
    () => debounce((value: string) => {
      onChange(value);
    }, debounceMs),
    [onChange, debounceMs]
  );

  // Clear debounced calls on unmount
  useEffect(() => {
    return () => {
      debouncedOnChange.cancel();
    };
  }, [debouncedOnChange]);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = event.target.value;
    setInternalValue(newValue);
    debouncedOnChange(newValue);
  };

  const handleClear = () => {
    setInternalValue('');
    onChange('');
  };

  return (
    <TextField
      value={internalValue}
      onChange={handleChange}
      placeholder={placeholder}
      fullWidth={fullWidth}
      size={size}
      disabled={disabled}
      autoFocus={autoFocus}
      InputProps={{
        startAdornment: (
          <InputAdornment position="start">
            <SearchIcon color="action" />
          </InputAdornment>
        ),
        endAdornment: internalValue ? (
          <InputAdornment position="end">
            <IconButton
              aria-label="clear search"
              onClick={handleClear}
              edge="end"
              size="small"
            >
              <ClearIcon />
            </IconButton>
          </InputAdornment>
        ) : null,
        sx: {
          paddingRight: internalValue ? 0.5 : 2,
          '&.Mui-focused': {
            '& .MuiInputAdornment-root .MuiSvgIcon-root': {
              color: theme.palette.primary.main,
            },
          },
        },
      }}
      sx={{
        '& .MuiInputBase-root': {
          borderRadius: 20,
        },
      }}
    />
  );
}