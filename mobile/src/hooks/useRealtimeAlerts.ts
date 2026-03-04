import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { SnakeDetection, Alert } from '@/lib/types';
import * as Notifications from 'expo-notifications';
import * as Haptics from 'expo-haptics';

export function useRealtimeAlerts() {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const deviceIdsRef = useRef<string[]>([]);

  // Fetch user's device IDs
  useEffect(() => {
    if (!user) return;

    supabase
      .from('cameras')
      .select('device_id')
      .eq('user_id', user.id)
      .then(({ data }) => {
        deviceIdsRef.current = data?.map((c) => c.device_id) || [];
      });
  }, [user]);

  // Load recent alerts from DB on mount
  useEffect(() => {
    if (!user) return;

    const loadRecentAlerts = async () => {
      const { data: cameras } = await supabase
        .from('cameras')
        .select('device_id')
        .eq('user_id', user.id);

      const deviceIds = cameras?.map((c) => c.device_id) || [];
      if (deviceIds.length === 0) return;

      const { data } = await supabase
        .from('snake_detections')
        .select('*')
        .in('device_id', deviceIds)
        .order('timestamp', { ascending: false })
        .limit(20);

      if (data) {
        const existingAlerts: Alert[] = data.map((d) => ({
          id: d.id,
          detection: d,
          timestamp: d.timestamp,
          read: true, // Historical alerts are marked as read
        }));
        setAlerts(existingAlerts);
      }
    };

    loadRecentAlerts();
  }, [user]);

  // Subscribe to realtime detections
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('mobile-snake-alerts')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'snake_detections',
        },
        async (payload) => {
          const detection = payload.new as SnakeDetection;

          // Only alert for user's own devices
          if (
            deviceIdsRef.current.length > 0 &&
            !deviceIdsRef.current.includes(detection.device_id || '')
          ) {
            return;
          }

          const newAlert: Alert = {
            id: detection.id,
            detection,
            timestamp: new Date().toISOString(),
            read: false,
          };

          setAlerts((prev) => [newAlert, ...prev].slice(0, 100));
          setUnreadCount((prev) => prev + 1);

          // Haptic feedback
          try {
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          } catch {}

          // Schedule local notification
          try {
            await Notifications.scheduleNotificationAsync({
              content: {
                title: '🐍 Snake Detected!',
                body: detection.species
                  ? `${detection.species} detected (${(detection.confidence * 100).toFixed(0)}% confidence)`
                  : `Snake detected with ${(detection.confidence * 100).toFixed(0)}% confidence`,
                data: { detectionId: detection.id },
                sound: 'default',
              },
              trigger: null,
            });
          } catch (e) {
            console.log('Could not schedule notification:', e);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const markAsRead = useCallback((alertId: string) => {
    setAlerts((prev) => prev.map((a) => (a.id === alertId ? { ...a, read: true } : a)));
    setUnreadCount((prev) => Math.max(0, prev - 1));
  }, []);

  const markAllRead = useCallback(() => {
    setAlerts((prev) => prev.map((a) => ({ ...a, read: true })));
    setUnreadCount(0);
  }, []);

  return { alerts, unreadCount, markAsRead, markAllRead };
}
