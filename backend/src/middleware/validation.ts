/**
 * Validation middleware — barrel re-export.
 *
 * All schemas are now split by domain in validation/*.ts.
 * This file re-exports everything for backward compatibility.
 */

// Domain re-exports
export { validate } from './validation/validate';

export {
  registerSchema, loginSchema, updatePasswordSchema, resetPasswordSchema, forgotPasswordSchema,
  validateRegisterInput, validateLoginInput, validateUpdatePasswordInput, validateResetPasswordInput, validateForgotPasswordInput,
  type User,
} from './validation/auth';

export {
  pipelineSchema, createPipelineSchema, updatePipelineSchema, pipelineScheduleSchema,
  validatePipelineInput, validateCreatePipeline, validateUpdatePipeline, validatePipelineSchedule,
  type Pipeline,
} from './validation/pipeline';

export {
  testRunSchema, scheduleSchema, metricsQuerySchema,
  validateTestRunInput, validateScheduleInput, validateMetricsQuery,
  type TestRun, type Schedule, type MetricsQuery,
} from './validation/testrun';

export {
  notificationPreferencesSchema, channelVerificationSchema, broadcastNotificationSchema, globalNotificationSettingsSchema,
  validateNotificationPreferences, validateChannelVerification, validateBroadcastNotification, validateGlobalNotificationSettings,
  type NotificationPreferences, type ChannelVerification, type BroadcastNotification, type GlobalNotificationSettings,
} from './validation/notification';

export {
  aiConfigUpdateSchema, aiAutonomySchema, chatMessageSchema, confirmActionSchema,
  validateAIConfigUpdate, validateAIAutonomy, validateChatMessage, validateConfirmAction,
} from './validation/ai';

export {
  createShareSchema, emailShareSchema,
  validateCreateShare, validateEmailShare,
} from './validation/share';

export {
  createMondayItemSchema, updateMondayItemSchema, createMondayUpdateSchema, mondayTestFailureSchema,
  validateCreateMondayItem, validateUpdateMondayItem, validateCreateMondayUpdate, validateMondayTestFailure,
} from './validation/monday';

// Legacy: aggregated schemas object for tests
import { registerSchema as _register } from './validation/auth';
import { loginSchema as _login, updatePasswordSchema as _updatePw, resetPasswordSchema as _resetPw, forgotPasswordSchema as _forgotPw } from './validation/auth';
import { pipelineSchema as _pipeline, createPipelineSchema as _createPipeline, updatePipelineSchema as _updatePipeline, pipelineScheduleSchema as _pipelineSchedule } from './validation/pipeline';
import { testRunSchema as _testRun, scheduleSchema as _schedule, metricsQuerySchema as _metrics } from './validation/testrun';
import { notificationPreferencesSchema as _notifPrefs, channelVerificationSchema as _chanVerify, broadcastNotificationSchema as _broadcast, globalNotificationSettingsSchema as _globalNotif } from './validation/notification';
import { aiConfigUpdateSchema as _aiConfig, aiAutonomySchema as _aiAutonomy, chatMessageSchema as _chatMsg, confirmActionSchema as _confirm } from './validation/ai';
import { createShareSchema as _createShare, emailShareSchema as _emailShare } from './validation/share';
import { createMondayItemSchema as _createMonday, updateMondayItemSchema as _updateMonday, createMondayUpdateSchema as _createMondayUpdate, mondayTestFailureSchema as _mondayFailure } from './validation/monday';

export const schemas = {
  register: _register,
  login: _login,
  updatePassword: _updatePw,
  resetPassword: _resetPw,
  forgotPassword: _forgotPw,
  pipeline: _pipeline,
  createPipeline: _createPipeline,
  updatePipeline: _updatePipeline,
  pipelineSchedule: _pipelineSchedule,
  testRun: _testRun,
  schedule: _schedule,
  metricsQuery: _metrics,
  notificationPreferences: _notifPrefs,
  channelVerification: _chanVerify,
  broadcastNotification: _broadcast,
  globalNotificationSettings: _globalNotif,
  aiConfigUpdate: _aiConfig,
  aiAutonomy: _aiAutonomy,
  chatMessage: _chatMsg,
  confirmAction: _confirm,
  createShare: _createShare,
  emailShare: _emailShare,
  createMondayItem: _createMonday,
  updateMondayItem: _updateMonday,
  createMondayUpdate: _createMondayUpdate,
  mondayTestFailure: _mondayFailure,
};
