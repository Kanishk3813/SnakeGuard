import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Device } from '@/lib/types';

export function useDevices() {
  const { user } = useAuth();
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDevices = useCallback(async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('cameras')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setDevices(data);
    }
    setLoading(false);
  }, [user]);

  const addDevice = async (deviceData: {
    device_id: string;
    name: string;
    description?: string;
    latitude?: number;
    longitude?: number;
    stream_url?: string;
    stream_port?: number;
  }) => {
    if (!user) return { error: 'Not authenticated' };

    // Check if device already exists
    const { data: existing } = await supabase
      .from('cameras')
      .select('id')
      .eq('device_id', deviceData.device_id)
      .maybeSingle();

    if (existing) {
      return { error: 'This device ID is already registered to another account' };
    }

    const { error } = await supabase.from('cameras').insert({
      ...deviceData,
      user_id: user.id,
      status: 'offline',
      stream_type: 'mjpeg',
    });

    if (error) return { error: error.message };

    await fetchDevices();
    return {};
  };

  const removeDevice = async (deviceId: string) => {
    if (!user) return { error: 'Not authenticated' };

    const { error } = await supabase
      .from('cameras')
      .delete()
      .eq('id', deviceId)
      .eq('user_id', user.id);

    if (error) return { error: error.message };
    await fetchDevices();
    return {};
  };

  const updateDevice = async (
    deviceId: string,
    updates: Partial<Pick<Device, 'name' | 'description' | 'latitude' | 'longitude' | 'stream_url' | 'stream_port'>>
  ) => {
    if (!user) return { error: 'Not authenticated' };

    const { error } = await supabase
      .from('cameras')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', deviceId)
      .eq('user_id', user.id);

    if (error) return { error: error.message };
    await fetchDevices();
    return {};
  };

  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  return { devices, loading, fetchDevices, addDevice, removeDevice, updateDevice };
}
