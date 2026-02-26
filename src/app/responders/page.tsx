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
  Phone,
  Mail,
  Bell
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

  useEffect(() => {
    checkUser();
  }, []);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user, selectedTab]);

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

  const statusColors = {
    assigned: 'bg-blue-100 text-blue-800',
    in_progress: 'bg-yellow-100 text-yellow-800',
    completed: 'bg-green-100 text-green-800',
    cancelled: 'bg-gray-100 text-gray-800'
  };

  const statusIcons = {
    assigned: Target,
    in_progress: Navigation,
    completed: CheckCircle,
    cancelled: XCircle
  };

  if (loading) {
    return (
      <div className="flex h-screen bg-gray-50">
        <Sidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <Header />
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-green-600" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-7xl mx-auto">
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Responder Dashboard</h1>
              <p className="text-gray-600">
                Manage your assigned detections and respond to automatic assignment requests
              </p>
            </div>

            {/* Location Picker */}
            <div className="mb-6">
              <ResponderLocationPicker onLocationSaved={() => loadData()} />
            </div>

            {/* Tabs */}
            <div className="flex space-x-1 mb-6 border-b border-gray-200">
              <button
                onClick={() => setSelectedTab('requests')}
                className={`px-6 py-3 font-medium text-sm transition-colors relative ${
                  selectedTab === 'requests'
                    ? 'border-b-2 border-green-600 text-green-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Bell className="h-4 w-4 inline mr-1" />
                Assignment Requests
                {pendingRequests.length > 0 && (
                  <span className="ml-2 px-2 py-0.5 bg-red-500 text-white text-xs rounded-full">
                    {pendingRequests.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setSelectedTab('assigned')}
                className={`px-6 py-3 font-medium text-sm transition-colors ${
                  selectedTab === 'assigned'
                    ? 'border-b-2 border-green-600 text-green-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                My Assignments ({assignments.length})
              </button>
              <button
                onClick={() => setSelectedTab('available')}
                className={`px-6 py-3 font-medium text-sm transition-colors ${
                  selectedTab === 'available'
                    ? 'border-b-2 border-green-600 text-green-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Available Detections ({unassignedDetections.length})
              </button>
            </div>

            {/* Pending Assignment Requests */}
            {selectedTab === 'requests' && (
              <div className="space-y-4">
                {pendingRequests.length === 0 ? (
                  <div className="bg-white rounded-lg shadow p-8 text-center">
                    <Bell className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No Pending Requests</h3>
                    <p className="text-gray-500">
                      You'll receive automatic assignment requests when snakes are detected near your location.
                    </p>
                  </div>
                ) : (
                  pendingRequests.map((request: any) => {
                    const detection = request.detection as SnakeDetection;
                    if (!detection) return null;

                    const timeRemaining = getTimeRemaining(request.expires_at);
                    const isExpiringSoon = new Date(request.expires_at).getTime() - Date.now() < 30 * 60 * 1000; // Less than 30 min

                    return (
                      <div
                        key={request.id}
                        className="bg-white rounded-lg shadow-md border-2 border-blue-200 overflow-hidden"
                      >
                        <div className="p-6">
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <h3 className="text-xl font-semibold text-gray-900">
                                  {detection.species || 'Unknown Species'}
                                </h3>
                                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                                  <Bell className="h-3 w-3 inline mr-1" />
                                  NEW REQUEST
                                </span>
                              </div>
                              <div className="flex items-center gap-4 text-sm text-gray-600 mb-2">
                                <div className="flex items-center gap-1">
                                  <MapPin className="h-4 w-4 text-green-600" />
                                  {request.distance_km.toFixed(1)} km away
                                </div>
                                <div className="flex items-center gap-1">
                                  <Clock className="h-4 w-4" />
                                  {timeRemaining}
                                </div>
                                {detection.risk_level && (
                                  <div className="flex items-center gap-1">
                                    <AlertTriangle className="h-4 w-4" />
                                    {detection.risk_level.toUpperCase()} Risk
                                  </div>
                                )}
                              </div>
                              {isExpiringSoon && (
                                <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
                                  ⚠️ Request expires soon! Please respond quickly.
                                </div>
                              )}
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleRequestAction(request.id, 'accept')}
                                disabled={processingRequest === request.id}
                                className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 font-medium flex items-center gap-2"
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
                              <button
                                onClick={() => handleRequestAction(request.id, 'reject')}
                                disabled={processingRequest === request.id}
                                className="px-6 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:bg-gray-400 font-medium flex items-center gap-2"
                              >
                                {processingRequest === request.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <>
                                    <XCircle className="h-4 w-4" />
                                    Reject
                                  </>
                                )}
                              </button>
                            </div>
                          </div>

                          {/* Detection Info */}
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mt-4 pt-4 border-t border-gray-200">
                            <div>
                              <div className="text-gray-500 mb-1">Detected</div>
                              <div className="font-medium">{formatDate(detection.timestamp)}</div>
                            </div>
                            <div>
                              <div className="text-gray-500 mb-1">Confidence</div>
                              <div className="font-medium">{(detection.confidence * 100).toFixed(0)}%</div>
                            </div>
                            {detection.venomous !== null && (
                              <div>
                                <div className="text-gray-500 mb-1">Type</div>
                                <div className="font-medium">
                                  {detection.venomous ? 'Venomous' : 'Non-venomous'}
                                </div>
                              </div>
                            )}
                            {detection.latitude && detection.longitude && (
                              <div>
                                <div className="text-gray-500 mb-1">Location</div>
                                <div className="font-medium font-mono text-xs">
                                  {detection.latitude.toFixed(4)}, {detection.longitude.toFixed(4)}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* View Details Button */}
                          <div className="mt-4 pt-4 border-t border-gray-200">
                            <button
                              onClick={() => setSelectedDetection(detection)}
                              className="text-sm text-green-600 hover:text-green-700 font-medium flex items-center gap-1"
                            >
                              <Map className="h-4 w-4" />
                              View Full Details & Prediction
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* Assigned Detections */}
            {selectedTab === 'assigned' && (
              <div className="space-y-4">
                {assignments.length === 0 ? (
                  <div className="bg-white rounded-lg shadow p-8 text-center">
                    <Target className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No Assignments</h3>
                    <p className="text-gray-500 mb-4">You don't have any assigned detections yet.</p>
                    <button
                      onClick={() => setSelectedTab('available')}
                      className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                    >
                      View Available Detections
                    </button>
                  </div>
                ) : (
                  assignments.map((assignment) => {
                    const detection = assignment.detection as SnakeDetection;
                    if (!detection) return null;

                    const StatusIcon = statusIcons[assignment.status] || Target;

                    return (
                      <div
                        key={assignment.id}
                        className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden"
                      >
                        <div className="p-6">
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <h3 className="text-xl font-semibold text-gray-900">
                                  {detection.species || 'Unknown Species'}
                                </h3>
                                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusColors[assignment.status]}`}>
                                  <StatusIcon className="h-3 w-3 inline mr-1" />
                                  {assignment.status.replace('_', ' ').toUpperCase()}
                                </span>
                              </div>
                              <div className="flex items-center gap-4 text-sm text-gray-600">
                                <div className="flex items-center gap-1">
                                  <Clock className="h-4 w-4" />
                                  Detected {formatDate(detection.timestamp)}
                                </div>
                                {assignment.assigned_at && (
                                  <div className="flex items-center gap-1">
                                    <User className="h-4 w-4" />
                                    Assigned {formatDate(assignment.assigned_at)}
                                  </div>
                                )}
                                {detection.risk_level && (
                                  <div className="flex items-center gap-1">
                                    <AlertTriangle className="h-4 w-4" />
                                    {detection.risk_level.toUpperCase()} Risk
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="flex gap-2">
                              {assignment.status === 'assigned' && (
                                <>
                                  <button
                                    onClick={() => handleUpdateStatus(assignment.id, 'in_progress')}
                                    disabled={updating === assignment.id}
                                    className="px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 disabled:bg-gray-400 text-sm font-medium"
                                  >
                                    {updating === assignment.id ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      'Mark In Progress'
                                    )}
                                  </button>
                                  <button
                                    onClick={() => handleUnassign(assignment.id)}
                                    disabled={updating === assignment.id}
                                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 disabled:bg-gray-400 text-sm font-medium"
                                  >
                                    Unassign
                                  </button>
                                </>
                              )}
                              {assignment.status === 'in_progress' && (
                                <>
                                  <button
                                    onClick={() => handleUpdateStatus(assignment.id, 'completed')}
                                    disabled={updating === assignment.id}
                                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 text-sm font-medium"
                                  >
                                    {updating === assignment.id ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      'Mark Completed'
                                    )}
                                  </button>
                                  <button
                                    onClick={() => handleUpdateStatus(assignment.id, 'cancelled')}
                                    disabled={updating === assignment.id}
                                    className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:bg-gray-400 text-sm font-medium"
                                  >
                                    Cancel
                                  </button>
                                </>
                              )}
                            </div>
                          </div>

                          {/* Predictive Path Map */}
                          {detection.latitude && detection.longitude && detection.status !== 'captured' && (
                            <div className="mt-4 border-t border-gray-200 pt-4">
                              <PredictivePathMap
                                detectionId={detection.id}
                                initialLatitude={detection.latitude}
                                initialLongitude={detection.longitude}
                                detectionTimestamp={detection.timestamp}
                                species={detection.species}
                                status={detection.status}
                              />
                            </div>
                          )}

                          {/* Detection Details */}
                          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <div className="text-gray-500 mb-1">Confidence</div>
                              <div className="font-medium">{(detection.confidence * 100).toFixed(0)}%</div>
                            </div>
                            {detection.venomous !== null && (
                              <div>
                                <div className="text-gray-500 mb-1">Type</div>
                                <div className="font-medium">
                                  {detection.venomous ? 'Venomous' : 'Non-venomous'}
                                </div>
                              </div>
                            )}
                            {detection.latitude && detection.longitude && (
                              <div>
                                <div className="text-gray-500 mb-1">Location</div>
                                <div className="font-medium font-mono text-xs">
                                  {detection.latitude.toFixed(4)}, {detection.longitude.toFixed(4)}
                                </div>
                              </div>
                            )}
                            {assignment.arrived_at && (
                              <div>
                                <div className="text-gray-500 mb-1">Arrived At</div>
                                <div className="font-medium">{formatDate(assignment.arrived_at)}</div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* Available Detections */}
            {selectedTab === 'available' && (
              <div className="space-y-4">
                {unassignedDetections.length === 0 ? (
                  <div className="bg-white rounded-lg shadow p-8 text-center">
                    <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">All Clear!</h3>
                    <p className="text-gray-500">All detections have been assigned to responders.</p>
                  </div>
                ) : (
                  unassignedDetections.map((detection) => (
                    <div
                      key={detection.id}
                      className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden"
                    >
                      <div className="p-6">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex-1">
                            <h3 className="text-xl font-semibold text-gray-900 mb-2">
                              {detection.species || 'Unknown Species'}
                            </h3>
                            <div className="flex items-center gap-4 text-sm text-gray-600">
                              <div className="flex items-center gap-1">
                                <Clock className="h-4 w-4" />
                                {formatDate(detection.timestamp)}
                              </div>
                              {detection.risk_level && (
                                <div className="flex items-center gap-1">
                                  <AlertTriangle className="h-4 w-4" />
                                  {detection.risk_level.toUpperCase()} Risk
                                </div>
                              )}
                              <div className="flex items-center gap-1">
                                <MapPin className="h-4 w-4" />
                                {detection.latitude?.toFixed(4)}, {detection.longitude?.toFixed(4)}
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={() => handleClaimDetection(detection.id)}
                            disabled={claiming === detection.id}
                            className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 font-medium flex items-center gap-2"
                          >
                            {claiming === detection.id ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Claiming...
                              </>
                            ) : (
                              <>
                                <Target className="h-4 w-4" />
                                Claim Detection
                              </>
                            )}
                          </button>
                        </div>

                        {/* Quick Info */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <div className="text-gray-500 mb-1">Confidence</div>
                            <div className="font-medium">{(detection.confidence * 100).toFixed(0)}%</div>
                          </div>
                          {detection.venomous !== null && (
                            <div>
                              <div className="text-gray-500 mb-1">Type</div>
                              <div className="font-medium">
                                {detection.venomous ? 'Venomous' : 'Non-venomous'}
                              </div>
                            </div>
                          )}
                          {detection.classified_at && (
                            <div>
                              <div className="text-gray-500 mb-1">Classified</div>
                              <div className="font-medium">{formatDate(detection.classified_at)}</div>
                            </div>
                          )}
                          <div>
                            <div className="text-gray-500 mb-1">Status</div>
                            <div className="font-medium capitalize">{detection.status || 'Pending'}</div>
                          </div>
                        </div>

                        {/* View Details Button */}
                        <div className="mt-4 pt-4 border-t border-gray-200">
                          <button
                            onClick={() => setSelectedDetection(detection)}
                            className="text-sm text-green-600 hover:text-green-700 font-medium flex items-center gap-1"
                          >
                            <Map className="h-4 w-4" />
                            View Full Details & Prediction
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Refresh Button */}
            <div className="mt-6 flex justify-end">
              <button
                onClick={loadData}
                disabled={loading}
                className="inline-flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 disabled:bg-gray-50"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>
        </main>
      </div>

      {/* Detection Details Modal */}
      {selectedDetection && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md"
          onClick={() => setSelectedDetection(null)}
        >
          <div
            className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[95vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-2xl font-bold text-gray-900">
                {selectedDetection.species || 'Unknown Species'}
              </h3>
              <button
                onClick={() => setSelectedDetection(null)}
                className="text-gray-400 hover:text-gray-600 p-1 transition-colors"
              >
                <XCircle className="h-6 w-6" />
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
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
                  <AlertCircle className="h-8 w-8 text-yellow-600 mx-auto mb-2" />
                  <p className="text-yellow-800 font-medium">No location data available for this detection</p>
                </div>
              )}
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => {
                  handleClaimDetection(selectedDetection.id);
                  setSelectedDetection(null);
                }}
                disabled={claiming === selectedDetection.id}
                className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 font-medium"
              >
                {claiming === selectedDetection.id ? 'Claiming...' : 'Claim This Detection'}
              </button>
              <button
                onClick={() => setSelectedDetection(null)}
                className="px-6 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

