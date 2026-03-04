'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import Header from '@/components/ui/header';
import Sidebar from '@/components/ui/sidebar';
import {
  Play,
  Square,
  Pause,
  Video,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Activity,
  Clock,
  Zap,
  Eye,
  Upload,
  RefreshCw,
  Settings,
  Info,
  Smartphone,
  Link,
  Unlink,
  Bell,
} from 'lucide-react';

const DETECTOR_URL = 'http://localhost:5050';

interface VideoFile {
  name: string;
  size_mb: number;
}

interface Detection {
  id: string;
  timestamp: string;
  confidence: number;
  class: string;
  bbox: { x1: number; y1: number; x2: number; y2: number };
  frame_number: number;
  video: string;
  image_path: string;
  video_progress: number;
}

interface DetectorStatus {
  is_running: boolean;
  is_paused: boolean;
  current_video: string | null;
  total_frames_processed: number;
  total_detections: number;
  current_fps: number;
  video_progress: number;
  confidence_threshold: number;
  model_loaded: boolean;
  uptime_seconds: number;
  auto_upload?: boolean;
  device_id?: string;
  supabase_connected?: boolean;
}

interface LinkStatus {
  linked: boolean;
  email?: string;
  userId?: string;
  status?: string;
}

export default function LiveTestPage() {
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(true);
  const [videos, setVideos] = useState<VideoFile[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<string>('');
  const selectedVideoRef = useRef<string>('');
  const [status, setStatus] = useState<DetectorStatus | null>(null);
  const [detections, setDetections] = useState<Detection[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.25);
  const [cooldown, setCooldown] = useState(2.0);
  const [selectedDetection, setSelectedDetection] = useState<Detection | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [streamKey, setStreamKey] = useState(0);
  const statusInterval = useRef<NodeJS.Timeout | null>(null);
  const detectionsInterval = useRef<NodeJS.Timeout | null>(null);

  // Mobile alerts link state
  const [linkStatus, setLinkStatus] = useState<LinkStatus>({ linked: false });
  const [linkEmail, setLinkEmail] = useState('kanishkreddy3813@gmail.com');
  const [linking, setLinking] = useState(false);
  const [linkError, setLinkError] = useState('');

  // Check connection to local detector
  const checkConnection = useCallback(async () => {
    try {
      const res = await fetch(`${DETECTOR_URL}/api/status`, { signal: AbortSignal.timeout(3000) });
      if (res.ok) {
        setConnected(true);
        setConnecting(false);
        return true;
      }
    } catch {
      setConnected(false);
      setConnecting(false);
    }
    return false;
  }, []);

  // Keep ref in sync with state
  useEffect(() => {
    selectedVideoRef.current = selectedVideo;
  }, [selectedVideo]);

  // Load videos list
  const loadVideos = useCallback(async () => {
    try {
      const res = await fetch(`${DETECTOR_URL}/api/videos`, { signal: AbortSignal.timeout(3000) });
      const data = await res.json();
      setVideos(data.videos || []);
      if (data.videos?.length > 0 && !selectedVideoRef.current) {
        setSelectedVideo(data.videos[0].name);
      }
    } catch (e) {
      console.error('Failed to load videos:', e);
    }
  }, []);

  // Poll status
  const pollStatus = useCallback(async () => {
    try {
      const res = await fetch(`${DETECTOR_URL}/api/status`);
      const data = await res.json();
      setStatus(data);
      setConnected(true);
    } catch {
      setConnected(false);
    }
  }, []);

  // Poll detections
  const pollDetections = useCallback(async () => {
    try {
      const res = await fetch(`${DETECTOR_URL}/api/detections`);
      const data = await res.json();
      setDetections(data.detections || []);
    } catch {
      // ignore
    }
  }, []);

  // Initialize
  useEffect(() => {
    const init = async () => {
      const ok = await checkConnection();
      if (ok) {
        await loadVideos();
        await pollStatus();
      }
    };
    init();

    // Poll status every 1s, and reload videos every 5s
    let videoLoadCounter = 0;
    statusInterval.current = setInterval(async () => {
      const ok = await checkConnection();
      if (ok) {
        await pollStatus();
        await pollDetections();
        videoLoadCounter++;
        if (videoLoadCounter % 5 === 0) {
          await loadVideos();
        }
      }
    }, 1000);

    return () => {
      if (statusInterval.current) clearInterval(statusInterval.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Start processing
  const handleStart = async () => {
    if (!selectedVideo) return;
    try {
      await fetch(`${DETECTOR_URL}/api/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ video: selectedVideo }),
      });
      setStreamKey(prev => prev + 1);
      await pollStatus();
    } catch (e) {
      console.error('Start failed:', e);
    }
  };

  // Stop processing
  const handleStop = async () => {
    try {
      await fetch(`${DETECTOR_URL}/api/stop`, { method: 'POST' });
      await pollStatus();
    } catch (e) {
      console.error('Stop failed:', e);
    }
  };

  // Pause/resume
  const handlePause = async () => {
    try {
      await fetch(`${DETECTOR_URL}/api/pause`, { method: 'POST' });
      await pollStatus();
    } catch (e) {
      console.error('Pause failed:', e);
    }
  };

  // Update config
  const handleUpdateConfig = async () => {
    try {
      await fetch(`${DETECTOR_URL}/api/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          confidence_threshold: confidenceThreshold,
          detection_cooldown: cooldown,
        }),
      });
      setShowSettings(false);
    } catch (e) {
      console.error('Config update failed:', e);
    }
  };

  // Upload detection to Supabase
  const handleUploadDetection = async (detection: Detection) => {
    setUploadingId(detection.id);
    try {
      const res = await fetch(`${DETECTOR_URL}/api/upload-detection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          detection_id: detection.id,
          latitude: 12.8231,
          longitude: 80.0444,
        }),
      });
      const data = await res.json();
      if (data.error) {
        alert(`Upload failed: ${data.error}`);
      } else {
        alert(`✅ Uploaded to Supabase!\nDatabase ID: ${data.database_id}`);
      }
    } catch (e) {
      alert('Upload failed. Is Supabase reachable?');
    } finally {
      setUploadingId(null);
    }
  };

  // ─── Mobile Alerts Functions ──────────────────────────────────────────────

  // Fetch current link status
  const fetchLinkStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/live-test/link-user');
      if (res.ok) {
        const data = await res.json();
        setLinkStatus(data);
        if (data.email) setLinkEmail(data.email);
      }
    } catch {
      // ignore
    }
  }, []);

  // Link user email to live-test camera
  const handleLinkUser = async () => {
    if (!linkEmail.trim()) return;
    setLinking(true);
    setLinkError('');
    try {
      const res = await fetch('/api/live-test/link-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: linkEmail.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLinkError(data.error || 'Failed to link');
      } else {
        setLinkStatus({ linked: true, email: data.email, userId: data.userId, status: 'online' });
      }
    } catch {
      setLinkError('Network error');
    } finally {
      setLinking(false);
    }
  };

  // Unlink
  const handleUnlinkUser = async () => {
    try {
      await fetch('/api/live-test/link-user', { method: 'DELETE' });
      setLinkStatus({ linked: false });
    } catch {
      // ignore
    }
  };

  // Toggle auto-upload on the detector
  const handleToggleAutoUpload = async (enabled: boolean) => {
    try {
      await fetch(`${DETECTOR_URL}/api/auto-upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });
      await pollStatus();
    } catch {
      // ignore
    }
  };

  // Load link status on mount
  useEffect(() => {
    fetchLinkStatus();
  }, [fetchLinkStatus]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const getConfidenceColor = (conf: number) => {
    if (conf >= 0.8) return 'text-emerald-600';
    if (conf >= 0.6) return 'text-amber-600';
    return 'text-orange-600';
  };

  const getConfidenceBg = (conf: number) => {
    if (conf >= 0.8) return 'bg-emerald-50 border-emerald-200';
    if (conf >= 0.6) return 'bg-amber-50 border-amber-200';
    return 'bg-orange-50 border-orange-200';
  };

  // ─── Not Connected State ──────────────────────────────────────────────────

  if (!connected && !connecting) {
    return (
      <div className="flex h-screen bg-[#f7f8fa]">
        <Sidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <Header />
          <main className="flex-1 overflow-y-auto">
            <div className="max-w-3xl mx-auto px-4 md:px-6 py-5 mt-12">
              <div className="bg-white border border-gray-100 rounded-2xl p-8 text-center shadow-sm">
                <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-red-50 border-2 border-red-200 flex items-center justify-center">
                  <XCircle className="w-10 h-10 text-red-400" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-3">Camera Detector Offline</h2>
                <p className="text-gray-500 mb-6 max-w-md mx-auto">
                  The detection server is not running. Start it to begin real-time snake detection from field cameras.
                </p>
                <div className="bg-gray-900 rounded-xl p-5 text-left mb-6">
                  <p className="text-sm font-mono text-gray-300 mb-2">Run these commands in your terminal:</p>
                  <div className="bg-gray-950 rounded-lg p-4 font-mono text-sm space-y-1">
                    <p className="text-gray-500"># Install dependencies (first time only)</p>
                    <p className="text-emerald-400">pip install flask flask-cors ultralytics opencv-python</p>
                    <p className="text-gray-500 mt-3"># Start the detector server</p>
                    <p className="text-emerald-400">python scripts/local_detector.py</p>
                  </div>
                </div>
                <button
                  onClick={checkConnection}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-all duration-200 font-medium active:scale-95 shadow-sm shadow-emerald-200"
                >
                  <RefreshCw className="w-4 h-4" />
                  Retry Connection
                </button>
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  // ─── Main UI ──────────────────────────────────────────────────────────────

  return (
    <div className="flex h-screen bg-[#f7f8fa]">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto px-4 md:px-6 py-5">
            {/* Page Header */}
            <div className="section-fade-up flex flex-col md:flex-row md:items-center md:justify-between mb-6">
              <div className="mb-4 md:mb-0">
                <h1 className="text-xl font-bold text-gray-900 tracking-tight">Live Tracking</h1>
                <p className="text-sm text-gray-400 mt-0.5">Real-time snake detection from field camera feeds</p>
              </div>
              <div className="flex items-center gap-2">
                {/* Connection indicator */}
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${
                    connected
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-red-50 text-red-700 border border-red-200'
                  }`}>
                  <span className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                  {connected ? 'Camera Online' : 'Disconnected'}
                </div>
                {status?.model_loaded && (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                    <Zap className="w-3 h-3" />
                    AI Model Active
                  </div>
                )}
              </div>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
              {/* Left: Video Feed + Controls (2 cols) */}
              <div className="xl:col-span-2 space-y-4">
                {/* Video Feed */}
                <div className="bg-gray-900 rounded-2xl overflow-hidden shadow-sm section-fade-up" style={{ animationDelay: '100ms' }}>
                  <div className="aspect-video bg-black relative">
                    {status?.is_running ? (
                      <img
                        key={streamKey}
                        src={`${DETECTOR_URL}/stream`}
                        alt="Live camera feed"
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-gray-500">
                        <Video className="w-16 h-16 mb-4 opacity-30" />
                        <p className="text-lg font-medium text-gray-400">Camera Feed Inactive</p>
                        <p className="text-sm mt-1 text-gray-600">Select a camera feed and click Start to begin monitoring</p>
                      </div>
                    )}
                    
                    {/* Live badge */}
                    {status?.is_running && !status?.is_paused && (
                      <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1 bg-red-600/90 rounded-full text-white text-xs font-bold backdrop-blur-sm">
                        <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                        LIVE FEED
                      </div>
                    )}
                    {status?.is_paused && (
                      <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1 bg-amber-500/90 rounded-full text-white text-xs font-bold backdrop-blur-sm">
                        PAUSED
                      </div>
                    )}
                  </div>
                  
                  {/* Progress bar */}
                  {status?.is_running && (
                    <div className="h-1 bg-gray-800">
                      <div
                        className="h-full bg-emerald-500 transition-all duration-500"
                        style={{ width: `${status.video_progress}%` }}
                      />
                    </div>
                  )}
                </div>

                {/* Controls */}
                <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm section-fade-up" style={{ animationDelay: '200ms' }}>
                  <div className="flex flex-col md:flex-row items-stretch md:items-center gap-4">
                    {/* Video selector */}
                    <div className="flex-1 relative">
                      <label className="block text-xs text-gray-400 mb-1.5 font-medium uppercase tracking-wider">Camera Feed</label>
                      <select
                        value={selectedVideo}
                        onChange={(e) => setSelectedVideo(e.target.value)}
                        disabled={status?.is_running}
                        className="w-full bg-white border border-gray-200 text-gray-700 rounded-xl px-4 py-2.5 appearance-none focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        style={{
                          backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%239ca3af' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                          backgroundPosition: 'right 0.5rem center',
                          backgroundRepeat: 'no-repeat',
                          backgroundSize: '1.25em 1.25em',
                        }}
                      >
                        <option value="">Select camera feed...</option>
                        {videos.map(v => (
                          <option key={v.name} value={v.name}>
                            {v.name} ({v.size_mb} MB)
                          </option>
                        ))}
                      </select>
                    </div>
                    
                    {/* Action buttons */}
                    <div className="flex items-end gap-2">
                      {!status?.is_running ? (
                        <button
                          onClick={handleStart}
                          disabled={!selectedVideo || !connected}
                          className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-200 disabled:text-gray-400 text-white rounded-xl transition-all duration-200 font-medium active:scale-95 shadow-sm shadow-emerald-200"
                        >
                          <Play className="w-4 h-4" />
                          Start Tracking
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={handlePause}
                            className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl transition-all duration-200 font-medium active:scale-95"
                          >
                            <Pause className="w-4 h-4" />
                            {status.is_paused ? 'Resume' : 'Pause'}
                          </button>
                          <button
                            onClick={handleStop}
                            className="flex items-center gap-2 px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl transition-all duration-200 font-medium active:scale-95"
                          >
                            <Square className="w-4 h-4" />
                            Stop
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => setShowSettings(!showSettings)}
                        className={`flex items-center gap-2 px-3 py-2.5 rounded-xl transition-all duration-200 ${
                          showSettings
                            ? 'bg-gray-900 text-white'
                            : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
                        }`}
                      >
                        <Settings className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Settings panel */}
                  {showSettings && (
                    <div className="mt-4 pt-4 border-t border-gray-100">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">
                            Confidence Threshold: {(confidenceThreshold * 100).toFixed(0)}%
                          </label>
                          <input
                            type="range"
                            min="0.1"
                            max="0.95"
                            step="0.05"
                            value={confidenceThreshold}
                            onChange={(e) => setConfidenceThreshold(parseFloat(e.target.value))}
                            className="w-full accent-emerald-600"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">
                            Detection Cooldown: {cooldown}s
                          </label>
                          <input
                            type="range"
                            min="0.5"
                            max="10"
                            step="0.5"
                            value={cooldown}
                            onChange={(e) => setCooldown(parseFloat(e.target.value))}
                            className="w-full accent-emerald-600"
                          />
                        </div>
                      </div>
                      <button
                        onClick={handleUpdateConfig}
                        className="mt-3 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm rounded-xl transition-all duration-200 active:scale-95"
                      >
                        Apply Settings
                      </button>
                    </div>
                  )}
                </div>

                {/* Stats Cards */}
                {status && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 section-fade-up" style={{ animationDelay: '300ms' }}>
                    <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                      <div className="flex items-center gap-2 text-gray-400 mb-1">
                        <Activity className="w-4 h-4" />
                        <span className="text-xs uppercase tracking-wider font-medium">FPS</span>
                      </div>
                      <p className="text-2xl font-bold text-gray-900">{status.current_fps}</p>
                    </div>
                    <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                      <div className="flex items-center gap-2 text-gray-400 mb-1">
                        <Eye className="w-4 h-4" />
                        <span className="text-xs uppercase tracking-wider font-medium">Frames</span>
                      </div>
                      <p className="text-2xl font-bold text-gray-900">{status.total_frames_processed.toLocaleString()}</p>
                    </div>
                    <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                      <div className="flex items-center gap-2 text-gray-400 mb-1">
                        <AlertTriangle className="w-4 h-4" />
                        <span className="text-xs uppercase tracking-wider font-medium">Detections</span>
                      </div>
                      <p className="text-2xl font-bold text-emerald-600">{status.total_detections}</p>
                    </div>
                    <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                      <div className="flex items-center gap-2 text-gray-400 mb-1">
                        <Clock className="w-4 h-4" />
                        <span className="text-xs uppercase tracking-wider font-medium">Uptime</span>
                      </div>
                      <p className="text-2xl font-bold text-gray-900">{formatTime(status.uptime_seconds)}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Right: Detection Log (1 col) */}
              <div className="space-y-4">
                <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm section-fade-up" style={{ animationDelay: '200ms' }}>
                  <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-emerald-600" />
                      <h3 className="font-semibold text-gray-900">Detection Log</h3>
                    </div>
                    <span className="text-[11px] font-medium text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">
                      {detections.length} total
                    </span>
                  </div>
                  
                  <div className="max-h-[600px] overflow-y-auto">
                    {detections.length === 0 ? (
                      <div className="p-8 text-center text-gray-400">
                        <Eye className="w-10 h-10 mx-auto mb-3 opacity-30" />
                        <p className="text-sm">No detections yet</p>
                        <p className="text-xs mt-1 text-gray-400">Start processing a video to see results</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-gray-100">
                        {detections.map((det) => (
                          <div
                            key={det.id}
                            className="p-4 hover:bg-gray-50 cursor-pointer transition-colors duration-200"
                            onClick={() => setSelectedDetection(selectedDetection?.id === det.id ? null : det)}
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <span className="text-lg">🐍</span>
                                <div>
                                  <p className="text-sm font-medium text-gray-900">Snake Detected</p>
                                  <p className="text-xs text-gray-400">
                                    {new Date(det.timestamp).toLocaleTimeString()} • Frame #{det.frame_number}
                                  </p>
                                </div>
                              </div>
                              <span className={`text-sm font-bold ${getConfidenceColor(det.confidence)}`}>
                                {(det.confidence * 100).toFixed(1)}%
                              </span>
                            </div>
                            
                            {/* Confidence bar */}
                            <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden mb-2">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  det.confidence >= 0.8 ? 'bg-emerald-500' : det.confidence >= 0.6 ? 'bg-amber-500' : 'bg-orange-500'
                                }`}
                                style={{ width: `${det.confidence * 100}%` }}
                              />
                            </div>

                            {/* Expanded view */}
                            {selectedDetection?.id === det.id && (
                              <div className="mt-3 space-y-3">
                                {/* Detection image */}
                                <img
                                  src={`${DETECTOR_URL}${det.image_path}`}
                                  alt="Detection"
                                  className="w-full rounded-xl border border-gray-200"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = 'none';
                                  }}
                                />
                                
                                {/* Details */}
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                  <div className="bg-gray-50 rounded-xl p-2.5">
                                    <span className="text-gray-400">Bounding Box</span>
                                    <p className="text-gray-700 font-mono">
                                      ({det.bbox.x1}, {det.bbox.y1}) → ({det.bbox.x2}, {det.bbox.y2})
                                    </p>
                                  </div>
                                  <div className="bg-gray-50 rounded-xl p-2.5">
                                    <span className="text-gray-400">Video Progress</span>
                                    <p className="text-gray-700">{det.video_progress}%</p>
                                  </div>
                                </div>
                                
                                {/* Upload button */}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleUploadDetection(det);
                                  }}
                                  disabled={uploadingId === det.id}
                                  className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 text-white text-sm rounded-xl transition-all duration-200 active:scale-95"
                                >
                                  {uploadingId === det.id ? (
                                    <>
                                      <RefreshCw className="w-3 h-3 animate-spin" />
                                      Uploading...
                                    </>
                                  ) : (
                                    <>
                                      <Upload className="w-3 h-3" />
                                      Save to Dashboard
                                    </>
                                  )}
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Info card */}
                <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm section-fade-up" style={{ animationDelay: '300ms' }}>
                  <div className="flex items-start gap-3">
                    <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                    <div className="text-xs text-gray-500 space-y-2">
                      <p className="font-medium text-gray-700">How it works</p>
                      <ul className="space-y-1 list-disc list-inside">
                        <li>Select an active camera feed from the field</li>
                        <li>Our AI model analyzes each frame in real-time</li>
                        <li>Detected snakes are highlighted with bounding boxes</li>
                        <li>Each detection is logged with confidence score</li>
                        <li>Click any detection to view the captured snapshot</li>
                        <li>Save verified detections to the main dashboard</li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Mobile Alerts Panel */}
                <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm section-fade-up" style={{ animationDelay: '350ms' }}>
                  <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Smartphone className="w-4 h-4 text-purple-600" />
                      <h3 className="font-semibold text-gray-900">Mobile Alerts</h3>
                    </div>
                    {linkStatus.linked && (
                      <span className="text-[11px] font-medium text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Linked
                      </span>
                    )}
                  </div>

                  <div className="p-5 space-y-4">
                    {linkStatus.linked ? (
                      // ── Linked State ──
                      <>
                        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                          <div className="flex items-center gap-2 mb-1">
                            <Link className="w-3.5 h-3.5 text-emerald-600" />
                            <span className="text-xs font-medium text-emerald-700">Connected to Mobile App</span>
                          </div>
                          <p className="text-sm text-emerald-800 font-medium">{linkStatus.email}</p>
                          <p className="text-xs text-emerald-600 mt-1">
                            Detections will appear as realtime alerts on the mobile app.
                          </p>
                        </div>

                        {/* Auto-Upload Toggle */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Bell className="w-4 h-4 text-gray-400" />
                            <div>
                              <p className="text-sm text-gray-700 font-medium">Auto-Sync Alerts</p>
                              <p className="text-xs text-gray-400">Push detections to mobile app</p>
                            </div>
                          </div>
                          <button
                            onClick={() => handleToggleAutoUpload(!status?.auto_upload)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                              status?.auto_upload ? 'bg-emerald-500' : 'bg-gray-300'
                            }`}
                          >
                            <span
                              className={`inline-block h-4 w-4 rounded-full bg-white transition-transform shadow-sm ${
                                status?.auto_upload ? 'translate-x-6' : 'translate-x-1'
                              }`}
                            />
                          </button>
                        </div>

                        {/* Status indicators */}
                        <div className="grid grid-cols-2 gap-2">
                          <div className={`rounded-lg p-2 text-center ${status?.supabase_connected ? 'bg-emerald-50' : 'bg-red-50'}`}>
                            <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400">Database</p>
                            <p className={`text-xs font-medium ${status?.supabase_connected ? 'text-emerald-600' : 'text-red-600'}`}>
                              {status?.supabase_connected ? 'Connected' : 'Disconnected'}
                            </p>
                          </div>
                          <div className={`rounded-lg p-2 text-center ${status?.auto_upload ? 'bg-emerald-50' : 'bg-gray-50'}`}>
                            <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400">Auto-Sync</p>
                            <p className={`text-xs font-medium ${status?.auto_upload ? 'text-emerald-600' : 'text-gray-500'}`}>
                              {status?.auto_upload ? 'Active' : 'Paused'}
                            </p>
                          </div>
                        </div>

                        <button
                          onClick={handleUnlinkUser}
                          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-red-600 bg-red-50 hover:bg-red-100 text-sm rounded-xl transition-all"
                        >
                          <Unlink className="w-3 h-3" />
                          Unlink Account
                        </button>
                      </>
                    ) : (
                      // ── Not Linked State ──
                      <>
                        <p className="text-xs text-gray-500">
                          Link your mobile app account to receive snake detection alerts in real-time on your phone.
                        </p>

                        <div>
                          <label className="block text-xs text-gray-400 mb-1.5 font-medium uppercase tracking-wider">
                            User Email
                          </label>
                          <input
                            type="email"
                            value={linkEmail}
                            onChange={(e) => { setLinkEmail(e.target.value); setLinkError(''); }}
                            placeholder="user@example.com"
                            className="w-full bg-white border border-gray-200 text-gray-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-400 transition-all"
                          />
                        </div>

                        {linkError && (
                          <p className="text-xs text-red-500 -mt-2">{linkError}</p>
                        )}

                        <button
                          onClick={handleLinkUser}
                          disabled={linking || !linkEmail.trim()}
                          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-200 disabled:text-gray-400 text-white text-sm rounded-xl transition-all duration-200 active:scale-95 font-medium"
                        >
                          {linking ? (
                            <>
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              Linking...
                            </>
                          ) : (
                            <>
                              <Smartphone className="w-3.5 h-3.5" />
                              Link Mobile Account
                            </>
                          )}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
