'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/ui/header';
import Sidebar from '@/components/ui/sidebar';
import { supabase } from '@/lib/supabase';
import { SnakeDetection, ResponderAssignment } from '@/types';
import { formatDate, calculateDistance } from '@/lib/utils';
import PredictivePathMap from '@/components/ui/predictive-path-map';
import ResponderLocationPicker from '@/components/ui/responder-location-picker';
import {
  MapPin,
  Clock,
  AlertCircle,
  CheckCircle,
  XCircle,
  Navigation,
  User,
  Target,
  AlertTriangle,
  Loader2,
  RefreshCw,
  Map,
  Bell,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

export default function RespondersPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [assignments, setAssignments] = useState<ResponderAssignment[]>([]);
  const [unassignedDetections, setUnassignedDetections] = useState<SnakeDetection[]>([]);
  const [selectedTab, setSelectedTab] = useState<'assigned' | 'available' | 'requests'>('assigned');
  const [selectedDetection, setSelectedDetection] = useState<SnakeDetection | null>(null);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [processingRequest, setProcessingRequest] = useState<string | null>(null);
  const [expandedMaps, setExpandedMaps] = useState<Set<string>>(new Set());

  const toggleMap = (id: string) => {
    setExpandedMaps(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  useEffect(() => {
    checkUser();
  }, []);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  // Set up real-time subscriptions for assignment requests and new detections
  useEffect(() => {
    if (!user) return;

    let channels: any[] = [];

    const setupSubscriptions = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Subscribe to assignment_requests table changes
      const requestsChannel = supabase
        .channel('assignment_requests_changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'assignment_requests',
            filter: `responder_id=eq.${session.user.id}`
          },
          (payload) => {
            console.log('Assignment request change detected:', payload);
            loadData();
          }
        )
        .subscribe();
      channels.push(requestsChannel);

      // Subscribe to new snake detections
      const detectionsChannel = supabase
        .channel('snake_detections_changes')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'snake_detections'
          },
          (payload) => {
            console.log('New detection created:', payload);
            // Reload data to show new unassigned detection
            loadData();
          }
        )
        .subscribe();
      channels.push(detectionsChannel);

      // Subscribe to responder_assignments changes (to update unassigned list)
      const assignmentsChannel = supabase
        .channel('responder_assignments_changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'responder_assignments'
          },
          (payload) => {
            console.log('Assignment change detected:', payload);
            loadData();
          }
        )
        .subscribe();
      channels.push(assignmentsChannel);
    };

    setupSubscriptions();

    return () => {
      channels.forEach(channel => {
        if (channel) {
          supabase.removeChannel(channel);
        }
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const checkUser = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }

      // Check if user is a responder
      const headers: HeadersInit = {};
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const response = await fetch(`/api/admin/responders?user_id=${session.user.id}`, {
        headers
      });
      const data = await response.json();

      if (!response.ok) {
        console.error('Error checking responder status:', data);
        alert(data.error || 'Access denied. Only responders can access this page.');
        router.push('/');
        return;
      }

      if (!data.success || !data.is_responder) {
        alert('Access denied. Only responders can access this page.');
        router.push('/');
        return;
      }

      setUser(session.user);
    } catch (error) {
      console.error('Error checking user:', error);
      router.push('/login');
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Load assignments with auth header
      const assignmentHeaders: HeadersInit = {};
      if (session?.access_token) {
        assignmentHeaders['Authorization'] = `Bearer ${session.access_token}`;
      }

      const assignmentsResponse = await fetch(
        `/api/responders/assignments?responder_id=${session.user.id}&include_unassigned=true`,
        { headers: assignmentHeaders }
      );
      const assignmentsData = await assignmentsResponse.json();

      if (assignmentsData.success) {
        setAssignments(assignmentsData.assignments || []);
        setUnassignedDetections(assignmentsData.unassigned || []);
      }

      // Load pending requests
      const headers: HeadersInit = {};
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const requestsResponse = await fetch('/api/responders/assignment-requests?status=pending', {
        headers
      });
      const requestsData = await requestsResponse.json();

      if (requestsData.success) {
        setPendingRequests(requestsData.requests || []);
      }

      // Automatically process expired requests (no cron needed!)
      // This runs when page loads/refreshes
      try {
        await fetch('/api/responders/process-expired', {
          method: 'POST',
          headers
        });
      } catch (error) {
        // Silent fail - not critical
        console.log('Expired request processing:', error);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClaimDetection = async (detectionId: string) => {
    try {
      setClaiming(detectionId);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        alert('Please log in');
        return;
      }

      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const response = await fetch('/api/responders/assignments', {
        method: 'POST',
        headers,
        body: JSON.stringify({ detectionId })
      });

      const data = await response.json();

      if (data.success) {
        await loadData();
        setSelectedTab('assigned');
      } else {
        alert(data.error || 'Failed to claim detection');
      }
    } catch (error: any) {
      alert('Error: ' + error.message);
    } finally {
      setClaiming(null);
    }
  };

  const handleUpdateStatus = async (assignmentId: string, newStatus: string) => {
    try {
      setUpdating(assignmentId);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        alert('Please log in');
        return;
      }

      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const response = await fetch(`/api/responders/assignments/${assignmentId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ status: newStatus })
      });

      const data = await response.json();

      if (data.success) {
        await loadData();
      } else {
        alert(data.error || 'Failed to update status');
      }
    } catch (error: any) {
      alert('Error: ' + error.message);
    } finally {
      setUpdating(null);
    }
  };

  const handleUnassign = async (assignmentId: string) => {
    if (!confirm('Are you sure you want to unassign from this detection?')) {
      return;
    }

    try {
      setUpdating(assignmentId);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        alert('Please log in');
        return;
      }

      const headers: HeadersInit = {};
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const response = await fetch(`/api/responders/assignments/${assignmentId}`, {
        method: 'DELETE',
        headers
      });

      const data = await response.json();

      if (data.success) {
        await loadData();
        setSelectedTab('available');
      } else {
        alert(data.error || 'Failed to unassign');
      }
    } catch (error: any) {
      alert('Error: ' + error.message);
    } finally {
      setUpdating(null);
    }
  };

  const handleRequestAction = async (requestId: string, action: 'accept' | 'reject') => {
    try {
      setProcessingRequest(requestId);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        alert('Please log in');
        return;
      }

      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      console.log('Sending request action:', { requestId, action });

      const response = await fetch('/api/responders/assignment-requests', {
        method: 'POST',
        headers,
        body: JSON.stringify({ requestId, action })
      });

      const data = await response.json();
      console.log('Response from accept/reject:', data);

      if (!response.ok) {
        throw new Error(data.error || data.details || `HTTP ${response.status}: Failed to ${action} request`);
      }

      if (data.success) {
        // Small delay to ensure database is updated
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Reload data without showing loading spinner
        await reloadDataWithoutLoading();
        
        if (action === 'accept') {
          setSelectedTab('assigned');
          alert('Assignment accepted successfully!');
        } else {
          alert('Request rejected');
        }
      } else {
        alert(data.error || `Failed to ${action} request`);
      }
    } catch (error: any) {
      console.error('Error processing request action:', error);
      alert('Error: ' + error.message);
    } finally {
      setProcessingRequest(null);
    }
  };

  const reloadDataWithoutLoading = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Load assignments with auth header
      const assignmentHeaders: HeadersInit = {};
      if (session?.access_token) {
        assignmentHeaders['Authorization'] = `Bearer ${session.access_token}`;
      }

      const assignmentsResponse = await fetch(
        `/api/responders/assignments?responder_id=${session.user.id}&include_unassigned=true`,
        { headers: assignmentHeaders }
      );
      const assignmentsData = await assignmentsResponse.json();
      console.log('Reloaded assignments:', assignmentsData);

      if (assignmentsData.success) {
        console.log('Reloaded assignments:', {
          count: assignmentsData.assignments?.length || 0,
          assignments: assignmentsData.assignments
        });
        setAssignments(assignmentsData.assignments || []);
        setUnassignedDetections(assignmentsData.unassigned || []);
      } else {
        console.error('Failed to reload assignments:', assignmentsData.error);
      }

      // Load pending requests
      const headers: HeadersInit = {};
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const requestsResponse = await fetch('/api/responders/assignment-requests?status=pending', {
        headers
      });
      const requestsData = await requestsResponse.json();

      if (requestsData.success) {
        setPendingRequests(requestsData.requests || []);
      }
    } catch (error) {
      console.error('Error reloading data:', error);
    }
  };

  const getTimeRemaining = (expiresAt: string) => {
    const now = new Date();
    const expires = new Date(expiresAt);
    const diff = expires.getTime() - now.getTime();
    
    if (diff <= 0) return 'Expired';
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}h ${minutes}m remaining`;
    }
    return `${minutes}m remaining`;
  };

  const statusColors: Record<string, string> = {
    assigned: 'bg-blue-50 text-blue-700 border border-blue-200',
    in_progress: 'bg-amber-50 text-amber-700 border border-amber-200',
    completed: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    cancelled: 'bg-gray-100 text-gray-600 border border-gray-200'
  };

  const statusIcons: Record<string, any> = {
    assigned: Target,
    in_progress: Navigation,
    completed: CheckCircle,
    cancelled: XCircle
  };

  const riskStyles: Record<string, string> = {
    critical: 'text-red-700 bg-red-50',
    high: 'text-orange-700 bg-orange-50',
    medium: 'text-amber-700 bg-amber-50',
    low: 'text-emerald-700 bg-emerald-50',
  };

  if (loading) {
    return (
      <div className="flex h-screen bg-[#f7f8fa]">
        <Sidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <Header />
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#f7f8fa]">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto px-4 md:px-6 py-5">
            {/* Page Header */}
            <div className="section-fade-up flex flex-col md:flex-row md:items-center md:justify-between mb-5">
              <div className="mb-3 md:mb-0">
                <h1 className="text-xl font-bold text-gray-900 tracking-tight">Responders</h1>
                <p className="text-sm text-gray-400 mt-0.5">
                  Manage assignments and respond to snake detection alerts
                </p>
              </div>
              <button
                onClick={loadData}
                disabled={loading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-all duration-200"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>

            {/* Location Picker (compact) */}
            <div className="mb-5 section-fade-up" style={{ animationDelay: '100ms' }}>
              <ResponderLocationPicker onLocationSaved={() => loadData()} />
            </div>

            {/* Tabs */}
            <div className="flex items-center bg-white border border-gray-200 rounded-xl overflow-hidden mb-5 section-fade-up" style={{ animationDelay: '150ms' }}>
              {[
                { key: 'requests', label: 'Requests', count: pendingRequests.length, icon: Bell, highlight: pendingRequests.length > 0 },
                { key: 'assigned', label: 'My Assignments', count: assignments.length },
                { key: 'available', label: 'Available', count: unassignedDetections.length },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setSelectedTab(tab.key as any)}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium transition-all duration-200 ${
                    selectedTab === tab.key
                      ? 'bg-gray-900 text-white'
                      : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
                  }`}
                >
                  {tab.icon && <tab.icon className="h-3.5 w-3.5" />}
                  {tab.label}
                  <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-medium ${
                    selectedTab === tab.key
                      ? 'bg-white/20 text-white'
                      : tab.highlight
                        ? 'bg-red-500 text-white'
                        : 'bg-gray-100 text-gray-500'
                  }`}>
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>

            {/* ─── Assignment Requests Tab ─── */}
            {selectedTab === 'requests' && (
              <div className="space-y-3 section-fade-up" style={{ animationDelay: '200ms' }}>
                {pendingRequests.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center shadow-sm">
                    <Bell className="h-10 w-10 text-gray-200 mx-auto mb-3" />
                    <h3 className="text-base font-semibold text-gray-900 mb-1">No Pending Requests</h3>
                    <p className="text-sm text-gray-400">
                      You&apos;ll receive automatic requests when snakes are detected near your location.
                    </p>
                  </div>
                ) : (
                  pendingRequests.map((request: any, index: number) => {
                    const detection = request.detection as SnakeDetection;
                    if (!detection) return null;

                    const timeRemaining = getTimeRemaining(request.expires_at);
                    const isExpiringSoon = new Date(request.expires_at).getTime() - Date.now() < 30 * 60 * 1000;

                    return (
                      <div
                        key={request.id}
                        className="bg-white rounded-2xl border border-blue-100 overflow-hidden shadow-sm section-fade-up"
                        style={{ animationDelay: `${200 + index * 60}ms` }}
                      >
                        <div className="p-5">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2">
                                <h3 className="text-base font-semibold text-gray-900 truncate">
                                  {detection.species || 'Unknown Species'}
                                </h3>
                                <span className="flex-shrink-0 px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
                                  NEW REQUEST
                                </span>
                              </div>
                              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
                                <span className="flex items-center gap-1">
                                  <MapPin className="h-3.5 w-3.5 text-emerald-500" />
                                  {request.distance_km.toFixed(1)} km away
                                </span>
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3.5 w-3.5" />
                                  {timeRemaining}
                                </span>
                                {detection.risk_level && (
                                  <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium ${riskStyles[detection.risk_level] || ''}`}>
                                    <AlertTriangle className="h-3 w-3" />
                                    {detection.risk_level.toUpperCase()}
                                  </span>
                                )}
                                <span className="text-gray-400">
                                  Confidence: {(detection.confidence * 100).toFixed(0)}%
                                </span>
                              </div>
                              {isExpiringSoon && (
                                <p className="mt-2 text-[11px] text-amber-700 bg-amber-50 px-2 py-1 rounded-lg inline-block">
                                  ⚠️ Expires soon — respond quickly
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <button
                                onClick={() => handleRequestAction(request.id, 'reject')}
                                disabled={processingRequest === request.id}
                                className="px-3 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-all duration-200 disabled:opacity-50"
                              >
                                {processingRequest === request.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : 'Decline'}
                              </button>
                              <button
                                onClick={() => handleRequestAction(request.id, 'accept')}
                                disabled={processingRequest === request.id}
                                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all duration-200 active:scale-95 shadow-sm shadow-emerald-200 disabled:opacity-50"
                              >
                                {processingRequest === request.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <>
                                    <CheckCircle className="h-4 w-4" />
                                    Accept
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* ─── My Assignments Tab ─── */}
            {selectedTab === 'assigned' && (
              <div className="space-y-3 section-fade-up" style={{ animationDelay: '200ms' }}>
                {assignments.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center shadow-sm">
                    <Target className="h-10 w-10 text-gray-200 mx-auto mb-3" />
                    <h3 className="text-base font-semibold text-gray-900 mb-1">No Assignments</h3>
                    <p className="text-sm text-gray-400 mb-4">You don&apos;t have any assigned detections yet.</p>
                    <button
                      onClick={() => setSelectedTab('available')}
                      className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all duration-200 active:scale-95"
                    >
                      View Available Detections
                    </button>
                  </div>
                ) : (
                  assignments.map((assignment, index) => {
                    const detection = assignment.detection as SnakeDetection;
                    if (!detection) return null;

                    const StatusIcon = statusIcons[assignment.status] || Target;

                    return (
                      <div
                        key={assignment.id}
                        className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm section-fade-up"
                        style={{ animationDelay: `${200 + index * 60}ms` }}
                      >
                        <div className="p-5">
                          {/* Header row */}
                          <div className="flex items-start justify-between gap-4 mb-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1.5">
                                <h3 className="text-base font-semibold text-gray-900 truncate">
                                  {detection.species || 'Unknown Species'}
                                </h3>
                                <span className={`flex-shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${statusColors[assignment.status]}`}>
                                  <StatusIcon className="h-3 w-3" />
                                  {assignment.status.replace('_', ' ').toUpperCase()}
                                </span>
                              </div>
                              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3.5 w-3.5" />
                                  Detected {formatDate(detection.timestamp)}
                                </span>
                                {assignment.assigned_at && (
                                  <span className="flex items-center gap-1">
                                    <User className="h-3.5 w-3.5" />
                                    Assigned {formatDate(assignment.assigned_at)}
                                  </span>
                                )}
                                {detection.risk_level && (
                                  <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium ${riskStyles[detection.risk_level] || ''}`}>
                                    <AlertTriangle className="h-3 w-3" />
                                    {detection.risk_level.toUpperCase()}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {assignment.status === 'assigned' && (
                                <>
                                  <button
                                    onClick={() => handleUnassign(assignment.id)}
                                    disabled={updating === assignment.id}
                                    className="px-3 py-2 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-all duration-200 disabled:opacity-50"
                                  >
                                    Unassign
                                  </button>
                                  <button
                                    onClick={() => handleUpdateStatus(assignment.id, 'in_progress')}
                                    disabled={updating === assignment.id}
                                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-amber-500 hover:bg-amber-600 rounded-xl transition-all duration-200 active:scale-95 disabled:opacity-50"
                                  >
                                    {updating === assignment.id ? (
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : 'Mark In Progress'}
                                  </button>
                                </>
                              )}
                              {assignment.status === 'in_progress' && (
                                <>
                                  <button
                                    onClick={() => handleUpdateStatus(assignment.id, 'cancelled')}
                                    disabled={updating === assignment.id}
                                    className="px-3 py-2 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition-all duration-200 disabled:opacity-50"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    onClick={() => handleUpdateStatus(assignment.id, 'completed')}
                                    disabled={updating === assignment.id}
                                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all duration-200 active:scale-95 shadow-sm shadow-emerald-200 disabled:opacity-50"
                                  >
                                    {updating === assignment.id ? (
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                      <>
                                        <CheckCircle className="h-3.5 w-3.5" />
                                        Mark Completed
                                      </>
                                    )}
                                  </button>
                                </>
                              )}
                            </div>
                          </div>

                          {/* Info chips */}
                          <div className="flex flex-wrap gap-2 text-xs mb-3">
                            <span className="px-2.5 py-1 bg-gray-50 rounded-lg text-gray-600">
                              Confidence: <strong>{(detection.confidence * 100).toFixed(0)}%</strong>
                            </span>
                            {detection.venomous !== null && (
                              <span className={`px-2.5 py-1 rounded-lg ${detection.venomous ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
                                {detection.venomous ? 'Venomous' : 'Non-venomous'}
                              </span>
                            )}
                            {detection.latitude && detection.longitude && (
                              <span className="px-2.5 py-1 bg-gray-50 rounded-lg text-gray-500 font-mono">
                                {detection.latitude.toFixed(4)}, {detection.longitude.toFixed(4)}
                              </span>
                            )}
                            {assignment.arrived_at && (
                              <span className="px-2.5 py-1 bg-blue-50 rounded-lg text-blue-700">
                                Arrived {formatDate(assignment.arrived_at)}
                              </span>
                            )}
                          </div>

                          {/* Predictive Path Map (Collapsible) */}
                          {detection.latitude && detection.longitude && detection.status !== 'captured' && (
                            <div className="mt-3 pt-3 border-t border-gray-100">
                              <button
                                onClick={() => toggleMap(assignment.id)}
                                className="w-full flex items-center justify-between py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors group"
                              >
                                <div className="flex items-center gap-2">
                                  <Map className="h-4 w-4 text-emerald-600" />
                                  <span>Predictive Movement Tracking</span>
                                </div>
                                {expandedMaps.has(assignment.id) ? (
                                  <ChevronUp className="h-4 w-4 text-gray-400 group-hover:text-gray-600 transition-colors" />
                                ) : (
                                  <ChevronDown className="h-4 w-4 text-gray-400 group-hover:text-gray-600 transition-colors" />
                                )}
                              </button>
                              <div
                                className={`overflow-hidden transition-all duration-300 ease-in-out ${
                                  expandedMaps.has(assignment.id) ? 'max-h-[800px] opacity-100 mt-2' : 'max-h-0 opacity-0'
                                }`}
                              >
                                {expandedMaps.has(assignment.id) && (
                                  <PredictivePathMap
                                    detectionId={detection.id}
                                    initialLatitude={detection.latitude}
                                    initialLongitude={detection.longitude}
                                    detectionTimestamp={detection.timestamp}
                                    species={detection.species}
                                    status={detection.status}
                                  />
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* ─── Available Detections Tab ─── */}
            {selectedTab === 'available' && (
              <div className="space-y-3 section-fade-up" style={{ animationDelay: '200ms' }}>
                {unassignedDetections.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center shadow-sm">
                    <CheckCircle className="h-10 w-10 text-emerald-300 mx-auto mb-3" />
                    <h3 className="text-base font-semibold text-gray-900 mb-1">All Clear!</h3>
                    <p className="text-sm text-gray-400">All detections have been assigned to responders.</p>
                  </div>
                ) : (
                  unassignedDetections.map((detection, index) => (
                    <div
                      key={detection.id}
                      className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm section-fade-up"
                      style={{ animationDelay: `${200 + index * 60}ms` }}
                    >
                      <div className="p-5">
                        <div className="flex items-start justify-between gap-4 mb-3">
                          <div className="flex-1 min-w-0">
                            <h3 className="text-base font-semibold text-gray-900 truncate mb-1.5">
                              {detection.species || 'Unknown Species'}
                            </h3>
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
                              <span className="flex items-center gap-1">
                                <Clock className="h-3.5 w-3.5" />
                                {formatDate(detection.timestamp)}
                              </span>
                              {detection.risk_level && (
                                <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium ${riskStyles[detection.risk_level] || ''}`}>
                                  <AlertTriangle className="h-3 w-3" />
                                  {detection.risk_level.toUpperCase()}
                                </span>
                              )}
                              {detection.latitude && detection.longitude && (
                                <span className="flex items-center gap-1 text-gray-400 font-mono">
                                  <MapPin className="h-3.5 w-3.5" />
                                  {detection.latitude.toFixed(4)}, {detection.longitude.toFixed(4)}
                                </span>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => handleClaimDetection(detection.id)}
                            disabled={claiming === detection.id}
                            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all duration-200 active:scale-95 shadow-sm shadow-emerald-200 disabled:opacity-50 flex-shrink-0"
                          >
                            {claiming === detection.id ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Claiming...
                              </>
                            ) : (
                              <>
                                <Target className="h-4 w-4" />
                                Claim
                              </>
                            )}
                          </button>
                        </div>

                        {/* Info chips */}
                        <div className="flex flex-wrap gap-2 text-xs">
                          <span className="px-2.5 py-1 bg-gray-50 rounded-lg text-gray-600">
                            Confidence: <strong>{(detection.confidence * 100).toFixed(0)}%</strong>
                          </span>
                          {detection.venomous !== null && (
                            <span className={`px-2.5 py-1 rounded-lg ${detection.venomous ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
                              {detection.venomous ? 'Venomous' : 'Non-venomous'}
                            </span>
                          )}
                          <span className="px-2.5 py-1 bg-gray-50 rounded-lg text-gray-500 capitalize">
                            {detection.status || 'Pending'}
                          </span>
                          {detection.classified_at && (
                            <span className="px-2.5 py-1 bg-gray-50 rounded-lg text-gray-500">
                              Classified {formatDate(detection.classified_at)}
                            </span>
                          )}
                        </div>

                        {/* View Details */}
                        <div className="mt-3 pt-3 border-t border-gray-100">
                          <button
                            onClick={() => setSelectedDetection(detection)}
                            className="text-xs text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-1 transition-colors"
                          >
                            <Map className="h-3.5 w-3.5" />
                            View Details & Prediction
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Detection Details Modal */}
      {selectedDetection && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm"
          onClick={() => setSelectedDetection(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[95vh] flex flex-col overflow-hidden border border-gray-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">
                {selectedDetection.species || 'Unknown Species'}
              </h3>
              <button
                onClick={() => setSelectedDetection(null)}
                className="text-gray-400 hover:text-gray-600 p-1 transition-colors rounded-lg hover:bg-gray-100"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              {selectedDetection.latitude && selectedDetection.longitude ? (
                <PredictivePathMap
                  key={selectedDetection.id}
                  detectionId={selectedDetection.id}
                  initialLatitude={selectedDetection.latitude}
                  initialLongitude={selectedDetection.longitude}
                  detectionTimestamp={selectedDetection.timestamp}
                  species={selectedDetection.species}
                  status={selectedDetection.status}
                />
              ) : (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center">
                  <AlertCircle className="h-8 w-8 text-amber-500 mx-auto mb-2" />
                  <p className="text-amber-800 text-sm font-medium">No location data available for this detection</p>
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
              <button
                onClick={() => setSelectedDetection(null)}
                className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-all duration-200"
              >
                Close
              </button>
              <button
                onClick={() => {
                  handleClaimDetection(selectedDetection.id);
                  setSelectedDetection(null);
                }}
                disabled={claiming === selectedDetection.id}
                className="px-5 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all duration-200 active:scale-95 shadow-sm shadow-emerald-200 disabled:opacity-50"
              >
                {claiming === selectedDetection.id ? 'Claiming...' : 'Claim Detection'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
