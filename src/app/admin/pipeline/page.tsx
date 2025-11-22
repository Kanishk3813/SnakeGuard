'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { PipelineMetrics } from '@/types';
import { 
  Activity, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  RefreshCw,
  Play,
  Loader2
} from 'lucide-react';

export default function PipelineDashboard() {
  const [metrics, setMetrics] = useState<PipelineMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalProcessed: 0,
    avgResponseTime: 0,
    successRate: 0,
    classificationsCompleted: 0,
    playbooksAssigned: 0,
    notificationsSent: 0
  });
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    loadMetrics();
  }, []);

  async function loadMetrics() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('pipeline_metrics')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      setMetrics(data || []);

      // Calculate stats
      if (data && data.length > 0) {
        const total = data.length;
        const avgResponseTime = data.reduce((sum, m) => sum + m.response_time_ms, 0) / total;
        const classificationsCompleted = data.filter(m => m.classification_completed).length;
        const playbooksAssigned = data.filter(m => m.playbook_assigned).length;
        const notificationsSent = data.filter(m => m.notifications_sent).length;
        const withErrors = data.filter(m => m.errors && m.errors.length > 0).length;
        const successRate = ((total - withErrors) / total) * 100;

        setStats({
          totalProcessed: total,
          avgResponseTime: Math.round(avgResponseTime),
          successRate: Math.round(successRate * 10) / 10,
          classificationsCompleted,
          playbooksAssigned,
          notificationsSent
        });
      }
    } catch (error: any) {
      console.error('Error loading metrics:', error);
    } finally {
      setLoading(false);
    }
  }

  async function triggerPolling() {
    try {
      setProcessing(true);
      const response = await fetch('/api/detections/poll');
      const result = await response.json();
      
      if (response.ok) {
        alert(`Polling completed: ${result.message}\nProcessed: ${result.processed}, Failed: ${result.failed}`);
        await loadMetrics();
      } else {
        alert(`Polling failed: ${result.message || result.error}`);
      }
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    } finally {
      setProcessing(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-green-600" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pipeline Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">
            Monitor automated detection processing pipeline
          </p>
        </div>
        <button
          onClick={triggerPolling}
          disabled={processing}
          className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400"
        >
          {processing ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <Play className="h-4 w-4 mr-2" />
              Trigger Polling
            </>
          )}
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Processed</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalProcessed}</p>
            </div>
            <Activity className="h-8 w-8 text-green-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Avg Response Time</p>
              <p className="text-2xl font-bold text-gray-900">{stats.avgResponseTime}ms</p>
            </div>
            <Clock className="h-8 w-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Success Rate</p>
              <p className="text-2xl font-bold text-gray-900">{stats.successRate}%</p>
            </div>
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Classifications</p>
              <p className="text-2xl font-bold text-gray-900">{stats.classificationsCompleted}</p>
            </div>
            <AlertTriangle className="h-8 w-8 text-purple-600" />
          </div>
        </div>
      </div>

      {/* Detailed Metrics Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Recent Processing Metrics</h2>
          <button
            onClick={loadMetrics}
            className="text-sm text-green-600 hover:text-green-700 flex items-center"
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Detection ID
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Response Time
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Classification
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Playbook
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Notifications
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Time
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {metrics.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    No pipeline metrics available yet
                  </td>
                </tr>
              ) : (
                metrics.map((metric) => (
                  <tr key={metric.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-mono text-gray-900">
                      {metric.detection_id.substring(0, 8)}...
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {metric.response_time_ms}ms
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {metric.classification_completed ? (
                        <CheckCircle className="h-5 w-5 text-green-600" />
                      ) : (
                        <XCircle className="h-5 w-5 text-gray-400" />
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {metric.playbook_assigned ? (
                        <CheckCircle className="h-5 w-5 text-green-600" />
                      ) : (
                        <XCircle className="h-5 w-5 text-gray-400" />
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {metric.notifications_sent ? (
                        <CheckCircle className="h-5 w-5 text-green-600" />
                      ) : (
                        <XCircle className="h-5 w-5 text-gray-400" />
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {metric.errors && metric.errors.length > 0 ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Error
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Success
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {new Date(metric.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

