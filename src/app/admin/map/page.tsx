'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { SnakeDetection } from '@/types';
import DetectionMap from '@/components/ui/detection-map';
import { MapPin, Filter, Download, RefreshCw } from 'lucide-react';
import Link from 'next/link';

export default function AdminMapPage() {
  const [loading, setLoading] = useState(true);
  const [detections, setDetections] = useState<SnakeDetection[]>([]);
  const [timeRange, setTimeRange] = useState<'all' | 'week' | 'month'>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [stats, setStats] = useState({
    total: 0,
    withLocation: 0,
    pending: 0,
    captured: 0,
  });

  useEffect(() => {
    fetchDetections();
  }, [timeRange, statusFilter]);

  const fetchDetections = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('snake_detections')
        .select('*')
        .order('timestamp', { ascending: false });

      // Apply time filter
      const now = new Date();
      if (timeRange === 'week') {
        const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        query = query.gte('timestamp', oneWeekAgo.toISOString());
      } else if (timeRange === 'month') {
        const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        query = query.gte('timestamp', oneMonthAgo.toISOString());
      }

      // Apply status filter
      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching detections:', error);
        setDetections([]);
      } else {
        const detectionsData = (data || []) as SnakeDetection[];
        setDetections(detectionsData);

        // Calculate stats
        const withLocation = detectionsData.filter(
          d => d.latitude && d.longitude
        ).length;
        const pending = detectionsData.filter(d => d.status === 'pending').length;
        const captured = detectionsData.filter(d => d.status === 'captured').length;

        setStats({
          total: detectionsData.length,
          withLocation,
          pending,
          captured,
        });
      }
    } catch (error) {
      console.error('Unexpected error:', error);
      setDetections([]);
    } finally {
      setLoading(false);
    }
  };

  const detectionsWithLocation = detections.filter(
    d => d.latitude && d.longitude
  );

  return (
    <div>
      <div className="pb-5 border-b border-gray-200 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold leading-tight text-gray-900">
              Detection Map
            </h1>
            <p className="mt-2 max-w-4xl text-sm text-gray-500">
              Visualize all snake detections on an interactive map
            </p>
          </div>
          <button
            onClick={fetchDetections}
            className="flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-blue-100 rounded-md p-3">
                <MapPin className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Total Detections
                  </dt>
                  <dd>
                    <div className="text-lg font-medium text-gray-900">
                      {stats.total}
                    </div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-green-100 rounded-md p-3">
                <MapPin className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    With Location
                  </dt>
                  <dd>
                    <div className="text-lg font-medium text-gray-900">
                      {stats.withLocation}
                    </div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-yellow-100 rounded-md p-3">
                <MapPin className="h-6 w-6 text-yellow-600" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Pending Review
                  </dt>
                  <dd>
                    <div className="text-lg font-medium text-gray-900">
                      {stats.pending}
                    </div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-green-100 rounded-md p-3">
                <MapPin className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Captured
                  </dt>
                  <dd>
                    <div className="text-lg font-medium text-gray-900">
                      {stats.captured}
                    </div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white shadow rounded-lg p-4 mb-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center space-x-2">
            <Filter className="h-5 w-5 text-gray-400" />
            <span className="text-sm font-medium text-gray-700">Filters:</span>
          </div>

          {/* Time Range Filter */}
          <div className="flex rounded-md shadow-sm">
            <button
              onClick={() => setTimeRange('all')}
              className={`px-4 py-2 text-sm font-medium rounded-l-md border ${
                timeRange === 'all'
                  ? 'bg-green-600 text-white border-green-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              All Time
            </button>
            <button
              onClick={() => setTimeRange('month')}
              className={`px-4 py-2 text-sm font-medium border-t border-b ${
                timeRange === 'month'
                  ? 'bg-green-600 text-white border-green-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              Last 30 Days
            </button>
            <button
              onClick={() => setTimeRange('week')}
              className={`px-4 py-2 text-sm font-medium rounded-r-md border ${
                timeRange === 'week'
                  ? 'bg-green-600 text-white border-green-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              Last 7 Days
            </button>
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="reviewed">Reviewed</option>
            <option value="captured">Captured</option>
            <option value="false_alarm">False Alarm</option>
          </select>
        </div>
      </div>

      {/* Map */}
      {loading ? (
        <div className="flex justify-center items-center h-96 bg-white rounded-lg shadow">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading map...</p>
          </div>
        </div>
      ) : detectionsWithLocation.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <MapPin className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No detections with location data
          </h3>
          <p className="text-gray-500">
            {detections.length === 0
              ? 'No detections found for the selected filters.'
              : `${detections.length} detection(s) found but none have GPS coordinates.`}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-medium text-gray-900">
                  Detection Locations
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  Showing {detectionsWithLocation.length} detection
                  {detectionsWithLocation.length !== 1 ? 's' : ''} on map
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <div className="flex items-center text-sm">
                  <span className="w-3 h-3 rounded-full bg-green-500 mr-1"></span>
                  <span className="text-gray-600">High Confidence</span>
                </div>
                <div className="flex items-center text-sm">
                  <span className="w-3 h-3 rounded-full bg-yellow-500 mr-1"></span>
                  <span className="text-gray-600">Medium</span>
                </div>
                <div className="flex items-center text-sm">
                  <span className="w-3 h-3 rounded-full bg-red-500 mr-1"></span>
                  <span className="text-gray-600">Low</span>
                </div>
              </div>
            </div>
          </div>
          <DetectionMap 
            detections={detectionsWithLocation} 
            height="700px" 
          />
        </div>
      )}

      {/* Recent Detections List */}
      {!loading && detections.length > 0 && (
        <div className="mt-6 bg-white shadow rounded-lg">
          <div className="px-4 py-5 border-b border-gray-200 sm:px-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900">
              Recent Detections
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Species
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Location
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Timestamp
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {detections.slice(0, 10).map((detection) => (
                  <tr key={detection.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      #{detection.id.slice(0, 8)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {detection.species || 'Unknown'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {detection.latitude && detection.longitude ? (
                        <span>
                          {detection.latitude.toFixed(4)}, {detection.longitude.toFixed(4)}
                        </span>
                      ) : (
                        <span className="text-gray-400">No location</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          detection.status === 'pending'
                            ? 'bg-yellow-100 text-yellow-800'
                            : detection.status === 'captured'
                            ? 'bg-green-100 text-green-800'
                            : detection.status === 'false_alarm'
                            ? 'bg-gray-100 text-gray-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {detection.status || 'pending'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(detection.timestamp).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <Link
                        href={`/admin/detections/${detection.id}`}
                        className="text-green-600 hover:text-green-900"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {detections.length > 10 && (
            <div className="bg-gray-50 px-4 py-4 sm:px-6 text-center">
              <Link
                href="/admin/detections"
                className="text-sm font-medium text-green-700 hover:text-green-900"
              >
                View all {detections.length} detections →
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

