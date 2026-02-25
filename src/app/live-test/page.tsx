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
  ChevronDown,
  Info,
  Camera,
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
}

export default function LiveTestPage() {
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(true);
  const [videos, setVideos] = useState<VideoFile[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<string>('');
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

  // Load videos list
  const loadVideos = useCallback(async () => {
    try {
      const res = await fetch(`${DETECTOR_URL}/api/videos`);
      const data = await res.json();
      setVideos(data.videos || []);
      if (data.videos?.length > 0 && !selectedVideo) {
        setSelectedVideo(data.videos[0].name);
      }
    } catch (e) {
      console.error('Failed to load videos:', e);
    }
  }, [selectedVideo]);

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

    // Poll status every 1s
    statusInterval.current = setInterval(async () => {
      const ok = await checkConnection();
      if (ok) {
        await pollStatus();
        await pollDetections();
      }
    }, 1000);

    return () => {
      if (statusInterval.current) clearInterval(statusInterval.current);
    };
  }, [checkConnection, loadVideos, pollStatus, pollDetections]);

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

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const getConfidenceColor = (conf: number) => {
    if (conf >= 0.8) return 'text-green-400';
    if (conf >= 0.6) return 'text-yellow-400';
    return 'text-orange-400';
  };

  const getConfidenceBg = (conf: number) => {
    if (conf >= 0.8) return 'bg-green-500/20 border-green-500/40';
    if (conf >= 0.6) return 'bg-yellow-500/20 border-yellow-500/40';
    return 'bg-orange-500/20 border-orange-500/40';
  };

  // ─── Not Connected State ──────────────────────────────────────────────────

  if (!connected && !connecting) {
    return (
      <div className="flex flex-col h-screen bg-gray-950">
        <Header />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar />
          <main className="flex-1 overflow-y-auto p-6">
            <div className="max-w-3xl mx-auto mt-12">
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center">
                <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-red-500/10 border-2 border-red-500/30 flex items-center justify-center">
                  <XCircle className="w-10 h-10 text-red-400" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-3">Local Detector Not Running</h2>
                <p className="text-gray-400 mb-6 max-w-md mx-auto">
                  The Python detection server is not running on your machine. Start it to begin testing snake detection with your pre-recorded videos.
                </p>
                <div className="bg-gray-800 rounded-xl p-5 text-left mb-6">
                  <p className="text-sm font-mono text-gray-300 mb-2">Run these commands in your terminal:</p>
                  <div className="bg-black rounded-lg p-4 font-mono text-sm space-y-1">
                    <p className="text-gray-500"># Install dependencies (first time only)</p>
                    <p className="text-green-400">pip install flask flask-cors ultralytics opencv-python</p>
                    <p className="text-gray-500 mt-3"># Start the detector server</p>
                    <p className="text-green-400">python scripts/local_detector.py</p>
                  </div>
                </div>
                <button
                  onClick={checkConnection}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors font-medium"
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
    <div className="flex flex-col h-screen bg-gray-950">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="max-w-7xl mx-auto">
            {/* Page Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
              <div className="mb-4 md:mb-0">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-500/10 rounded-lg">
                    <Camera className="w-6 h-6 text-green-400" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-white">Live Test</h1>
                    <p className="text-sm text-gray-400">Run snake detection on pre-recorded videos locally</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {/* Connection indicator */}
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${
                    connected
                      ? 'bg-green-500/10 text-green-400 border border-green-500/30'
                      : 'bg-red-500/10 text-red-400 border border-red-500/30'
                  }`}>
                  <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
                  {connected ? 'Detector Online' : 'Disconnected'}
                </div>
                {status?.model_loaded && (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/30">
                    <Zap className="w-3 h-3" />
                    YOLOv8 Model Loaded
                  </div>
                )}
              </div>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              {/* Left: Video Feed + Controls (2 cols) */}
              <div className="xl:col-span-2 space-y-4">
                {/* Video Feed */}
                <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
                  <div className="aspect-video bg-black relative">
                    {status?.is_running ? (
                      <img
                        key={streamKey}
                        src={`${DETECTOR_URL}/stream`}
                        alt="Live detection stream"
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-gray-500">
                        <Video className="w-16 h-16 mb-4 opacity-30" />
                        <p className="text-lg font-medium">No Active Detection</p>
                        <p className="text-sm mt-1">Select a video below and click Start to begin</p>
                      </div>
                    )}
                    
                    {/* Live badge */}
                    {status?.is_running && !status?.is_paused && (
                      <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1 bg-red-600/90 rounded-full text-white text-xs font-bold backdrop-blur-sm">
                        <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                        LIVE DETECTION
                      </div>
                    )}
                    {status?.is_paused && (
                      <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1 bg-yellow-600/90 rounded-full text-white text-xs font-bold backdrop-blur-sm">
                        PAUSED
                      </div>
                    )}
                  </div>
                  
                  {/* Progress bar */}
                  {status?.is_running && (
                    <div className="h-1 bg-gray-800">
                      <div
                        className="h-full bg-green-500 transition-all duration-500"
                        style={{ width: `${status.video_progress}%` }}
                      />
                    </div>
                  )}
                </div>

                {/* Controls */}
                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                  <div className="flex flex-col md:flex-row items-stretch md:items-center gap-4">
                    {/* Video selector */}
                    <div className="flex-1 relative">
                      <label className="block text-xs text-gray-500 mb-1.5 font-medium uppercase tracking-wider">Video Source</label>
                      <select
                        value={selectedVideo}
                        onChange={(e) => setSelectedVideo(e.target.value)}
                        disabled={status?.is_running}
                        className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-2.5 appearance-none focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <option value="">Select a video...</option>
                        {videos.map(v => (
                          <option key={v.name} value={v.name}>
                            {v.name} ({v.size_mb} MB)
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-3 top-[38px] w-4 h-4 text-gray-400 pointer-events-none" />
                    </div>
                    
                    {/* Action buttons */}
                    <div className="flex items-end gap-2">
                      {!status?.is_running ? (
                        <button
                          onClick={handleStart}
                          disabled={!selectedVideo || !connected}
                          className="flex items-center gap-2 px-6 py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg transition-colors font-medium"
                        >
                          <Play className="w-4 h-4" />
                          Start Detection
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={handlePause}
                            className="flex items-center gap-2 px-4 py-2.5 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg transition-colors font-medium"
                          >
                            <Pause className="w-4 h-4" />
                            {status.is_paused ? 'Resume' : 'Pause'}
                          </button>
                          <button
                            onClick={handleStop}
                            className="flex items-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors font-medium"
                          >
                            <Square className="w-4 h-4" />
                            Stop
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => setShowSettings(!showSettings)}
                        className="flex items-center gap-2 px-3 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors"
                      >
                        <Settings className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Settings panel */}
                  {showSettings && (
                    <div className="mt-4 pt-4 border-t border-gray-800">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs text-gray-400 mb-1">
                            Confidence Threshold: {(confidenceThreshold * 100).toFixed(0)}%
                          </label>
                          <input
                            type="range"
                            min="0.1"
                            max="0.95"
                            step="0.05"
                            value={confidenceThreshold}
                            onChange={(e) => setConfidenceThreshold(parseFloat(e.target.value))}
                            className="w-full accent-green-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-400 mb-1">
                            Detection Cooldown: {cooldown}s
                          </label>
                          <input
                            type="range"
                            min="0.5"
                            max="10"
                            step="0.5"
                            value={cooldown}
                            onChange={(e) => setCooldown(parseFloat(e.target.value))}
                            className="w-full accent-green-500"
                          />
                        </div>
                      </div>
                      <button
                        onClick={handleUpdateConfig}
                        className="mt-3 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg transition-colors"
                      >
                        Apply Settings
                      </button>
                    </div>
                  )}
                </div>

                {/* Stats Cards */}
                {status && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                      <div className="flex items-center gap-2 text-gray-400 mb-1">
                        <Activity className="w-4 h-4" />
                        <span className="text-xs uppercase tracking-wider">FPS</span>
                      </div>
                      <p className="text-2xl font-bold text-white">{status.current_fps}</p>
                    </div>
                    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                      <div className="flex items-center gap-2 text-gray-400 mb-1">
                        <Eye className="w-4 h-4" />
                        <span className="text-xs uppercase tracking-wider">Frames</span>
                      </div>
                      <p className="text-2xl font-bold text-white">{status.total_frames_processed.toLocaleString()}</p>
                    </div>
                    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                      <div className="flex items-center gap-2 text-gray-400 mb-1">
                        <AlertTriangle className="w-4 h-4" />
                        <span className="text-xs uppercase tracking-wider">Detections</span>
                      </div>
                      <p className="text-2xl font-bold text-green-400">{status.total_detections}</p>
                    </div>
                    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                      <div className="flex items-center gap-2 text-gray-400 mb-1">
                        <Clock className="w-4 h-4" />
                        <span className="text-xs uppercase tracking-wider">Uptime</span>
                      </div>
                      <p className="text-2xl font-bold text-white">{formatTime(status.uptime_seconds)}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Right: Detection Log (1 col) */}
              <div className="space-y-4">
                <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
                  <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-green-400" />
                      <h3 className="font-semibold text-white">Detection Log</h3>
                    </div>
                    <span className="text-xs text-gray-500 bg-gray-800 px-2 py-1 rounded-full">
                      {detections.length} total
                    </span>
                  </div>
                  
                  <div className="max-h-[600px] overflow-y-auto">
                    {detections.length === 0 ? (
                      <div className="p-8 text-center text-gray-500">
                        <Eye className="w-10 h-10 mx-auto mb-3 opacity-30" />
                        <p className="text-sm">No detections yet</p>
                        <p className="text-xs mt-1">Start processing a video to see results</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-gray-800">
                        {detections.map((det) => (
                          <div
                            key={det.id}
                            className="p-4 hover:bg-gray-800/50 cursor-pointer transition-colors"
                            onClick={() => setSelectedDetection(selectedDetection?.id === det.id ? null : det)}
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <span className="text-green-400 text-lg">🐍</span>
                                <div>
                                  <p className="text-sm font-medium text-white">Snake Detected</p>
                                  <p className="text-xs text-gray-500">
                                    {new Date(det.timestamp).toLocaleTimeString()} • Frame #{det.frame_number}
                                  </p>
                                </div>
                              </div>
                              <span className={`text-sm font-bold ${getConfidenceColor(det.confidence)}`}>
                                {(det.confidence * 100).toFixed(1)}%
                              </span>
                            </div>
                            
                            {/* Confidence bar */}
                            <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden mb-2">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  det.confidence >= 0.8 ? 'bg-green-500' : det.confidence >= 0.6 ? 'bg-yellow-500' : 'bg-orange-500'
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
                                  className="w-full rounded-lg border border-gray-700"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = 'none';
                                  }}
                                />
                                
                                {/* Details */}
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                  <div className="bg-gray-800 rounded-lg p-2">
                                    <span className="text-gray-500">Bounding Box</span>
                                    <p className="text-gray-300 font-mono">
                                      ({det.bbox.x1}, {det.bbox.y1}) → ({det.bbox.x2}, {det.bbox.y2})
                                    </p>
                                  </div>
                                  <div className="bg-gray-800 rounded-lg p-2">
                                    <span className="text-gray-500">Video Progress</span>
                                    <p className="text-gray-300">{det.video_progress}%</p>
                                  </div>
                                </div>
                                
                                {/* Upload button */}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleUploadDetection(det);
                                  }}
                                  disabled={uploadingId === det.id}
                                  className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 text-white text-sm rounded-lg transition-colors"
                                >
                                  {uploadingId === det.id ? (
                                    <>
                                      <RefreshCw className="w-3 h-3 animate-spin" />
                                      Uploading...
                                    </>
                                  ) : (
                                    <>
                                      <Upload className="w-3 h-3" />
                                      Upload to Dashboard
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
                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                  <div className="flex items-start gap-3">
                    <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                    <div className="text-xs text-gray-400 space-y-2">
                      <p className="font-medium text-gray-300">How it works</p>
                      <ul className="space-y-1 list-disc list-inside">
                        <li>Select a pre-recorded snake video</li>
                        <li>The YOLOv8 model processes each frame locally</li>
                        <li>Detected snakes are highlighted with bounding boxes</li>
                        <li>Each detection is logged with confidence score</li>
                        <li>Click any detection to see the captured frame</li>
                        <li>Upload detections to the main dashboard</li>
                      </ul>
                    </div>
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
