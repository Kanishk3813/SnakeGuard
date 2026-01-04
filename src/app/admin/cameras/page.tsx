'use client';

import { useEffect, useState } from 'react';
import { Camera, MapPin, Activity, AlertCircle, CheckCircle, Clock, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

interface CameraStats {
  totalDetections: number;
  recentDetections: number;
  avgConfidence: number;
  lastDetection: {
    timestamp: string;
    confidence: number;
    species?: string;
    risk_level?: string;
  } | null;
}

interface Camera {
  id: string;
  device_id: string;
  name: string;
  description?: string;
  latitude?: number;
  longitude?: number;
  status: 'online' | 'offline' | 'maintenance' | 'error';
  stream_url?: string;
  stream_type: string;
  last_seen?: string;
  created_at: string;
  stats: CameraStats;
}

export default function CamerasPage() {
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCamera, setSelectedCamera] = useState<Camera | null>(null);

  useEffect(() => {
    fetchCameras();
    // Refresh every 30 seconds
    const interval = setInterval(fetchCameras, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchCameras = async () => {
    try {
      // Get session and access token
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        console.error('No session found');
        setLoading(false);
        return;
      }

      const response = await fetch('/api/admin/cameras', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          console.error('Unauthorized - please log in again');
        } else {
          console.error('Failed to fetch cameras:', response.statusText);
        }
        return;
      }

      const data = await response.json();
      if (data.cameras) {
        setCameras(data.cameras);
        // Auto-select first camera if none selected
        if (!selectedCamera && data.cameras.length > 0) {
          setSelectedCamera(data.cameras[0]);
        } else if (selectedCamera) {
          // Update selected camera data
          const updated = data.cameras.find((c: Camera) => c.id === selectedCamera.id);
          if (updated) setSelectedCamera(updated);
        }
      }
    } catch (error) {
      console.error('Error fetching cameras:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
        return 'bg-green-100 text-green-800';
      case 'offline':
        return 'bg-gray-100 text-gray-800';
      case 'maintenance':
        return 'bg-yellow-100 text-yellow-800';
      case 'error':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'online':
        return <CheckCircle className="h-4 w-4" />;
      case 'offline':
        return <AlertCircle className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const formatTimeAgo = (timestamp?: string) => {
    if (!timestamp) return 'Never';
    const now = new Date();
    const time = new Date(timestamp);
    const diffMs = now.getTime() - time.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-600"></div>
      </div>
    );
  }

  if (cameras.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md p-8 text-center">
        <Camera className="h-16 w-16 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No Cameras Registered</h3>
        <p className="text-gray-500 mb-4">
          Register your Raspberry Pi camera device to start monitoring.
        </p>
        <div className="bg-gray-50 rounded-lg p-4 text-left text-sm text-gray-600">
          <p className="font-medium mb-2">To register a camera:</p>
          <ol className="list-decimal list-inside space-y-1">
            <li>Run the database migration: <code className="bg-gray-200 px-1 rounded">database/cameras_schema.sql</code></li>
            <li>On your Raspberry Pi, run: <code className="bg-gray-200 px-1 rounded">python register_device.py</code></li>
            <li>Start the stream server: <code className="bg-gray-200 px-1 rounded">python stream_server.py</code></li>
          </ol>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Camera Monitoring</h1>
          <p className="text-sm text-gray-500 mt-1">
            Monitor live feeds and statistics from deployed cameras
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-500">
            {cameras.filter(c => c.status === 'online').length} / {cameras.length} online
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Camera List */}
        <div className="lg:col-span-1 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Cameras</h2>
          {cameras.map((camera) => (
            <div
              key={camera.id}
              onClick={() => setSelectedCamera(camera)}
              className={`bg-white rounded-lg shadow-md p-4 cursor-pointer transition-all ${
                selectedCamera?.id === camera.id
                  ? 'ring-2 ring-green-500 border-green-500'
                  : 'hover:shadow-lg'
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <Camera className="h-5 w-5 text-gray-600" />
                  <h3 className="font-medium text-gray-900">{camera.name}</h3>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs flex items-center space-x-1 ${getStatusColor(camera.status)}`}>
                  {getStatusIcon(camera.status)}
                  <span className="capitalize">{camera.status}</span>
                </span>
              </div>
              
              {camera.description && (
                <p className="text-sm text-gray-500 mb-2">{camera.description}</p>
              )}
              
              {camera.latitude && camera.longitude && (
                <div className="flex items-center text-xs text-gray-500 mb-2">
                  <MapPin className="h-3 w-3 mr-1" />
                  {camera.latitude.toFixed(4)}, {camera.longitude.toFixed(4)}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-gray-500">Detections:</span>
                  <span className="font-medium ml-1">{camera.stats.totalDetections}</span>
                </div>
                <div>
                  <span className="text-gray-500">Last seen:</span>
                  <span className="font-medium ml-1">{formatTimeAgo(camera.last_seen)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Camera Feed & Stats */}
        <div className="lg:col-span-2 space-y-4">
          {selectedCamera ? (
            <>
              {/* Live Feed */}
              <div className="bg-white rounded-lg shadow-md overflow-hidden">
                <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900">
                    Live Feed - {selectedCamera.name}
                  </h2>
                  <span className={`px-2 py-1 rounded-full text-xs flex items-center space-x-1 ${getStatusColor(selectedCamera.status)}`}>
                    {getStatusIcon(selectedCamera.status)}
                    <span className="capitalize">{selectedCamera.status}</span>
                  </span>
                </div>
                
                <div className="bg-black aspect-video flex items-center justify-center">
                  {selectedCamera.stream_url && selectedCamera.status === 'online' ? (
                    <img
                      src={selectedCamera.stream_url}
                      alt={`Live feed from ${selectedCamera.name}`}
                      className="w-full h-full object-contain"
                      onError={(e) => {
                        // Fallback if stream fails to load
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        const parent = target.parentElement;
                        if (parent) {
                          parent.innerHTML = `
                            <div class="text-white text-center p-4">
                              <p class="mb-2">Unable to load stream</p>
                              <p class="text-sm text-gray-400">Check camera connection</p>
                              <p class="text-xs text-gray-500 mt-2">${selectedCamera.stream_url}</p>
                            </div>
                          `;
                        }
                      }}
                    />
                  ) : (
                    <div className="text-white text-center p-4">
                      <AlertCircle className="h-12 w-12 mx-auto mb-2 text-gray-500" />
                      <p className="text-gray-400">
                        {selectedCamera.status === 'offline' 
                          ? 'Camera is offline' 
                          : 'Stream not available'}
                      </p>
                      {selectedCamera.stream_url && (
                        <p className="text-xs text-gray-500 mt-2">{selectedCamera.stream_url}</p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white rounded-lg shadow-md p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">Total Detections</p>
                      <p className="text-2xl font-bold text-gray-900 mt-1">
                        {selectedCamera.stats.totalDetections}
                      </p>
                    </div>
                    <TrendingUp className="h-8 w-8 text-green-500" />
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    {selectedCamera.stats.recentDetections} in last 24h
                  </p>
                </div>

                <div className="bg-white rounded-lg shadow-md p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">Avg Confidence</p>
                      <p className="text-2xl font-bold text-gray-900 mt-1">
                        {(selectedCamera.stats.avgConfidence * 100).toFixed(1)}%
                      </p>
                    </div>
                    <Activity className="h-8 w-8 text-blue-500" />
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Across all detections
                  </p>
                </div>

                <div className="bg-white rounded-lg shadow-md p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">Last Detection</p>
                      <p className="text-sm font-medium text-gray-900 mt-1">
                        {selectedCamera.stats.lastDetection
                          ? formatTimeAgo(selectedCamera.stats.lastDetection.timestamp)
                          : 'None'}
                      </p>
                    </div>
                    <Clock className="h-8 w-8 text-orange-500" />
                  </div>
                  {selectedCamera.stats.lastDetection && (
                    <p className="text-xs text-gray-500 mt-2">
                      {selectedCamera.stats.lastDetection.species || 'Unknown species'}
                    </p>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="bg-white rounded-lg shadow-md p-8 text-center">
              <Camera className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">Select a camera to view live feed and stats</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

