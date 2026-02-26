'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Header from '@/components/ui/header';
import Sidebar from '@/components/ui/sidebar';
import { MovementPrediction } from '@/types';
import {
  Navigation,
  MapPin,
  Clock,
  Target,
  RefreshCw,
  Play,
  Settings,
  Info,
  ChevronDown,
  Zap,
  AlertTriangle,
  Eye,
  Bug,
} from 'lucide-react';

// Default location: SRM campus
const DEFAULT_LAT = 12.8231;
const DEFAULT_LNG = 80.0444;

const SPECIES_LIST = [
  { value: 'cobra', label: 'Indian Cobra', venomous: true },
  { value: 'king cobra', label: 'King Cobra', venomous: true },
  { value: 'russell', label: "Russell's Viper", venomous: true },
  { value: 'krait', label: 'Common Krait', venomous: true },
  { value: 'saw-scaled', label: 'Saw-scaled Viper', venomous: true },
  { value: 'viper', label: 'Pit Viper', venomous: true },
  { value: 'rat snake', label: 'Rat Snake', venomous: false },
  { value: 'python', label: 'Indian Python', venomous: false },
  { value: 'whip snake', label: 'Whip Snake', venomous: false },
  { value: 'common', label: 'Unknown / Common', venomous: false },
];

export default function PathTestPage() {
  // Input state
  const [latitude, setLatitude] = useState(DEFAULT_LAT);
  const [longitude, setLongitude] = useState(DEFAULT_LNG);
  const [species, setSpecies] = useState('cobra');
  const [venomous, setVenomous] = useState(true);
  const [minutesAgo, setMinutesAgo] = useState(5);
  const [detectionId, setDetectionId] = useState('test-' + Date.now().toString(36));

  // Output state
  const [prediction, setPrediction] = useState<MovementPrediction | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [oldPrediction, setOldPrediction] = useState<MovementPrediction | null>(null);

  // Map
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const leafletLoadedRef = useRef(false);
  const layersRef = useRef<any[]>([]);

  // Auto-select venomous when species changes
  useEffect(() => {
    const sp = SPECIES_LIST.find(s => s.value === species);
    if (sp) setVenomous(sp.venomous);
  }, [species]);

  // Initialize map
  useEffect(() => {
    const initMap = async () => {
      await new Promise(r => setTimeout(r, 150));
      if (!mapContainerRef.current || leafletLoadedRef.current) return;

      // Load CSS
      if (!document.querySelector('link[href*="leaflet.css"]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
        await new Promise(r => setTimeout(r, 200));
      }

      const L = (await import('leaflet')).default;
      if (!mapContainerRef.current) return;

      leafletLoadedRef.current = true;
      const map = L.map(mapContainerRef.current).setView([latitude, longitude], 16);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap',
        maxZoom: 19,
      }).addTo(map);

      mapInstanceRef.current = map;
    };

    initMap();
    return () => {
      if (mapInstanceRef.current) {
        try { mapInstanceRef.current.remove(); } catch {}
        mapInstanceRef.current = null;
      }
      leafletLoadedRef.current = false;
    };
  }, []);

  // Run prediction
  const runPrediction = useCallback(async () => {
    setLoading(true);
    setError(null);
    setPrediction(null);
    setOldPrediction(null);

    const timestamp = new Date(Date.now() - minutesAgo * 60 * 1000).toISOString();

    try {
      // New model
      const res = await fetch('/api/path-test/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          latitude, longitude, timestamp, species, venomous, detectionId,
        }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.success) {
        setPrediction(data.prediction);
      } else {
        setError(data.error || 'Prediction failed');
      }

      // If compare mode, also fetch old model (requires a real detection in DB)
      // For testing purposes, we skip this unless there's a real detection ID
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [latitude, longitude, minutesAgo, species, venomous, detectionId]);

  // Update map when prediction changes
  useEffect(() => {
    if (!mapInstanceRef.current || !prediction) return;

    const updateMap = async () => {
      const L = (await import('leaflet')).default;
      const map = mapInstanceRef.current;

      // Clear layers
      layersRef.current.forEach(layer => {
        try { map.removeLayer(layer); } catch {}
      });
      layersRef.current = [];

      // Detection marker
      const detMarker = L.marker([latitude, longitude], {
        icon: L.divIcon({
          className: '',
          html: `<div style="
            background:#ef4444; width:26px; height:26px; border-radius:50%;
            border:3px solid white; box-shadow:0 2px 8px rgba(0,0,0,0.5);
            display:flex; align-items:center; justify-content:center;
            font-size:14px;
          ">🐍</div>`,
          iconSize: [26, 26], iconAnchor: [13, 13],
        }),
      }).addTo(map);
      detMarker.bindPopup(`<b>Detection Point</b><br>Species: ${species}<br>${minutesAgo} min ago`);
      layersRef.current.push(detMarker);

      // Probability zones
      prediction.zones.forEach((zone, idx) => {
        const circle = L.circle([latitude, longitude], {
          radius: zone.radius,
          color: zone.color,
          fillColor: zone.color,
          fillOpacity: 0.12 - idx * 0.03,
          weight: 2,
          dashArray: '6,4',
        }).addTo(map);

        circle.bindPopup(`<b>${zone.label}</b><br>Radius: ${zone.radius}m<br>Probability: ${(zone.probability * 100).toFixed(0)}%`);
        layersRef.current.push(circle);
      });

      // Predicted paths
      const pathColors = ['#8b5cf6', '#6366f1', '#a78bfa', '#7c3aed', '#c084fc', '#818cf8'];
      prediction.paths.forEach((path, idx) => {
        const latlngs = path.points.map(p => [p.lat, p.lng] as [number, number]);
        const line = L.polyline(latlngs, {
          color: pathColors[idx % pathColors.length],
          weight: 2.5,
          opacity: 0.5 + path.confidence,
          dashArray: '8,5',
        }).addTo(map);

        line.bindPopup(`Path ${idx + 1}<br>Bearing: ${path.direction}°<br>Distance: ${path.distance}m<br>Confidence: ${(path.confidence * 100).toFixed(0)}%`);
        layersRef.current.push(line);

        // Endpoint arrow
        if (path.points.length > 0) {
          const end = path.points[path.points.length - 1];
          const endMarker = L.circleMarker([end.lat, end.lng], {
            radius: 4,
            color: pathColors[idx % pathColors.length],
            fillColor: pathColors[idx % pathColors.length],
            fillOpacity: 0.8,
          }).addTo(map);
          layersRef.current.push(endMarker);
        }
      });

      // Estimated current position
      const estMarker = L.marker(
        [prediction.currentPosition.latitude, prediction.currentPosition.longitude],
        {
          icon: L.divIcon({
            className: '',
            html: `<div style="
              background:#8b5cf6; width:22px; height:22px; border-radius:50%;
              border:3px solid white; box-shadow:0 0 12px rgba(139,92,246,0.6);
              animation:pulse 2s infinite;
            "></div>`,
            iconSize: [22, 22], iconAnchor: [11, 11],
          }),
        }
      ).addTo(map);
      estMarker.bindPopup(`<b>Estimated Position</b><br>Confidence: ${(prediction.currentPosition.confidence * 100).toFixed(0)}%`);
      layersRef.current.push(estMarker);

      // Fit bounds
      const bounds = L.latLngBounds([[latitude, longitude]]);
      bounds.extend([prediction.currentPosition.latitude, prediction.currentPosition.longitude]);
      prediction.paths.forEach(p => p.points.forEach(pt => bounds.extend([pt.lat, pt.lng])));
      map.fitBounds(bounds, { padding: [60, 60] });
    };

    updateMap();
  }, [prediction, latitude, longitude]);

  // Phase info
  const phaseLabels: Record<string, string> = {
    escape: '🔴 Rapid Escape',
    seeking_shelter: '🟠 Seeking Shelter',
    settling: '🟡 Settling Down',
    established: '🔵 Established',
  };

  const phaseColors: Record<string, string> = {
    escape: 'bg-red-500/10 text-red-400 border-red-500/30',
    seeking_shelter: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
    settling: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
    established: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  };

  return (
    <div className="flex h-screen bg-gray-950">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="max-w-7xl mx-auto">
            {/* Page Header */}
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-purple-500/10 rounded-lg">
                <Bug className="w-6 h-6 text-purple-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Path Prediction Lab</h1>
                <p className="text-sm text-gray-400">Experimental improved snake movement prediction model</p>
              </div>
              <div className="ml-auto px-3 py-1 rounded-full text-xs font-medium bg-purple-500/10 text-purple-400 border border-purple-500/30">
                Experimental
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              {/* Left: Map + Controls */}
              <div className="xl:col-span-2 space-y-4">

                {/* Map */}
                <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
                  <div className="relative">
                    <div ref={mapContainerRef} className="h-[500px] w-full" />
                    
                    {/* Legend */}
                    <div className="absolute top-3 right-3 bg-gray-900/90 backdrop-blur rounded-lg p-3 text-xs z-[1000] border border-gray-700">
                      <div className="font-semibold text-white mb-2">Legend</div>
                      <div className="space-y-1.5 text-gray-300">
                        <div className="flex items-center gap-2">
                          <span className="text-sm">🐍</span> Detection Point
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-purple-500" /> Estimated Position
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-0.5 bg-purple-400 border-dashed border-b" /> Predicted Paths
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-red-500/30 border border-red-500" /> High Probability
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-amber-500/30 border border-amber-500" /> Medium Probability
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-blue-500/30 border border-blue-500" /> Low Probability
                        </div>
                      </div>
                    </div>

                    {/* Loading overlay */}
                    {loading && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-[1001]">
                        <div className="bg-gray-900 rounded-xl p-6 flex flex-col items-center">
                          <RefreshCw className="w-8 h-8 text-purple-400 animate-spin mb-3" />
                          <p className="text-white text-sm">Computing prediction...</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Controls */}
                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                    {/* Species */}
                    <div className="relative">
                      <label className="block text-xs text-gray-500 mb-1.5 uppercase tracking-wider font-medium">Species</label>
                      <select
                        value={species}
                        onChange={(e) => setSpecies(e.target.value)}
                        className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2.5 appearance-none focus:outline-none focus:ring-2 focus:ring-purple-500"
                      >
                        {SPECIES_LIST.map(s => (
                          <option key={s.value} value={s.value}>
                            {s.label} {s.venomous ? '☠️' : '✅'}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-3 top-[38px] w-4 h-4 text-gray-400 pointer-events-none" />
                    </div>

                    {/* Time elapsed */}
                    <div>
                      <label className="block text-xs text-gray-500 mb-1.5 uppercase tracking-wider font-medium">
                        Time Elapsed: {minutesAgo < 60 ? `${minutesAgo} min` : `${(minutesAgo / 60).toFixed(1)} hrs`}
                      </label>
                      <input
                        type="range"
                        min="1"
                        max="480"
                        value={minutesAgo}
                        onChange={(e) => setMinutesAgo(parseInt(e.target.value))}
                        className="w-full accent-purple-500 mt-2"
                      />
                      <div className="flex justify-between text-[10px] text-gray-600 mt-1">
                        <span>1m</span><span>1h</span><span>4h</span><span>8h</span>
                      </div>
                    </div>

                    {/* Venomous toggle */}
                    <div>
                      <label className="block text-xs text-gray-500 mb-1.5 uppercase tracking-wider font-medium">Classification</label>
                      <div className="flex items-center gap-3 mt-1">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={venomous}
                            onChange={(e) => setVenomous(e.target.checked)}
                            className="rounded accent-red-500"
                          />
                          <span className={`text-sm font-medium ${venomous ? 'text-red-400' : 'text-green-400'}`}>
                            {venomous ? '☠️ Venomous' : '✅ Non-venomous'}
                          </span>
                        </label>
                      </div>
                    </div>

                    {/* Run button */}
                    <div className="flex items-end">
                      <button
                        onClick={runPrediction}
                        disabled={loading}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 text-white rounded-lg transition-colors font-medium"
                      >
                        {loading ? (
                          <><RefreshCw className="w-4 h-4 animate-spin" /> Computing...</>
                        ) : (
                          <><Play className="w-4 h-4" /> Run Prediction</>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Advanced settings */}
                  <button
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1"
                  >
                    <Settings className="w-3 h-3" />
                    {showAdvanced ? 'Hide' : 'Show'} advanced settings
                  </button>

                  {showAdvanced && (
                    <div className="mt-3 pt-3 border-t border-gray-800 grid grid-cols-2 md:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Latitude</label>
                        <input
                          type="number"
                          step="0.0001"
                          value={latitude}
                          onChange={(e) => setLatitude(parseFloat(e.target.value))}
                          className="w-full bg-gray-800 border border-gray-700 text-white rounded px-3 py-1.5 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Longitude</label>
                        <input
                          type="number"
                          step="0.0001"
                          value={longitude}
                          onChange={(e) => setLongitude(parseFloat(e.target.value))}
                          className="w-full bg-gray-800 border border-gray-700 text-white rounded px-3 py-1.5 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Detection ID (seed)</label>
                        <input
                          type="text"
                          value={detectionId}
                          onChange={(e) => setDetectionId(e.target.value)}
                          className="w-full bg-gray-800 border border-gray-700 text-white rounded px-3 py-1.5 text-sm font-mono"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Error */}
                {error && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-center gap-3">
                    <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
                    <p className="text-sm text-red-300">{error}</p>
                  </div>
                )}
              </div>

              {/* Right: Results Panel */}
              <div className="space-y-4">
                {/* Phase Status */}
                {prediction && (
                  <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold text-white flex items-center gap-2">
                        <Clock className="w-4 h-4 text-purple-400" />
                        Movement Phase
                      </h3>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${phaseColors[prediction.phase]}`}>
                        {phaseLabels[prediction.phase]}
                      </span>
                    </div>
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Time Elapsed</span>
                        <span className="text-white font-medium">
                          {prediction.timeElapsedHours < 1
                            ? `${Math.round(prediction.timeElapsedHours * 60)} minutes`
                            : `${prediction.timeElapsedHours.toFixed(1)} hours`}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Max Distance</span>
                        <span className="text-white font-medium">{prediction.maxDistance}m</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Est. Speed</span>
                        <span className="text-white font-medium">
                          {prediction.searchRecommendations.estimatedSpeed < 0.01
                            ? '< 0.01 km/h (settled)'
                            : `${prediction.searchRecommendations.estimatedSpeed.toFixed(3)} km/h`}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Position Confidence</span>
                        <span className="text-white font-medium">
                          {(prediction.currentPosition.confidence * 100).toFixed(0)}%
                        </span>
                      </div>
                      <div className="pt-3 border-t border-gray-800">
                        <p className="text-xs text-gray-400 italic">{prediction.searchRecommendations.likelyBehavior}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Search Recommendations */}
                {prediction && (
                  <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                    <h3 className="font-semibold text-white flex items-center gap-2 mb-4">
                      <Target className="w-4 h-4 text-blue-400" />
                      Search Zones
                    </h3>
                    <div className="space-y-3">
                      {prediction.zones.map((zone, i) => (
                        <div key={i} className="rounded-lg p-3" style={{ background: `${zone.color}15`, border: `1px solid ${zone.color}40` }}>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-sm font-semibold" style={{ color: zone.color }}>{zone.label}</span>
                            <span className="text-xs text-gray-400">{zone.radius}m radius</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-gray-800 rounded-full h-2">
                              <div
                                className="h-2 rounded-full transition-all duration-500"
                                style={{ width: `${zone.probability * 100}%`, backgroundColor: zone.color }}
                              />
                            </div>
                            <span className="text-xs font-bold text-white">{(zone.probability * 100).toFixed(0)}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Path Details */}
                {prediction && (
                  <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                    <h3 className="font-semibold text-white flex items-center gap-2 mb-4">
                      <Navigation className="w-4 h-4 text-purple-400" />
                      Predicted Paths ({prediction.paths.length})
                    </h3>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {prediction.paths
                        .sort((a, b) => b.confidence - a.confidence)
                        .map((path, i) => (
                          <div key={i} className="flex items-center justify-between px-3 py-2 bg-gray-800/50 rounded-lg text-sm">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full" style={{ background: ['#8b5cf6','#6366f1','#a78bfa','#7c3aed','#c084fc','#818cf8'][i] }} />
                              <span className="text-gray-300">Path {i + 1}</span>
                            </div>
                            <div className="flex items-center gap-4 text-xs text-gray-500">
                              <span>{path.direction}°</span>
                              <span>{path.distance}m</span>
                              <span className="font-bold text-white">{(path.confidence * 100).toFixed(0)}%</span>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Quick presets */}
                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                  <h3 className="font-semibold text-white flex items-center gap-2 mb-3">
                    <Zap className="w-4 h-4 text-yellow-400" />
                    Quick Scenarios
                  </h3>
                  <div className="space-y-2">
                    {[
                      { label: 'Just spotted (2 min)', mins: 2, sp: 'cobra' },
                      { label: 'Reported 15 min ago', mins: 15, sp: 'russell' },
                      { label: 'Seen 1 hour ago', mins: 60, sp: 'krait' },
                      { label: 'Morning sighting (4h)', mins: 240, sp: 'rat snake' },
                      { label: 'Python last night (8h)', mins: 480, sp: 'python' },
                    ].map((preset, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          setMinutesAgo(preset.mins);
                          setSpecies(preset.sp);
                          const sp = SPECIES_LIST.find(s => s.value === preset.sp);
                          if (sp) setVenomous(sp.venomous);
                          setDetectionId('test-preset-' + i + '-' + Date.now().toString(36));
                        }}
                        className="w-full text-left px-3 py-2 bg-gray-800/50 hover:bg-gray-800 rounded-lg text-sm text-gray-300 hover:text-white transition-colors"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Info */}
                {!prediction && (
                  <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                    <div className="flex items-start gap-3">
                      <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                      <div className="text-xs text-gray-400 space-y-2">
                        <p className="font-medium text-gray-300">Improvements in this model</p>
                        <ul className="space-y-1 list-disc list-inside">
                          <li>Species-specific burst/cruise speeds</li>
                          <li>Time-of-day awareness (nocturnal species)</li>
                          <li>Dynamic probability zones (scale with distance)</li>
                          <li>Shelter preference affects zone probabilities</li>
                          <li>Exponential probability decay (not linear)</li>
                          <li>Smooth curved paths (not random walk)</li>
                          <li>6 directional paths with weighted clustering</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>

      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; box-shadow: 0 0 12px rgba(139,92,246,0.6); }
          50% { opacity: 0.6; box-shadow: 0 0 20px rgba(139,92,246,0.9); }
        }
      `}</style>
    </div>
  );
}
