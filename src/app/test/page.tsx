'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { SnakeDetection } from '@/types';

export default function TestNotificationsPage() {
  const [detections, setDetections] = useState<SnakeDetection[]>([]);
  const [selectedDetection, setSelectedDetection] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string>('');

  // Load detections
  const loadDetections = async () => {
    try {
      const { data, error } = await supabase
        .from('snake_detections')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(20);

      if (error) throw error;
      setDetections(data || []);
      if (data && data.length > 0 && !selectedDetection) {
        setSelectedDetection(data[0].id);
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Test notification
  const testNotification = async () => {
    if (!selectedDetection) {
      setError('Please select a detection');
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const response = await fetch('/api/notifications/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          detectionId: selectedDetection,
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || data.details || 'Failed to send notification');
      }

      setResult(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Load detections on mount
  useEffect(() => {
    loadDetections();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h1 className="text-2xl font-bold mb-6">🧪 Test Notification System</h1>

          {/* Instructions */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <h2 className="font-semibold text-blue-900 mb-2">Quick Test Steps:</h2>
            <ol className="list-decimal list-inside space-y-1 text-sm text-blue-800">
              <li>Make sure you have a user account with location set</li>
              <li>Select a detection below (must have GPS coordinates)</li>
              <li>Click "Send Test Notification"</li>
              <li>Check your email inbox!</li>
            </ol>
          </div>

          {/* Load Detections Button */}
          <div className="mb-6">
            <button
              onClick={loadDetections}
              className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
            >
              🔄 Refresh Detections
            </button>
          </div>

          {/* Detection Selector */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Detection:
            </label>
            <select
              value={selectedDetection}
              onChange={(e) => setSelectedDetection(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">-- Select a detection --</option>
              {detections.map((detection) => (
                <option key={detection.id} value={detection.id}>
                  {detection.species || 'Snake'} - {new Date(detection.timestamp).toLocaleString()} - 
                  {detection.latitude && detection.longitude 
                    ? ` 📍 ${detection.latitude.toFixed(4)}, ${detection.longitude.toFixed(4)}`
                    : ' ❌ No location'
                  }
                </option>
              ))}
            </select>
            {detections.length === 0 && (
              <p className="text-sm text-gray-500 mt-2">
                No detections found. Create one in Supabase or use your Raspberry Pi.
              </p>
            )}
          </div>

          {/* Selected Detection Info */}
          {selectedDetection && (
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              {(() => {
                const detection = detections.find(d => d.id === selectedDetection);
                if (!detection) return null;
                return (
                  <div className="text-sm">
                    <p><strong>Confidence:</strong> {(detection.confidence * 100).toFixed(1)}%</p>
                    <p><strong>Location:</strong> {
                      detection.latitude && detection.longitude
                        ? `${detection.latitude.toFixed(6)}, ${detection.longitude.toFixed(6)}`
                        : 'No location data'
                    }</p>
                    <p><strong>Timestamp:</strong> {new Date(detection.timestamp).toLocaleString()}</p>
                    {(!detection.latitude || !detection.longitude) && (
                      <p className="text-red-600 mt-2">⚠️ This detection has no GPS coordinates. Notifications require location data.</p>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          {/* Test Button */}
          <div className="mb-6">
            <button
              onClick={testNotification}
              disabled={loading || !selectedDetection}
              className="px-6 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
            >
              {loading ? '⏳ Sending...' : '📧 Send Test Notification'}
            </button>
          </div>

          {/* Error Display */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <h3 className="font-semibold text-red-900 mb-2">❌ Error:</h3>
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {/* Result Display */}
          {result && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <h3 className="font-semibold text-green-900 mb-2">✅ Result:</h3>
              <pre className="text-sm text-green-800 bg-white p-3 rounded overflow-auto">
                {JSON.stringify(result, null, 2)}
              </pre>
              {result.emailsSent > 0 && (
                <p className="text-sm text-green-700 mt-2">
                  ✉️ {result.emailsSent} email(s) sent! Check your inbox.
                </p>
              )}
              {result.usersFound === 0 && (
                <p className="text-sm text-yellow-700 mt-2">
                  ⚠️ No users found. Make sure:
                  <ul className="list-disc list-inside mt-1">
                    <li>You have a user account with location set</li>
                    <li>The detection is within your alert radius</li>
                    <li>Email notifications are enabled in Settings</li>
                  </ul>
                </p>
              )}
            </div>
          )}

          {/* Help Section */}
          <div className="mt-8 p-4 bg-gray-50 rounded-lg">
            <h3 className="font-semibold mb-2">💡 Need Help?</h3>
            <ul className="text-sm text-gray-700 space-y-1">
              <li>• See <code className="bg-gray-200 px-1 rounded">TESTING_NOTIFICATIONS.md</code> for detailed guide</li>
              <li>• Make sure SMTP is configured in Supabase Dashboard</li>
              <li>• Check that environment variables are set in <code className="bg-gray-200 px-1 rounded">.env.local</code></li>
              <li>• Verify your user account has location set in Settings</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

