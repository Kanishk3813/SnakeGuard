'use client';

import { useEffect, useState } from 'react';
import Header from '@/components/ui/header';
import Sidebar from '@/components/ui/sidebar';
import { supabase } from '@/lib/supabase';
import { UserSettings } from '@/types';
import { 
  Save, Bell, Eye, MapPin, Shield, AlertCircle, 
  CheckCircle, XCircle, Loader2, Moon, Sun, Monitor,
  Navigation, Map
} from 'lucide-react';

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationAddress, setLocationAddress] = useState('');
  const [locationLoading, setLocationLoading] = useState(false);
  const [settings, setSettings] = useState<UserSettings>({
    email_notifications: true,
    sms_notifications: false,
    push_notifications: true,
    notification_frequency: 'realtime',
    high_confidence_only: false,
    theme: 'auto',
    items_per_page: 12,
    default_map_zoom: 14,
    show_distance: true,
    min_confidence_threshold: 0.5,
    filter_by_species: [],
    location_radius: 50,
    alert_radius: 10,
    alert_high_risk_only: true,
    share_location: false,
  });

  useEffect(() => {
    loadSettings();
    loadUserProfile();
  }, []);

  const loadUserProfile = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('latitude, longitude, location_address')
          .eq('user_id', session.user.id)
          .single();

        if (profile) {
          if (profile.latitude && profile.longitude) {
            setUserLocation({ lat: profile.latitude, lng: profile.longitude });
          }
          if (profile.location_address) {
            setLocationAddress(profile.location_address);
          }
        }
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  };

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      setSaveError('Geolocation is not supported by your browser');
      return;
    }

    setLocationLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setUserLocation({ lat, lng });

        // Reverse geocode to get address
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`
          );
          const data = await response.json();
          const address = data.display_name || `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
          setLocationAddress(address);
        } catch (error) {
          setLocationAddress(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);
        }

        // Save location to profile
        await saveLocationToProfile(lat, lng);
        setLocationLoading(false);
      },
      (error) => {
        setSaveError('Failed to get location: ' + error.message);
        setLocationLoading(false);
      }
    );
  };

  const saveLocationToProfile = async (lat: number, lng: number) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { error } = await supabase
          .from('user_profiles')
          .upsert({
            user_id: session.user.id,
            latitude: lat,
            longitude: lng,
            location_address: locationAddress || `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'user_id'
          });

        if (error) throw error;
      }
    } catch (error: any) {
      console.error('Error saving location:', error);
      setSaveError('Failed to save location');
    }
  };

  const loadSettings = async () => {
    try {
      setLoading(true);
      // Try to get user settings from Supabase
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        const { data, error } = await supabase
          .from('user_settings')
          .select('*')
          .eq('user_id', session.user.id)
          .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
          console.error('Error loading settings:', error);
        } else if (data) {
          setSettings({ ...settings, ...data });
        }
      } else {
        // Load from localStorage for anonymous users
        const savedSettings = localStorage.getItem('snakeguard_settings');
        if (savedSettings) {
          setSettings({ ...settings, ...JSON.parse(savedSettings) });
        }
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

      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        // Save to Supabase
        const { error } = await supabase
          .from('user_settings')
          .upsert({
            user_id: session.user.id,
            ...settings,
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'user_id'
          });

        if (error) throw error;
      } else {
        // Save to localStorage for anonymous users
        localStorage.setItem('snakeguard_settings', JSON.stringify(settings));
      }

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

  const updateSetting = <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return (
      <div className="flex flex-col h-screen bg-gray-50">
        <Header />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar />
          <main className="flex-1 overflow-y-auto p-6">
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-600"></div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-4xl mx-auto">
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
              <p className="mt-2 text-sm text-gray-600">
                Manage your preferences and notification settings
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

            {/* Notification Settings */}
            <div className="bg-white rounded-lg shadow-md mb-6">
              <div className="px-6 py-4 border-b border-gray-200 flex items-center">
                <Bell className="h-5 w-5 text-gray-500 mr-2" />
                <h2 className="text-xl font-semibold text-gray-900">Notification Settings</h2>
              </div>
              <div className="p-6 space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-gray-700">Email Notifications</label>
                    <p className="text-sm text-gray-500">Receive email alerts for new detections</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.email_notifications}
                      onChange={(e) => updateSetting('email_notifications', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-gray-700">SMS Notifications</label>
                    <p className="text-sm text-gray-500">Receive SMS alerts (requires phone number)</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.sms_notifications}
                      onChange={(e) => updateSetting('sms_notifications', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-gray-700">Push Notifications</label>
                    <p className="text-sm text-gray-500">Receive browser push notifications</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.push_notifications}
                      onChange={(e) => updateSetting('push_notifications', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                  </label>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Notification Frequency
                  </label>
                  <select
                    value={settings.notification_frequency}
                    onChange={(e) => updateSetting('notification_frequency', e.target.value as any)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
                  >
                    <option value="realtime">Real-time</option>
                    <option value="hourly">Hourly Summary</option>
                    <option value="daily">Daily Summary</option>
                    <option value="weekly">Weekly Summary</option>
                  </select>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-gray-700">High Confidence Only</label>
                    <p className="text-sm text-gray-500">Only notify for high confidence detections (&gt;70%)</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.high_confidence_only}
                      onChange={(e) => updateSetting('high_confidence_only', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                  </label>
                </div>
              </div>
            </div>

            {/* Display Preferences */}
            <div className="bg-white rounded-lg shadow-md mb-6">
              <div className="px-6 py-4 border-b border-gray-200 flex items-center">
                <Eye className="h-5 w-5 text-gray-500 mr-2" />
                <h2 className="text-xl font-semibold text-gray-900">Display Preferences</h2>
              </div>
              <div className="p-6 space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Theme
                  </label>
                  <div className="grid grid-cols-3 gap-4">
                    {(['light', 'dark', 'auto'] as const).map((theme) => (
                      <button
                        key={theme}
                        onClick={() => updateSetting('theme', theme)}
                        className={`p-4 border-2 rounded-lg flex flex-col items-center transition-all ${
                          settings.theme === theme
                            ? 'border-green-600 bg-green-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        {theme === 'light' && <Sun className="h-6 w-6 text-gray-600 mb-2" />}
                        {theme === 'dark' && <Moon className="h-6 w-6 text-gray-600 mb-2" />}
                        {theme === 'auto' && <Monitor className="h-6 w-6 text-gray-600 mb-2" />}
                        <span className="text-sm font-medium capitalize">{theme}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Items Per Page
                  </label>
                  <input
                    type="number"
                    min="6"
                    max="48"
                    step="6"
                    value={settings.items_per_page}
                    onChange={(e) => updateSetting('items_per_page', parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Default Map Zoom Level
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={settings.default_map_zoom}
                    onChange={(e) => updateSetting('default_map_zoom', parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
                  />
                  <p className="mt-1 text-sm text-gray-500">Zoom level: {settings.default_map_zoom} (1 = World, 20 = Street)</p>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-gray-700">Show Distance</label>
                    <p className="text-sm text-gray-500">Display distance from your location on detection cards</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.show_distance}
                      onChange={(e) => updateSetting('show_distance', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                  </label>
                </div>
              </div>
            </div>

            {/* Detection Preferences */}
            <div className="bg-white rounded-lg shadow-md mb-6">
              <div className="px-6 py-4 border-b border-gray-200 flex items-center">
                <AlertCircle className="h-5 w-5 text-gray-500 mr-2" />
                <h2 className="text-xl font-semibold text-gray-900">Detection Preferences</h2>
              </div>
              <div className="p-6 space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Minimum Confidence Threshold
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={settings.min_confidence_threshold}
                    onChange={(e) => updateSetting('min_confidence_threshold', parseFloat(e.target.value))}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>0%</span>
                    <span className="font-medium text-green-600">
                      {(settings.min_confidence_threshold * 100).toFixed(0)}%
                    </span>
                    <span>100%</span>
                  </div>
                  <p className="mt-2 text-sm text-gray-500">
                    Only show detections with confidence above this threshold
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Location Filter Radius (km)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="500"
                    value={settings.location_radius}
                    onChange={(e) => updateSetting('location_radius', parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
                  />
                  <p className="mt-1 text-sm text-gray-500">
                    Show detections within {settings.location_radius} km of your location
                  </p>
                </div>
              </div>
            </div>

            {/* Alert Settings */}
            <div className="bg-white rounded-lg shadow-md mb-6">
              <div className="px-6 py-4 border-b border-gray-200 flex items-center">
                <MapPin className="h-5 w-5 text-gray-500 mr-2" />
                <h2 className="text-xl font-semibold text-gray-900">Alert Settings</h2>
              </div>
              <div className="p-6 space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Alert Radius (km)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={settings.alert_radius}
                    onChange={(e) => updateSetting('alert_radius', parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
                  />
                  <p className="mt-1 text-sm text-gray-500">
                    Get alerts for detections within {settings.alert_radius} km
                  </p>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-gray-700">High Risk Only</label>
                    <p className="text-sm text-gray-500">Only alert for high-risk detections (venomous species)</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.alert_high_risk_only}
                      onChange={(e) => updateSetting('alert_high_risk_only', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                  </label>
                </div>
              </div>
            </div>

            {/* Location Settings */}
            <div className="bg-white rounded-lg shadow-md mb-6">
              <div className="px-6 py-4 border-b border-gray-200 flex items-center">
                <Navigation className="h-5 w-5 text-gray-500 mr-2" />
                <h2 className="text-xl font-semibold text-gray-900">Location Settings</h2>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Your Location
                  </label>
                  {userLocation ? (
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2 text-sm text-gray-600">
                        <MapPin className="h-4 w-4" />
                        <span>{userLocation.lat.toFixed(6)}, {userLocation.lng.toFixed(6)}</span>
                      </div>
                      {locationAddress && (
                        <p className="text-sm text-gray-500 pl-6">{locationAddress}</p>
                      )}
                      <button
                        onClick={getCurrentLocation}
                        disabled={locationLoading}
                        className="mt-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                      >
                        {locationLoading ? (
                          <>
                            <Loader2 className="h-4 w-4 inline mr-2 animate-spin" />
                            Getting location...
                          </>
                        ) : (
                          <>
                            <Navigation className="h-4 w-4 inline mr-2" />
                            Update Location
                          </>
                        )}
                      </button>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm text-gray-500 mb-3">
                        Set your location to receive alerts when snakes are detected nearby
                      </p>
                      <button
                        onClick={getCurrentLocation}
                        disabled={locationLoading}
                        className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                      >
                        {locationLoading ? (
                          <>
                            <Loader2 className="h-4 w-4 inline mr-2 animate-spin" />
                            Getting location...
                          </>
                        ) : (
                          <>
                            <Map className="h-4 w-4 inline mr-2" />
                            Set My Location
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
                <div className="pt-4 border-t border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium text-gray-700">Share Location</label>
                      <p className="text-sm text-gray-500">Allow location-based filtering and alerts</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.share_location}
                        onChange={(e) => updateSetting('share_location', e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* Privacy Settings */}
            <div className="bg-white rounded-lg shadow-md mb-6">
              <div className="px-6 py-4 border-b border-gray-200 flex items-center">
                <Shield className="h-5 w-5 text-gray-500 mr-2" />
                <h2 className="text-xl font-semibold text-gray-900">Privacy Settings</h2>
              </div>
              <div className="p-6">
                <p className="text-sm text-gray-500">
                  Your location is used only to send you alerts about nearby snake detections. 
                  It is stored securely and only shared when you enable location sharing.
                </p>
              </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-end mb-8">
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
        </main>
      </div>
    </div>
  );
}

