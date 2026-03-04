import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { SnakeDetection, DashboardStats } from '@/lib/types';

export function useDetections(limit = 50) {
  const { user } = useAuth();
  const [detections, setDetections] = useState<SnakeDetection[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<DashboardStats>({
    totalDetections: 0,
    activeDevices: 0,
    recentAlerts: 0,
    avgConfidence: 0,
  });

  const fetchDetections = useCallback(async () => {
    if (!user) return;

    try {
      // Get user's camera device IDs
      const { data: cameras } = await supabase
        .from('cameras')
        .select('device_id, status')
        .eq('user_id', user.id);

      const deviceIds = cameras?.map((c) => c.device_id) || [];
      const activeDevices = cameras?.filter((c) => c.status === 'online').length || 0;

      if (deviceIds.length === 0) {
        setDetections([]);
        setStats({
          totalDetections: 0,
          activeDevices: 0,
          recentAlerts: 0,
          avgConfidence: 0,
        });
        setLoading(false);
        return;
      }

      // Fetch detections from user's devices
      const { data, error } = await supabase
        .from('snake_detections')
        .select('*')
        .in('device_id', deviceIds)
        .order('timestamp', { ascending: false })
        .limit(limit);

      if (!error && data) {
        setDetections(data);

        // Calculate stats
        const now = new Date();
        const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const recentAlerts = data.filter(
          (d) => new Date(d.timestamp) > dayAgo
        ).length;
        const avgConf =
          data.length > 0
            ? data.reduce((sum, d) => sum + d.confidence, 0) / data.length
            : 0;

        // Get total count
        const { count } = await supabase
          .from('snake_detections')
          .select('id', { count: 'exact', head: true })
          .in('device_id', deviceIds);

        setStats({
          totalDetections: count || data.length,
          activeDevices,
          recentAlerts,
          avgConfidence: avgConf,
        });
      }
    } catch (err) {
      console.error('Error fetching detections:', err);
    }

    setLoading(false);
  }, [user, limit]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await fetchDetections();
    setRefreshing(false);
  }, [fetchDetections]);

  useEffect(() => {
    fetchDetections();
  }, [fetchDetections]);

  return { detections, loading, refreshing, refresh, stats };
}
