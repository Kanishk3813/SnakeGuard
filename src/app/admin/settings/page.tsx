'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { SystemSettings } from '@/types';
import { 
  Save, Bell, Cpu, Database, Key, Cloud, 
  CheckCircle, XCircle, Loader2, AlertTriangle,
  Trash2, RefreshCw, Shield, Mail, Phone, Webhook
} from 'lucide-react';

export default function AdminSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'detection' | 'alerts' | 'model' | 'storage' | 'api' | 'integrations'>('detection');
  const [settings, setSettings] = useState<SystemSettings>({
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
  });

  const [newEmailRecipient, setNewEmailRecipient] = useState('');
  const [newSmsRecipient, setNewSmsRecipient] = useState('');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('system_settings')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading settings:', error);
      } else if (data) {
        setSettings({ ...settings, ...data });
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    try {
      setSaving(true);
      setSaveSuccess(false);
      setSaveError(null);

      const { error } = await supabase
        .from('system_settings')
        .upsert({
          ...settings,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error: any) {
      console.error('Error saving settings:', error);
      setSaveError(error.message || 'Failed to save settings');
      setTimeout(() => setSaveError(null), 5000);
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = <K extends keyof SystemSettings>(key: K, value: SystemSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const addEmailRecipient = () => {
    if (newEmailRecipient && !settings.alert_email_recipients.includes(newEmailRecipient)) {
      updateSetting('alert_email_recipients', [...settings.alert_email_recipients, newEmailRecipient]);
      setNewEmailRecipient('');
    }
  };

  const removeEmailRecipient = (email: string) => {
    updateSetting('alert_email_recipients', settings.alert_email_recipients.filter(e => e !== email));
  };

  const addSmsRecipient = () => {
    if (newSmsRecipient && !settings.alert_sms_recipients.includes(newSmsRecipient)) {
      updateSetting('alert_sms_recipients', [...settings.alert_sms_recipients, newSmsRecipient]);
      setNewSmsRecipient('');
    }
  };

  const removeSmsRecipient = (phone: string) => {
    updateSetting('alert_sms_recipients', settings.alert_sms_recipients.filter(p => p !== phone));
  };

  const tabs = [
    { id: 'detection', name: 'Detection', icon: AlertTriangle },
    { id: 'alerts', name: 'Alerts', icon: Bell },
    { id: 'model', name: 'Model', icon: Cpu },
    { id: 'storage', name: 'Storage', icon: Database },
    { id: 'api', name: 'API', icon: Key },
    { id: 'integrations', name: 'Integrations', icon: Cloud },
  ];

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-600"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="pb-5 border-b border-gray-200 mb-6">
        <h1 className="text-2xl font-bold leading-tight text-gray-900">System Settings</h1>
        <p className="mt-2 max-w-4xl text-sm text-gray-500">
          Configure system-wide settings for the snake detection platform
        </p>
      </div>

      {/* Save Status Messages */}
      {saveSuccess && (
        <div className="mb-6 bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg flex items-center">
          <CheckCircle className="h-5 w-5 mr-2" />
          <span>Settings saved successfully!</span>
        </div>
      )}
      {saveError && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg flex items-center">
          <XCircle className="h-5 w-5 mr-2" />
          <span>{saveError}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`
                  flex items-center py-4 px-1 border-b-2 font-medium text-sm
                  ${
                    activeTab === tab.id
                      ? 'border-green-500 text-green-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }
                `}
              >
                <Icon className="h-5 w-5 mr-2" />
                {tab.name}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="bg-white shadow rounded-lg">
        {/* Detection Settings */}
        {activeTab === 'detection' && (
          <div className="p-6 space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Confidence Threshold
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={settings.confidence_threshold}
                onChange={(e) => updateSetting('confidence_threshold', parseFloat(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>0%</span>
                <span className="font-medium text-green-600">
                  {(settings.confidence_threshold * 100).toFixed(0)}%
                </span>
                <span>100%</span>
              </div>
              <p className="mt-2 text-sm text-gray-500">
                Minimum confidence score required for a detection to be recorded
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Detection Cooldown (seconds)
              </label>
              <input
                type="number"
                min="1"
                max="300"
                value={settings.detection_cooldown}
                onChange={(e) => updateSetting('detection_cooldown', parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
              />
              <p className="mt-1 text-sm text-gray-500">
                Minimum time between detections from the same camera (prevents duplicate alerts)
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Max Detections Per Hour
              </label>
              <input
                type="number"
                min="1"
                max="10000"
                value={settings.max_detections_per_hour}
                onChange={(e) => updateSetting('max_detections_per_hour', parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
              />
              <p className="mt-1 text-sm text-gray-500">
                Maximum number of detections allowed per hour per camera (rate limiting)
              </p>
            </div>
          </div>
        )}

        {/* Alert Settings */}
        {activeTab === 'alerts' && (
          <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-700">Enable Alerts</label>
                <p className="text-sm text-gray-500">Master switch for all alert notifications</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.alert_enabled}
                  onChange={(e) => updateSetting('alert_enabled', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email Recipients
              </label>
              <div className="flex gap-2 mb-2">
                <input
                  type="email"
                  value={newEmailRecipient}
                  onChange={(e) => setNewEmailRecipient(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addEmailRecipient()}
                  placeholder="email@example.com"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
                />
                <button
                  onClick={addEmailRecipient}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  Add
                </button>
              </div>
              <div className="space-y-2">
                {settings.alert_email_recipients.map((email) => (
                  <div key={email} className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded-md">
                    <div className="flex items-center">
                      <Mail className="h-4 w-4 text-gray-400 mr-2" />
                      <span className="text-sm text-gray-700">{email}</span>
                    </div>
                    <button
                      onClick={() => removeEmailRecipient(email)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                {settings.alert_email_recipients.length === 0 && (
                  <p className="text-sm text-gray-500 italic">No email recipients added</p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                SMS Recipients
              </label>
              <div className="flex gap-2 mb-2">
                <input
                  type="tel"
                  value={newSmsRecipient}
                  onChange={(e) => setNewSmsRecipient(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addSmsRecipient()}
                  placeholder="+1234567890"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
                />
                <button
                  onClick={addSmsRecipient}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  Add
                </button>
              </div>
              <div className="space-y-2">
                {settings.alert_sms_recipients.map((phone) => (
                  <div key={phone} className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded-md">
                    <div className="flex items-center">
                      <Phone className="h-4 w-4 text-gray-400 mr-2" />
                      <span className="text-sm text-gray-700">{phone}</span>
                    </div>
                    <button
                      onClick={() => removeSmsRecipient(phone)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                {settings.alert_sms_recipients.length === 0 && (
                  <p className="text-sm text-gray-500 italic">No SMS recipients added</p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Webhook URL
              </label>
              <input
                type="url"
                value={settings.alert_webhook_url || ''}
                onChange={(e) => updateSetting('alert_webhook_url', e.target.value)}
                placeholder="https://example.com/webhook"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
              />
              <p className="mt-1 text-sm text-gray-500">
                Optional webhook URL to receive detection alerts via HTTP POST
              </p>
            </div>
          </div>
        )}

        {/* Model Settings */}
        {activeTab === 'model' && (
          <div className="p-6 space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Model Version
              </label>
              <input
                type="text"
                value={settings.model_version}
                onChange={(e) => updateSetting('model_version', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
              />
              <p className="mt-1 text-sm text-gray-500">
                Current version of the detection model in use
              </p>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-700">Auto Update Model</label>
                <p className="text-sm text-gray-500">Automatically update model when new version is available</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.model_update_auto}
                  onChange={(e) => updateSetting('model_update_auto', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
              </label>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start">
                <RefreshCw className="h-5 w-5 text-blue-600 mr-2 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-medium text-blue-900">Model Management</h4>
                  <p className="mt-1 text-sm text-blue-700">
                    To update the model, upload a new model file to the Raspberry Pi and update the version number above.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Storage Settings */}
        {activeTab === 'storage' && (
          <div className="p-6 space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Image Retention Period (days)
              </label>
              <input
                type="number"
                min="1"
                max="3650"
                value={settings.image_retention_days}
                onChange={(e) => updateSetting('image_retention_days', parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
              />
              <p className="mt-1 text-sm text-gray-500">
                Number of days to keep detection images before automatic deletion
              </p>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-700">Auto Cleanup</label>
                <p className="text-sm text-gray-500">Automatically delete old images based on retention period</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.auto_cleanup}
                  onChange={(e) => updateSetting('auto_cleanup', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
              </label>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-start">
                <AlertTriangle className="h-5 w-5 text-yellow-600 mr-2 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-medium text-yellow-900">Storage Warning</h4>
                  <p className="mt-1 text-sm text-yellow-700">
                    Automatic cleanup will permanently delete images older than the retention period. This action cannot be undone.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* API Settings */}
        {activeTab === 'api' && (
          <div className="p-6 space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                API Rate Limit (requests per hour)
              </label>
              <input
                type="number"
                min="1"
                max="100000"
                value={settings.api_rate_limit}
                onChange={(e) => updateSetting('api_rate_limit', parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
              />
              <p className="mt-1 text-sm text-gray-500">
                Maximum number of API requests allowed per hour per API key
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                API Key Expiry (days)
              </label>
              <input
                type="number"
                min="1"
                max="3650"
                value={settings.api_key_expiry_days}
                onChange={(e) => updateSetting('api_key_expiry_days', parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
              />
              <p className="mt-1 text-sm text-gray-500">
                Number of days before API keys expire and need to be renewed
              </p>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start">
                <Shield className="h-5 w-5 text-blue-600 mr-2 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-medium text-blue-900">API Security</h4>
                  <p className="mt-1 text-sm text-blue-700">
                    API keys are stored securely and encrypted. Never share your API keys publicly.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Integration Settings */}
        {activeTab === 'integrations' && (
          <div className="p-6 space-y-6">
            {/* Weather API */}
            <div className="border-b border-gray-200 pb-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Weather API Integration</h3>
              
              <div className="flex items-center justify-between mb-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">Enable Weather API</label>
                  <p className="text-sm text-gray-500">Integrate weather data for enhanced detection analytics</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.weather_api_enabled}
                    onChange={(e) => updateSetting('weather_api_enabled', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                </label>
              </div>

              {settings.weather_api_enabled && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Weather API Key
                  </label>
                  <input
                    type="password"
                    value={settings.weather_api_key || ''}
                    onChange={(e) => updateSetting('weather_api_key', e.target.value)}
                    placeholder="Enter your OpenWeatherMap API key"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
                  />
                  <p className="mt-1 text-sm text-gray-500">
                    Get your API key from <a href="https://openweathermap.org/api" target="_blank" rel="noopener noreferrer" className="text-green-600 hover:text-green-800">OpenWeatherMap</a>
                  </p>
                </div>
              )}
            </div>

            {/* Twilio SMS */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Twilio SMS Integration</h3>
              
              <div className="flex items-center justify-between mb-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">Enable Twilio SMS</label>
                  <p className="text-sm text-gray-500">Send SMS alerts via Twilio</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.twilio_enabled}
                    onChange={(e) => updateSetting('twilio_enabled', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                </label>
              </div>

              {settings.twilio_enabled && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Account SID
                    </label>
                    <input
                      type="text"
                      value={settings.twilio_account_sid || ''}
                      onChange={(e) => updateSetting('twilio_account_sid', e.target.value)}
                      placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Auth Token
                    </label>
                    <input
                      type="password"
                      value={settings.twilio_auth_token || ''}
                      onChange={(e) => updateSetting('twilio_auth_token', e.target.value)}
                      placeholder="Enter your Twilio auth token"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      value={settings.twilio_phone_number || ''}
                      onChange={(e) => updateSetting('twilio_phone_number', e.target.value)}
                      placeholder="+1234567890"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
                    />
                    <p className="mt-1 text-sm text-gray-500">
                      Your Twilio phone number (must include country code)
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Save Button */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end">
          <button
            onClick={saveSettings}
            disabled={saving}
            className="flex items-center px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-5 w-5 mr-2" />
                Save Settings
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

