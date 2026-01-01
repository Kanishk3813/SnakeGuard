'use client';

import { useEffect, useRef, useState } from 'react';
import { MovementPrediction } from '@/types';
import { MapPin, Clock, AlertCircle, Target, Navigation, Info, RefreshCw } from 'lucide-react';
import { formatDate, calculateDistance } from '@/lib/utils';

interface PredictivePathMapProps {
  detectionId: string;
  initialLatitude: number;
  initialLongitude: number;
  detectionTimestamp: string;
  species?: string | null;
  status?: string;
}

export default function PredictivePathMap({
  detectionId,
  initialLatitude,
  initialLongitude,
  detectionTimestamp,
  species,
  status
}: PredictivePathMapProps) {
  const [prediction, setPrediction] = useState<MovementPrediction | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeElapsed, setTimeElapsed] = useState<string>('');
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const leafletLoadedRef = useRef(false);
  const layersRef = useRef<any[]>([]);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Calculate time elapsed
  useEffect(() => {
    const updateTimeElapsed = () => {
      const elapsed = Date.now() - new Date(detectionTimestamp).getTime();
      const hours = Math.floor(elapsed / (1000 * 60 * 60));
      const minutes = Math.floor((elapsed % (1000 * 60 * 60)) / (1000 * 60));
      
      if (hours > 0) {
        setTimeElapsed(`${hours}h ${minutes}m`);
      } else {
        setTimeElapsed(`${minutes}m`);
      }
    };

    updateTimeElapsed();
    const interval = setInterval(updateTimeElapsed, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [detectionTimestamp]);

  // Load prediction
  const loadPrediction = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`/api/detections/${detectionId}/predict-path`);
      const data = await response.json();
      
      if (data.success && data.prediction) {
        setPrediction(data.prediction);
      } else {
        setError(data.error || 'Failed to load prediction');
      }
    } catch (err: any) {
      setError(err.message || 'Error loading prediction');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPrediction();

    // Auto-refresh every 5 minutes
    let refreshInterval: NodeJS.Timeout | null = null;
    if (autoRefresh) {
      refreshInterval = setInterval(() => {
        loadPrediction();
      }, 5 * 60 * 1000);
    }

    return () => {
      if (refreshInterval) clearInterval(refreshInterval);
    };
  }, [detectionId, autoRefresh]);

  // Initialize map
  useEffect(() => {
    if (status === 'captured') return;
    
    // Wait for container to be available
    const checkAndInit = async () => {
      // Wait a bit for the DOM to be ready
      await new Promise(resolve => setTimeout(resolve, 100));
      
      if (!mapContainerRef.current) {
        console.warn('Map container not available, retrying...');
        // Retry once more
        await new Promise(resolve => setTimeout(resolve, 200));
        if (!mapContainerRef.current) {
          console.error('Map container still not available after retry');
          return;
        }
      }

      if (leafletLoadedRef.current || !mapContainerRef.current) return;

      const initMap = async () => {
        try {
          // Load Leaflet CSS
          if (!document.querySelector('link[href*="leaflet.css"]')) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
            document.head.appendChild(link);
            await new Promise(resolve => setTimeout(resolve, 100));
          }

          const L = (await import('leaflet')).default;
          
          // Final check before creating map
          if (!mapContainerRef.current) {
            console.warn('Map container disappeared before initialization');
            return;
          }

          leafletLoadedRef.current = true;

          const map = L.map(mapContainerRef.current).setView([initialLatitude, initialLongitude], 15);

          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors',
            maxZoom: 19,
          }).addTo(map);

          mapInstanceRef.current = map;

        } catch (error) {
          console.error('Error initializing map:', error);
        }
      };

      initMap();
    };

    checkAndInit();

    // Cleanup
    return () => {
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.remove();
        } catch (e) {
          // Ignore cleanup errors
        }
        mapInstanceRef.current = null;
      }
      leafletLoadedRef.current = false;
    };
  }, [initialLatitude, initialLongitude, status]);

  // Update map with prediction visualization
  useEffect(() => {
    if (!mapInstanceRef.current || !prediction || status === 'captured') return;

    const updateMap = async () => {
      const L = (await import('leaflet')).default;

    // Clear existing layers
    layersRef.current.forEach(layer => {
      if (mapInstanceRef.current && layer) {
        mapInstanceRef.current.removeLayer(layer);
      }
    });
    layersRef.current = [];

    // Add detection point marker
    const detectionMarker = L.marker([initialLatitude, initialLongitude], {
      icon: L.divIcon({
        className: 'custom-marker-detection',
        html: `<div style="
          background: #ef4444;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          border: 3px solid white;
          box-shadow: 0 2px 8px rgba(0,0,0,0.4);
        "></div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      })
    })
      .addTo(mapInstanceRef.current)
      .bindPopup(`
        <div style="padding: 8px;">
          <strong>🐍 Initial Detection</strong><br>
          ${formatDate(detectionTimestamp)}<br>
          ${species ? `Species: ${species}` : ''}
        </div>
      `);
    layersRef.current.push(detectionMarker);

    // Add probability zones (concentric circles)
    prediction.zones.forEach((zone, index) => {
      const circle = L.circle([initialLatitude, initialLongitude], {
        radius: zone.radius,
        color: zone.color,
        fillColor: zone.color,
        fillOpacity: 0.15 - (index * 0.03), // Decreasing opacity
        weight: 2,
        dashArray: '5, 5'
      }).addTo(mapInstanceRef.current);
      
      // Add label
      const label = L.marker([initialLatitude, initialLongitude], {
        icon: L.divIcon({
          className: 'zone-label',
          html: `<div style="
            background: ${zone.color};
            color: white;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: bold;
            white-space: nowrap;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
            transform: translate(${zone.radius * 0.7}px, -${zone.radius * 0.7}px);
          ">${zone.label} (${zone.radius}m)</div>`,
          iconSize: [0, 0],
          iconAnchor: [0, 0]
        })
      }).addTo(mapInstanceRef.current);
      
      layersRef.current.push(circle, label);
    });

    // Add predicted paths (dotted lines)
    prediction.paths.forEach((path, index) => {
      const pathLatLngs = path.points.map(p => [p.lat, p.lng] as [number, number]);
      
      const polyline = L.polyline(pathLatLngs, {
        color: '#8b5cf6',
        weight: 2,
        opacity: 0.6,
        dashArray: '10, 5'
      }).addTo(mapInstanceRef.current);
      
      // Add arrow at end of path
      if (path.points.length > 0) {
        const endPoint = path.points[path.points.length - 1];
        const arrow = L.marker([endPoint.lat, endPoint.lng], {
          icon: L.divIcon({
            className: 'path-arrow',
            html: `<div style="
              width: 0;
              height: 0;
              border-left: 8px solid transparent;
              border-right: 8px solid transparent;
              border-bottom: 12px solid #8b5cf6;
              transform: rotate(${path.direction}deg);
            "></div>`,
            iconSize: [16, 16],
            iconAnchor: [8, 8]
          })
        }).addTo(mapInstanceRef.current);
        layersRef.current.push(arrow);
      }
      
      layersRef.current.push(polyline);
    });

    // Add current position estimate
    const currentPosMarker = L.marker(
      [prediction.currentPosition.latitude, prediction.currentPosition.longitude],
      {
        icon: L.divIcon({
          className: 'custom-marker-current',
          html: `<div style="
            background: #8b5cf6;
            width: 20px;
            height: 20px;
            border-radius: 50%;
            border: 3px solid white;
            box-shadow: 0 2px 8px rgba(0,0,0,0.4);
            animation: pulse 2s infinite;
          "></div>`,
          iconSize: [20, 20],
          iconAnchor: [10, 10]
        })
      }
    )
      .addTo(mapInstanceRef.current)
      .bindPopup(`
        <div style="padding: 8px;">
          <strong>📍 Estimated Current Position</strong><br>
          Confidence: ${(prediction.currentPosition.confidence * 100).toFixed(0)}%<br>
          Distance: ${calculateDistance(
            initialLatitude,
            initialLongitude,
            prediction.currentPosition.latitude,
            prediction.currentPosition.longitude
          ).toFixed(1)} km
        </div>
      `);
    layersRef.current.push(currentPosMarker);

    // Fit map to show all relevant areas
    const bounds = L.latLngBounds([[initialLatitude, initialLongitude]]);
    bounds.extend([prediction.currentPosition.latitude, prediction.currentPosition.longitude]);
    prediction.paths.forEach(path => {
      path.points.forEach(p => bounds.extend([p.lat, p.lng]));
    });
    mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50] });
    };

    updateMap();
  }, [mapInstanceRef.current, prediction, initialLatitude, initialLongitude, detectionTimestamp, species, status]);

  if (status === 'captured') {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
        <p className="text-green-800 font-medium">✅ Snake captured - Tracking complete</p>
      </div>
    );
  }

  const phaseLabels = {
    escape: 'Rapid Escape',
    seeking_shelter: 'Seeking Shelter',
    settling: 'Settling Down',
    established: 'Likely Settled'
  };

  const phaseColors = {
    escape: 'bg-red-100 text-red-800',
    seeking_shelter: 'bg-orange-100 text-orange-800',
    settling: 'bg-yellow-100 text-yellow-800',
    established: 'bg-blue-100 text-blue-800'
  };

  return (
    <div className="space-y-4">
      {/* Header Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-gradient-to-r from-green-50 to-emerald-50 p-4 rounded-lg border border-green-200">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-green-600 rounded-lg">
            <Navigation className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Predictive Movement Tracking</h3>
            <p className="text-sm text-gray-600">Real-time path prediction based on species behavior</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadPrediction}
            disabled={loading}
            className="inline-flex items-center px-3 py-2 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors text-sm"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded"
            />
            Auto-refresh
          </label>
        </div>
      </div>

      {/* Map */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
        <div className="relative">
          <div ref={mapContainerRef} className="h-96 w-full" />
          
          {/* Map Legend */}
          <div className="absolute top-4 right-4 bg-white rounded-lg shadow-lg p-3 text-xs z-[1000] max-w-[180px]">
            <div className="font-semibold text-gray-900 mb-2">Legend</div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                <span>Initial Detection</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-purple-500"></div>
                <span>Estimated Position</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 border-2 border-purple-500 border-dashed"></div>
                <span>Predicted Paths</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500 opacity-30"></div>
                <span>High Probability Zone</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-amber-500 opacity-30"></div>
                <span>Medium Probability Zone</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Information Panel */}
      {prediction && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Current Status */}
          <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-semibold text-gray-900 flex items-center">
                <Clock className="h-5 w-5 mr-2 text-green-600" />
                Current Status
              </h4>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${phaseColors[prediction.phase]}`}>
                {phaseLabels[prediction.phase]}
              </span>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Time Elapsed:</span>
                <span className="font-medium text-gray-900">{timeElapsed}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Max Distance:</span>
                <span className="font-medium text-gray-900">{prediction.maxDistance.toFixed(0)}m</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Est. Speed:</span>
                <span className="font-medium text-gray-900">
                  {prediction.searchRecommendations.estimatedSpeed < 0.1 
                    ? '< 0.1 km/h (Settled)' 
                    : `${prediction.searchRecommendations.estimatedSpeed.toFixed(2)} km/h`}
                </span>
              </div>
              <div className="pt-3 border-t border-gray-200">
                <p className="text-gray-600 text-xs italic">{prediction.searchRecommendations.likelyBehavior}</p>
              </div>
            </div>
          </div>

          {/* Search Recommendations */}
          <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm">
            <h4 className="font-semibold text-gray-900 mb-4 flex items-center">
              <Target className="h-5 w-5 mr-2 text-blue-600" />
              Search Recommendations
            </h4>
            <div className="space-y-3">
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-semibold text-red-900">Priority Search</span>
                  <span className="text-xs text-red-700">{prediction.searchRecommendations.priorityRadius}m radius</span>
                </div>
                <p className="text-xs text-red-700">Highest probability area - search thoroughly</p>
              </div>
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-semibold text-amber-900">Secondary Search</span>
                  <span className="text-xs text-amber-700">{prediction.searchRecommendations.secondaryRadius}m radius</span>
                </div>
                <p className="text-xs text-amber-700">Medium probability - expand search if not found</p>
              </div>
              {prediction.searchRecommendations.extendedRadius > 150 && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-semibold text-blue-900">Extended Search</span>
                    <span className="text-xs text-blue-700">{prediction.searchRecommendations.extendedRadius}m radius</span>
                  </div>
                  <p className="text-xs text-blue-700">Lower probability - only if time permits</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Probability Zones Info */}
      {prediction && (
        <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm">
          <h4 className="font-semibold text-gray-900 mb-4 flex items-center">
            <Info className="h-5 w-5 mr-2 text-purple-600" />
            Probability Zones
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {prediction.zones.map((zone, index) => (
              <div key={index} className="p-3 border rounded-lg" style={{ borderColor: zone.color }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold" style={{ color: zone.color }}>
                    {zone.label}
                  </span>
                  <span className="text-xs text-gray-600">{zone.radius}m</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-gray-200 rounded-full h-2">
                    <div
                      className="h-2 rounded-full transition-all"
                      style={{
                        width: `${zone.probability * 100}%`,
                        backgroundColor: zone.color
                      }}
                    ></div>
                  </div>
                  <span className="text-xs font-medium text-gray-700">
                    {(zone.probability * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex justify-center items-center py-8 bg-white rounded-lg border border-gray-200">
          <RefreshCw className="h-6 w-6 animate-spin text-green-600" />
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <p className="text-sm text-red-800">{error}</p>
          </div>
        </div>
      )}

      {/* Add CSS for pulse animation */}
      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}

