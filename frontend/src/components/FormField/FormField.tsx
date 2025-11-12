import {
  TextField,
  FormControl,
  FormHelperText,
  InputLabel,
  Select,
  MenuItem,
  SelectChangeEvent,
  FormControlLabel,
  Switch,
  Checkbox,
} from '@mui/material';

type BaseFieldProps = {
  error?: string;
  touched?: boolean;
  label: string;
  required?: boolean;
  helperText?: string;
  fullWidth?: boolean;
  disabled?: boolean;
  size?: 'small' | 'medium';
};

interface TextInputProps extends BaseFieldProps {
  type: 'text' | 'email' | 'password' | 'number' | 'url';
  value: string | number;
  onChange: (value: string) => void;
  multiline?: boolean;
  rows?: number;
  placeholder?: string;
}

interface SelectInputProps extends BaseFieldProps {
  type: 'select';
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}

interface BooleanInputProps extends BaseFieldProps {
  type: 'switch' | 'checkbox';
  value: boolean;
  onChange: (value: boolean) => void;
}

type FormFieldProps = TextInputProps | SelectInputProps | BooleanInputProps;

export default function FormField(props: FormFieldProps) {
  const {
    type,
    label,
    error,
    touched,
    required,
    helperText,
    fullWidth = true,
    disabled = false,
    size = 'medium',
  } = props;

  const showError = touched && error;
  const fieldHelperText = showError ? error : helperText;

  switch (type) {
    case 'text':
    case 'email':
    case 'password':
    case 'number':
    case 'url':
      return (
        <TextField
          type={type}
          label={label}
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
          error={!!showError}
          helperText={fieldHelperText}
          required={required}
          fullWidth={fullWidth}
          disabled={disabled}
          size={size}
          multiline={props.multiline}
          rows={props.rows}
          placeholder={props.placeholder}
        />
      );

    case 'select':
      return (
        <FormControl
          error={!!showError}
          required={required}
          fullWidth={fullWidth}
          disabled={disabled}
          size={size}
        >
          <InputLabel>{label}</InputLabel>
          <Select
            value={props.value}
            label={label}
            onChange={(e: SelectChangeEvent) => props.onChange(e.target.value)}
          >
            {props.options.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </Select>
          {fieldHelperText && (
            <FormHelperText>{fieldHelperText}</FormHelperText>
          )}
        </FormControl>
      );

    case 'switch':
      return (
        <FormControl
          error={!!showError}
          required={required}
          fullWidth={fullWidth}
          disabled={disabled}
        >
          <FormControlLabel
            control={
              <Switch
                checked={props.value}
                onChange={(e) => props.onChange(e.target.checked)}
                size={size}
              />
            }
            label={label}
          />
          {fieldHelperText && (
            <FormHelperText>{fieldHelperText}</FormHelperText>
          )}
        </FormControl>
      );

    case 'checkbox':
      return (
        <FormControl
          error={!!showError}
          required={required}
          fullWidth={fullWidth}
          disabled={disabled}
        >
          <FormControlLabel
            control={
              <Checkbox
                checked={props.value}
                onChange={(e) => props.onChange(e.target.checked)}
                size={size}
              />
            }
            label={label}
          />
          {fieldHelperText && (
            <FormHelperText>{fieldHelperText}</FormHelperText>
          )}
        </FormControl>
      );

    default:
      return null;
  }
}