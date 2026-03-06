import { useState, useEffect, useCallback } from 'react';
import { apiGet, apiPatch } from './useApi';
import { ResponderAssignment } from '@/lib/types';
import { useAuth } from '@/contexts/AuthContext';

export function useAssignments(statusFilter?: string) {
  const { user } = useAuth();
  const [assignments, setAssignments] = useState<ResponderAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAssignments = useCallback(async () => {
    if (!user) return;
    try {
      setError(null);
      let url = `/api/responders/assignments?responder_id=${user.id}`;
      if (statusFilter) url += `&status=${statusFilter}`;
      const data = await apiGet(url);
      setAssignments(data.assignments || []);
    } catch (err: any) {
      console.error('Error fetching assignments:', err);
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, statusFilter]);

  useEffect(() => {
    fetchAssignments();
  }, [fetchAssignments]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await fetchAssignments();
  }, [fetchAssignments]);

  const updateStatus = useCallback(async (
    assignmentId: string,
    status: string,
    notes?: string
  ) => {
    try {
      const result = await apiPatch(`/api/responders/assignments/${assignmentId}`, {
        status,
        notes,
      });
      // Update local state
      setAssignments(prev =>
        prev.map(a =>
          a.id === assignmentId
            ? { ...a, status: status as any, notes: notes || a.notes }
            : a
        )
      );
      return result;
    } catch (err: any) {
      console.error('Error updating assignment:', err);
      throw err;
    }
  }, []);

  const activeAssignments = assignments.filter(
    a => a.status === 'assigned' || a.status === 'in_progress'
  );

  const completedAssignments = assignments.filter(
    a => a.status === 'completed'
  );

  return {
    assignments,
    activeAssignments,
    completedAssignments,
    loading,
    refreshing,
    error,
    refresh,
    updateStatus,
  };
}
