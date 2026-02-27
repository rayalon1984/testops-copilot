import { z } from 'zod';
import { validate } from './validate';

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
const PASSWORD_MSG = 'Password must contain at least one uppercase letter, one lowercase letter, one number and one special character';

export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters').regex(PASSWORD_REGEX, PASSWORD_MSG),
  firstName: z.string().min(2, 'First name must be at least 2 characters'),
  lastName: z.string().min(2, 'Last name must be at least 2 characters'),
}).strict();

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const updatePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters').regex(PASSWORD_REGEX, PASSWORD_MSG),
});

export const resetPasswordSchema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters').regex(PASSWORD_REGEX, PASSWORD_MSG),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
});

export const validateRegisterInput = validate(registerSchema);
export const validateLoginInput = validate(loginSchema);
export const validateUpdatePasswordInput = validate(updatePasswordSchema);
export const validateResetPasswordInput = validate(resetPasswordSchema);
export const validateForgotPasswordInput = validate(forgotPasswordSchema);

export type User = z.infer<typeof registerSchema>;
