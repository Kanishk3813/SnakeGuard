import { SystemSettings } from '@/types';

export const defaultSystemSettings: SystemSettings = {
  confidence_threshold: 0.5,
  detection_cooldown: 10,
  max_detections_per_hour: 100,
  alert_enabled: true,
  alert_email_recipients: [],
  alert_sms_recipients: [],
  alert_webhook_url: '',
  model_version: 'v1.0',
  model_update_auto: false,
  image_retention_days: 90,
  auto_cleanup: true,
  api_rate_limit: 1000,
  api_key_expiry_days: 365,
  weather_api_enabled: false,
  weather_api_key: '',
  twilio_enabled: false,
  twilio_account_sid: '',
  twilio_auth_token: '',
  twilio_phone_number: '',
};

