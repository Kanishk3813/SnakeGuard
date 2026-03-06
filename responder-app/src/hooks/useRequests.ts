import { useState, useEffect, useCallback } from 'react';
import { apiGet, apiPost } from './useApi';
import { AssignmentRequest } from '@/lib/types';
import { useAuth } from '@/contexts/AuthContext';

export function useRequests() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<AssignmentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRequests = useCallback(async () => {
    if (!user) return;
    try {
      setError(null);
      const data = await apiGet('/api/responders/assignment-requests?status=pending');
      setRequests(data.requests || []);
    } catch (err: any) {
      console.error('Error fetching requests:', err);
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    fetchRequests();
    // Poll every 30 seconds for new requests
    const interval = setInterval(fetchRequests, 30000);
    return () => clearInterval(interval);
  }, [fetchRequests]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await fetchRequests();
  }, [fetchRequests]);

  const acceptRequest = useCallback(async (requestId: string) => {
    try {
      const result = await apiPost('/api/responders/assignment-requests', {
        requestId,
        action: 'accept',
      });
      // Remove from pending requests list
      setRequests(prev => prev.filter(r => r.id !== requestId));
      return result;
    } catch (err: any) {
      console.error('Error accepting request:', err);
      throw err;
    }
  }, []);

  const rejectRequest = useCallback(async (requestId: string) => {
    try {
      const result = await apiPost('/api/responders/assignment-requests', {
        requestId,
        action: 'reject',
      });
      setRequests(prev => prev.filter(r => r.id !== requestId));
      return result;
    } catch (err: any) {
      console.error('Error rejecting request:', err);
      throw err;
    }
  }, []);

  return {
    requests,
    loading,
    refreshing,
    error,
    refresh,
    acceptRequest,
    rejectRequest,
  };
}
