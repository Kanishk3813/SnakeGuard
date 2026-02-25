'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Clock,
  FlaskConical,
  Loader2,
  MapPin,
  Send,
  Skull,
  Sparkles,
  XCircle,
  Zap,
  RotateCcw,
  ExternalLink,
  Info,
} from 'lucide-react';
import Link from 'next/link';

/* ─── snake species presets ────────────────────────────────────────────── */
const SPECIES_PRESETS = [
  { species: 'Indian Cobra (Naja naja)', venomous: true, risk: 'critical', confidence: 0.94 },
  { species: 'King Cobra (Ophiophagus hannah)', venomous: true, risk: 'critical', confidence: 0.91 },
  { species: 'Russell\'s Viper (Daboia russelii)', venomous: true, risk: 'critical', confidence: 0.93 },
  { species: 'Common Krait (Bungarus caeruleus)', venomous: true, risk: 'critical', confidence: 0.90 },
  { species: 'Saw-scaled Viper (Echis carinatus)', venomous: true, risk: 'high', confidence: 0.88 },
  { species: 'Indian Rock Python (Python molurus)', venomous: false, risk: 'medium', confidence: 0.92 },
  { species: 'Rat Snake (Ptyas mucosa)', venomous: false, risk: 'low', confidence: 0.89 },
  { species: 'Checkered Keelback (Fowlea piscator)', venomous: false, risk: 'low', confidence: 0.87 },
  { species: 'Vine Snake (Ahaetulla nasuta)', venomous: false, risk: 'low', confidence: 0.85 },
  { species: 'Unknown Species', venomous: false, risk: 'medium', confidence: 0.60 },
];

/* ─── location presets ────────────────────────────────────────────────── */
const LOCATION_PRESETS = [
  { name: 'Building A – Main Entrance', lat: 12.9716, lng: 77.5946 },
  { name: 'Building B – Parking Lot', lat: 12.9720, lng: 77.5955 },
  { name: 'Building C – Garden Area', lat: 12.9710, lng: 77.5935 },
  { name: 'Building D – Loading Dock', lat: 12.9725, lng: 77.5940 },
  { name: 'Perimeter Fence – North', lat: 12.9732, lng: 77.5948 },
  { name: 'Perimeter Fence – East', lat: 12.9718, lng: 77.5965 },
  { name: 'Water Tank Area', lat: 12.9708, lng: 77.5952 },
  { name: 'Staff Quarters', lat: 12.9700, lng: 77.5930 },
];

const RISK_COLORS: Record<string, string> = {
  low: 'bg-emerald-100 text-emerald-700 border-emerald-300',
  medium: 'bg-amber-100 text-amber-700 border-amber-300',
  high: 'bg-orange-100 text-orange-700 border-orange-300',
  critical: 'bg-red-100 text-red-700 border-red-300',
};

const RISK_DOT_COLORS: Record<string, string> = {
  low: 'bg-emerald-500',
  medium: 'bg-amber-500',
  high: 'bg-orange-500',
  critical: 'bg-red-500',
};

/* ─── pipeline step interface ─────────────────────────────────────────── */
interface PipelineStep {
  key: string;
  label: string;
  status: 'idle' | 'running' | 'done' | 'error';
  detail?: string;
}

/* ═══════════════════════════════════════════════════════════════════════ */

export default function SimulatePage() {
  /* ── form state ──────────────────────────────────────────────────── */
  const [species, setSpecies] = useState(SPECIES_PRESETS[0].species);
  const [venomous, setVenomous] = useState(SPECIES_PRESETS[0].venomous);
  const [confidence, setConfidence] = useState(SPECIES_PRESETS[0].confidence);
  const [riskLevel, setRiskLevel] = useState(SPECIES_PRESETS[0].risk);
  const [lat, setLat] = useState(LOCATION_PRESETS[0].lat);
  const [lng, setLng] = useState(LOCATION_PRESETS[0].lng);
  const [locationName, setLocationName] = useState(LOCATION_PRESETS[0].name);
  const [notes, setNotes] = useState('');
  const [triggerPipeline, setTriggerPipeline] = useState(true);

  /* ── UI state ────────────────────────────────────────────────────── */
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSpeciesDropdown, setShowSpeciesDropdown] = useState(false);
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);
  const [pipelineSteps, setPipelineSteps] = useState<PipelineStep[]>([]);
  const [recentSimulations, setRecentSimulations] = useState<any[]>([]);
  const [mapReady, setMapReady] = useState(false);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const speciesRef = useRef<HTMLDivElement>(null);
  const locationRef = useRef<HTMLDivElement>(null);

  /* ── close dropdowns on outside click ────────────────────────────── */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (speciesRef.current && !speciesRef.current.contains(e.target as Node)) {
        setShowSpeciesDropdown(false);
      }
      if (locationRef.current && !locationRef.current.contains(e.target as Node)) {
        setShowLocationDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  /* ── Leaflet map ────────────────────────────────────────────────── */
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let isMounted = true;
    const initMap = async () => {
      const L = (await import('leaflet')).default;

      if (!isMounted || !mapContainerRef.current) return;

      // Prevent duplicate initialisation
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }

      const map = L.map(mapContainerRef.current, {
        center: [lat, lng],
        zoom: 16,
        zoomControl: true,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
      }).addTo(map);

      const snakeIcon = L.divIcon({
        html: `<div style="background:#ef4444;width:28px;height:28px;border-radius:50%;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center">
                 <span style="font-size:14px">🐍</span>
               </div>`,
        className: '',
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });

      const marker = L.marker([lat, lng], {
        icon: snakeIcon,
        draggable: true,
      }).addTo(map);

      marker.on('dragend', () => {
        const pos = marker.getLatLng();
        setLat(parseFloat(pos.lat.toFixed(6)));
        setLng(parseFloat(pos.lng.toFixed(6)));
        setLocationName('Custom (map pin)');
      });

      map.on('click', (e: any) => {
        const { lat: clat, lng: clng } = e.latlng;
        marker.setLatLng([clat, clng]);
        setLat(parseFloat(clat.toFixed(6)));
        setLng(parseFloat(clng.toFixed(6)));
        setLocationName('Custom (map pin)');
      });

      mapRef.current = map;
      markerRef.current = marker;
      setMapReady(true);
    };

    initMap();

    return () => {
      isMounted = false;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── update marker position when lat/lng state changes from preset */
  useEffect(() => {
    if (markerRef.current && mapRef.current) {
      markerRef.current.setLatLng([lat, lng]);
      mapRef.current.setView([lat, lng], mapRef.current.getZoom(), { animate: true });
    }
  }, [lat, lng]);

  /* ── fetch recent simulations ───────────────────────────────────── */
  const fetchRecentSimulations = useCallback(async () => {
    const { data } = await supabase
      .from('snake_detections')
      .select('id, species, risk_level, confidence, created_at, status, latitude, longitude, notes')
      .ilike('notes', '%[SIMULATED]%')
      .order('created_at', { ascending: false })
      .limit(5);
    setRecentSimulations(data || []);
  }, []);

  useEffect(() => {
    fetchRecentSimulations();
  }, [fetchRecentSimulations]);

  /* ── pick species preset ────────────────────────────────────────── */
  const pickSpecies = (preset: typeof SPECIES_PRESETS[0]) => {
    setSpecies(preset.species);
    setVenomous(preset.venomous);
    setRiskLevel(preset.risk);
    setConfidence(preset.confidence);
    setShowSpeciesDropdown(false);
  };

  /* ── pick location preset ───────────────────────────────────────── */
  const pickLocation = (preset: typeof LOCATION_PRESETS[0]) => {
    setLat(preset.lat);
    setLng(preset.lng);
    setLocationName(preset.name);
    setShowLocationDropdown(false);
  };

  /* ── submit simulation ──────────────────────────────────────────── */
  const handleSimulate = async () => {
    setSubmitting(true);
    setResult(null);
    setError(null);

    // Build pipeline tracker
    const steps: PipelineStep[] = [
      { key: 'insert', label: 'Insert detection record', status: 'running' },
      ...(triggerPipeline
        ? [
            { key: 'classify', label: 'Classify species', status: 'idle' as const },
            { key: 'playbook', label: 'Assign playbook', status: 'idle' as const },
            { key: 'notify', label: 'Send notifications', status: 'idle' as const },
            { key: 'incident', label: 'Create incident', status: 'idle' as const },
          ]
        : []),
    ];
    setPipelineSteps([...steps]);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('You must be logged in as an admin.');
        setSubmitting(false);
        return;
      }

      const response = await fetch('/api/admin/simulate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          species,
          confidence,
          latitude: lat,
          longitude: lng,
          risk_level: riskLevel,
          venomous,
          notes,
          triggerPipeline,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      // Update pipeline steps based on result
      const updateStep = (key: string, status: PipelineStep['status'], detail?: string) => {
        const idx = steps.findIndex((s) => s.key === key);
        if (idx >= 0) {
          steps[idx] = { ...steps[idx], status, detail };
          setPipelineSteps([...steps]);
        }
      };

      updateStep('insert', 'done', `ID: ${data.detection?.id?.slice(0, 8)}...`);

      if (triggerPipeline && data.pipeline) {
        const p = data.pipeline;

        // Classify
        updateStep('classify', p.classificationCompleted ? 'done' : 'error',
          p.classificationCompleted ? 'Pre-classified (simulated)' : 'Skipped');

        // Playbook
        updateStep('playbook', p.playbookAssigned ? 'done' : 'error',
          p.playbookAssigned ? 'Playbook assigned' : 'No matching playbook');

        // Notify
        updateStep('notify', p.notificationsSent ? 'done' : 'error',
          p.notificationsSent ? 'Notifications sent' : 'No notifications sent');

        // Incident
        updateStep('incident', p.incidentCreated ? 'done' : 'error',
          p.incidentCreated ? 'Incident created' : 'No incident created');
      }

      setResult(data);
      fetchRecentSimulations();
    } catch (err: any) {
      setError(err.message);
      const idx = pipelineSteps.findIndex((s) => s.status === 'running');
      if (idx >= 0) {
        steps[idx] = { ...steps[idx], status: 'error', detail: err.message };
        setPipelineSteps([...steps]);
      }
    } finally {
      setSubmitting(false);
    }
  };

  /* ── reset form ─────────────────────────────────────────────────── */
  const handleReset = () => {
    setResult(null);
    setError(null);
    setPipelineSteps([]);
    pickSpecies(SPECIES_PRESETS[0]);
    pickLocation(LOCATION_PRESETS[0]);
    setNotes('');
    setTriggerPipeline(true);
  };

  /* ── confidence label colour ────────────────────────────────────── */
  const confidenceColor = confidence >= 0.9 ? 'text-emerald-600' : confidence >= 0.7 ? 'text-amber-600' : 'text-red-600';

  /* ═══════════════════════════════════════════════════════════════════ */
  return (
    <div className="space-y-8 pb-12">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-violet-700 via-fuchsia-600 to-pink-500 px-6 py-10 text-white shadow-lg">
        <div className="max-w-2xl">
          <p className="text-sm uppercase tracking-[0.2em] text-white/70">
            Simulation Lab
          </p>
          <h1 className="mt-2 text-3xl font-bold leading-tight flex items-center gap-3">
            <FlaskConical className="h-8 w-8" />
            Detection Simulator
          </h1>
          <p className="mt-3 text-white/80 max-w-xl">
            Trigger a fully realistic snake detection through the entire response pipeline
            — classification, playbook, notifications, and incident creation — without
            needing a real snake encounter.
          </p>
        </div>
        <div className="pointer-events-none absolute -right-24 -top-14 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -left-16 -bottom-20 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr,420px] gap-8">
        {/* ── Left: Form ──────────────────────────────────────────────── */}
        <div className="space-y-6">
          {/* Species */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
              <Skull className="h-5 w-5 text-fuchsia-500" />
              Species
            </h2>

            <div ref={speciesRef} className="relative">
              <button
                type="button"
                onClick={() => setShowSpeciesDropdown(!showSpeciesDropdown)}
                className="w-full flex items-center justify-between rounded-xl border border-gray-200 px-4 py-3 text-left hover:border-fuchsia-300 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40 transition"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">🐍</span>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{species}</p>
                    <p className="text-xs text-gray-500">
                      {venomous ? '🔴 Venomous' : '🟢 Non-venomous'} · Risk: {riskLevel}
                    </p>
                  </div>
                </div>
                <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${showSpeciesDropdown ? 'rotate-180' : ''}`} />
              </button>

              {showSpeciesDropdown && (
                <div className="absolute z-30 mt-2 w-full rounded-xl bg-white border border-gray-200 shadow-xl max-h-72 overflow-y-auto">
                  {SPECIES_PRESETS.map((p, i) => (
                    <button
                      key={i}
                      onClick={() => pickSpecies(p)}
                      className={`w-full text-left px-4 py-3 hover:bg-fuchsia-50 flex items-center gap-3 transition ${
                        species === p.species ? 'bg-fuchsia-50' : ''
                      }`}
                    >
                      <span className="text-lg">🐍</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{p.species}</p>
                        <p className="text-xs text-gray-500">
                          {p.venomous ? '🔴 Venomous' : '🟢 Non-venomous'} · Risk: {p.risk} · {(p.confidence * 100).toFixed(0)}%
                        </p>
                      </div>
                      {species === p.species && <CheckCircle2 className="h-4 w-4 text-fuchsia-500 flex-shrink-0" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Venomous toggle */}
            <div className="mt-4 flex items-center gap-3">
              <label className="text-sm font-medium text-gray-700">Venomous:</label>
              <button
                type="button"
                onClick={() => setVenomous(!venomous)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  venomous ? 'bg-red-500' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                    venomous ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
              <span className={`text-xs font-semibold ${venomous ? 'text-red-600' : 'text-emerald-600'}`}>
                {venomous ? 'Yes – Venomous' : 'No – Non-venomous'}
              </span>
            </div>
          </div>

          {/* Confidence + Risk */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
              <Sparkles className="h-5 w-5 text-amber-500" />
              Confidence &amp; Risk
            </h2>

            {/* Confidence slider */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700">Detection Confidence</label>
                <span className={`text-sm font-bold ${confidenceColor}`}>{(confidence * 100).toFixed(0)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="1"
                value={Math.round(confidence * 100)}
                onChange={(e) => setConfidence(parseInt(e.target.value) / 100)}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-fuchsia-500"
              />
              <div className="flex justify-between mt-1 text-[10px] text-gray-400 font-medium">
                <span>0%</span>
                <span>25%</span>
                <span>50%</span>
                <span>75%</span>
                <span>100%</span>
              </div>
            </div>

            {/* Risk level */}
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-2">Risk Level</label>
              <div className="grid grid-cols-4 gap-2">
                {(['low', 'medium', 'high', 'critical'] as const).map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setRiskLevel(level)}
                    className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all capitalize ${
                      riskLevel === level
                        ? RISK_COLORS[level] + ' ring-2 ring-offset-1 ring-current scale-105'
                        : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    <span className={`inline-block w-2 h-2 rounded-full mr-1.5 ${RISK_DOT_COLORS[level]}`} />
                    {level}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Location */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
              <MapPin className="h-5 w-5 text-blue-500" />
              Location
            </h2>

            {/* Preset picker */}
            <div ref={locationRef} className="relative mb-4">
              <button
                type="button"
                onClick={() => setShowLocationDropdown(!showLocationDropdown)}
                className="w-full flex items-center justify-between rounded-xl border border-gray-200 px-4 py-3 text-left hover:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                    <MapPin className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{locationName}</p>
                    <p className="text-xs text-gray-500">{lat.toFixed(6)}, {lng.toFixed(6)}</p>
                  </div>
                </div>
                <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${showLocationDropdown ? 'rotate-180' : ''}`} />
              </button>

              {showLocationDropdown && (
                <div className="absolute z-30 mt-2 w-full rounded-xl bg-white border border-gray-200 shadow-xl max-h-64 overflow-y-auto">
                  {LOCATION_PRESETS.map((p, i) => (
                    <button
                      key={i}
                      onClick={() => pickLocation(p)}
                      className={`w-full text-left px-4 py-3 hover:bg-blue-50 flex items-center gap-3 transition ${
                        locationName === p.name ? 'bg-blue-50' : ''
                      }`}
                    >
                      <MapPin className="h-4 w-4 text-blue-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{p.name}</p>
                        <p className="text-xs text-gray-500">{p.lat.toFixed(4)}, {p.lng.toFixed(4)}</p>
                      </div>
                      {locationName === p.name && <CheckCircle2 className="h-4 w-4 text-blue-500 flex-shrink-0" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Map */}
            <div className="rounded-xl overflow-hidden border border-gray-200 relative">
              <link
                rel="stylesheet"
                href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
              />
              <div ref={mapContainerRef} className="h-64 w-full" />
              {!mapReady && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
                  <Loader2 className="h-6 w-6 text-gray-400 animate-spin" />
                </div>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
              <Info className="h-3 w-3" /> Click the map or drag the pin to set a custom location.
            </p>

            {/* Manual coords */}
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div>
                <label className="text-xs font-medium text-gray-500">Latitude</label>
                <input
                  type="number"
                  step="0.000001"
                  value={lat}
                  onChange={(e) => setLat(parseFloat(e.target.value) || 0)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500">Longitude</label>
                <input
                  type="number"
                  step="0.000001"
                  value={lng}
                  onChange={(e) => setLng(parseFloat(e.target.value) || 0)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                />
              </div>
            </div>
          </div>

          {/* Notes + Pipeline toggle */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Notes (optional)</label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Simulating a cobra near Building A for the review panel..."
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40 resize-none"
              />
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setTriggerPipeline(!triggerPipeline)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  triggerPipeline ? 'bg-fuchsia-500' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                    triggerPipeline ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
              <div>
                <p className="text-sm font-medium text-gray-700">Trigger full pipeline</p>
                <p className="text-xs text-gray-500">Classification → Playbook → Notification → Incident</p>
              </div>
            </div>
          </div>

          {/* Submit */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleSimulate}
              disabled={submitting}
              className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-6 py-4 text-white font-semibold shadow-lg hover:shadow-xl transition-all disabled:opacity-60 disabled:cursor-not-allowed hover:scale-[1.01] active:scale-[0.99]"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Simulating...
                </>
              ) : (
                <>
                  <Zap className="h-5 w-5" />
                  Simulate Detection
                </>
              )}
            </button>
            <button
              onClick={handleReset}
              className="flex items-center justify-center h-14 w-14 rounded-2xl border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition"
              title="Reset form"
            >
              <RotateCcw className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* ── Right: Pipeline tracker + recent ────────────────────────── */}
        <div className="space-y-6">
          {/* Pipeline tracker */}
          {pipelineSteps.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Zap className="h-4 w-4 text-fuchsia-500" />
                Pipeline Progress
              </h3>
              <div className="space-y-3">
                {pipelineSteps.map((step, i) => (
                  <div key={step.key} className="flex items-start gap-3">
                    {/* Icon */}
                    <div className="mt-0.5">
                      {step.status === 'idle' && (
                        <div className="h-5 w-5 rounded-full border-2 border-gray-300" />
                      )}
                      {step.status === 'running' && (
                        <Loader2 className="h-5 w-5 text-fuchsia-500 animate-spin" />
                      )}
                      {step.status === 'done' && (
                        <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                      )}
                      {step.status === 'error' && (
                        <XCircle className="h-5 w-5 text-amber-500" />
                      )}
                    </div>
                    {/* Label */}
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${
                        step.status === 'done' ? 'text-gray-900' :
                        step.status === 'error' ? 'text-amber-700' :
                        step.status === 'running' ? 'text-fuchsia-700' :
                        'text-gray-400'
                      }`}>
                        {step.label}
                      </p>
                      {step.detail && (
                        <p className="text-xs text-gray-500 truncate">{step.detail}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Result */}
          {result && (
            <div className="bg-white rounded-2xl border border-emerald-200 shadow-sm p-6">
              <h3 className="text-base font-semibold text-emerald-700 mb-3 flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5" />
                Simulation Complete
              </h3>
              <div className="space-y-2 text-sm text-gray-700">
                <p><span className="font-medium text-gray-900">Detection ID:</span>{' '}
                  <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{result.detection?.id}</code>
                </p>
                <p><span className="font-medium text-gray-900">Species:</span> {result.detection?.species}</p>
                <p><span className="font-medium text-gray-900">Risk:</span>{' '}
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${RISK_COLORS[result.detection?.risk_level || 'low']}`}>
                    {result.detection?.risk_level}
                  </span>
                </p>
                {result.pipeline && (
                  <div className="mt-3 pt-3 border-t border-gray-100 space-y-1">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Pipeline Results</p>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <MiniStat label="Classification" ok={result.pipeline.classificationCompleted} />
                      <MiniStat label="Playbook" ok={result.pipeline.playbookAssigned} />
                      <MiniStat label="Notifications" ok={result.pipeline.notificationsSent} />
                      <MiniStat label="Incident" ok={result.pipeline.incidentCreated} />
                    </div>
                    {result.pipeline.responseTime && (
                      <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Pipeline completed in {result.pipeline.responseTime}ms
                      </p>
                    )}
                  </div>
                )}
                <Link
                  href={`/admin/detections/${result.detection?.id}`}
                  className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-fuchsia-600 hover:text-fuchsia-800 transition"
                >
                  View detection details <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="bg-white rounded-2xl border border-red-200 shadow-sm p-6">
              <h3 className="text-base font-semibold text-red-700 mb-2 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Simulation Failed
              </h3>
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* Recent simulations */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Clock className="h-4 w-4 text-gray-400" />
              Recent Simulations
            </h3>
            {recentSimulations.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">No simulations yet</p>
            ) : (
              <div className="space-y-3">
                {recentSimulations.map((sim) => (
                  <Link
                    key={sim.id}
                    href={`/admin/detections/${sim.id}`}
                    className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-gray-50 transition group"
                  >
                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${
                      sim.risk_level === 'critical' ? 'bg-red-100 text-red-600' :
                      sim.risk_level === 'high' ? 'bg-orange-100 text-orange-600' :
                      sim.risk_level === 'medium' ? 'bg-amber-100 text-amber-600' :
                      'bg-emerald-100 text-emerald-600'
                    }`}>
                      <AlertTriangle className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{sim.species || 'Unknown'}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(sim.created_at).toLocaleString('en-US', {
                          month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric',
                        })}
                        {' · '}
                        <span className={`font-semibold ${
                          sim.risk_level === 'critical' ? 'text-red-600' : sim.risk_level === 'high' ? 'text-orange-600' : 'text-gray-600'
                        }`}>
                          {sim.risk_level}
                        </span>
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-gray-300 group-hover:text-fuchsia-500 transition" />
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── helper component ────────────────────────────────────────────────── */
function MiniStat({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium ${
      ok ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-50 text-gray-500'
    }`}>
      {ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
      {label}
    </div>
  );
}
