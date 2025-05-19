import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  SelectChangeEvent,
  Box,
  Chip,
} from '@mui/material';

export interface FilterOption {
  value: string;
  label: string;
  color?: 'primary' | 'secondary' | 'error' | 'warning' | 'info' | 'success';
}

interface FilterSelectProps {
  label: string;
  value: string;
  options: FilterOption[];
  onChange: (value: string) => void;
  fullWidth?: boolean;
  size?: 'small' | 'medium';
  disabled?: boolean;
  showSelectedAsChip?: boolean;
}

export default function FilterSelect({
  label,
  value,
  options,
  onChange,
  fullWidth = true,
  size = 'medium',
  disabled = false,
  showSelectedAsChip = false,
}: FilterSelectProps) {
  const handleChange = (event: SelectChangeEvent) => {
    onChange(event.target.value);
  };

  const selectedOption = options.find(option => option.value === value);

  return (
    <FormControl fullWidth={fullWidth} size={size}>
      <InputLabel>{label}</InputLabel>
      <Select
        value={value}
        label={label}
        onChange={handleChange}
        disabled={disabled}
        renderValue={showSelectedAsChip && selectedOption ? () => (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            <Chip
              label={selectedOption.label}
              color={selectedOption.color || 'default'}
              size="small"
            />
          </Box>
        ) : undefined}
      >
        {options.map((option) => (
          <MenuItem key={option.value} value={option.value}>
            {showSelectedAsChip ? (
              <Chip
                label={option.label}
                color={option.color || 'default'}
                size="small"
                sx={{ pointerEvents: 'none' }}
              />
            ) : (
              option.label
            )}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}