"""
SnakeGuard Local Video Detector
================================
Runs YOLOv8 snake detection model on pre-recorded videos locally.
Serves annotated video stream + detection results via Flask API.

Usage:
    pip install flask flask-cors ultralytics opencv-python
    python scripts/local_detector.py

Endpoints:
    GET  /                     → Status page
    GET  /api/videos           → List available videos
    POST /api/start            → Start processing a video { "video": "snake vid 1.mp4" }
    POST /api/stop             → Stop current processing
    GET  /api/status           → Current processing status
    GET  /api/detections       → List of all detections in current session
    GET  /stream               → MJPEG video stream with bounding boxes
    GET  /snapshot             → Latest annotated frame as JPEG
    POST /api/upload-detection → Upload a detection to Supabase
"""

import cv2
import os
import sys
import time
import json
import uuid
import threading
from datetime import datetime
from pathlib import Path

from flask import Flask, Response, jsonify, request, send_file
from flask_cors import CORS

# Add parent directory to path so we can find the model
PROJECT_ROOT = Path(__file__).resolve().parent.parent
MODEL_PATH = PROJECT_ROOT / "model" / "best.pt"
VIDEOS_DIR = PROJECT_ROOT / "public" / "vids"
OUTPUT_DIR = PROJECT_ROOT / "public" / "detections_output"
OUTPUT_DIR.mkdir(exist_ok=True)

# Load environment variables from .env.local if available (for Supabase credentials)
def load_env_file():
    """Load key=value pairs from .env.local into os.environ"""
    env_file = PROJECT_ROOT / ".env.local"
    if env_file.exists():
        print(f"📂 Loading env from {env_file}")
        with open(env_file) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and not line.startswith("//") and "=" in line:
                    key, _, value = line.partition("=")
                    key = key.strip()
                    value = value.strip()
                    if key and key not in os.environ:  # don't override existing env vars
                        os.environ[key] = value

load_env_file()

# Try to import YOLO
try:
    from ultralytics import YOLO
    YOLO_AVAILABLE = True
except ImportError:
    YOLO_AVAILABLE = False
    print("⚠️  ultralytics not installed. Run: pip install ultralytics")
    print("   Will start in demo mode without actual detection.")

# Try to import supabase
try:
    from supabase import create_client
    SUPABASE_AVAILABLE = True
except ImportError:
    SUPABASE_AVAILABLE = False

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

# ─── Configuration ───────────────────────────────────────────────────────────

CONFIDENCE_THRESHOLD = float(os.environ.get("CONFIDENCE_THRESHOLD", 0.25))
DETECTION_COOLDOWN = float(os.environ.get("DETECTION_COOLDOWN", 30.0))  # seconds between saved detections
STREAM_FPS = 15  # FPS for the MJPEG stream
JPEG_QUALITY = 85

# Supabase config (optional - for uploading detections)
SUPABASE_URL = os.environ.get("SUPABASE_URL", os.environ.get("NEXT_PUBLIC_SUPABASE_URL", ""))
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", os.environ.get("SUPABASE_SERVICE_ROLE_KEY", ""))

# ─── Mobile Alerts (Auto-Upload) Config ──────────────────────────────────────

LIVE_TEST_DEVICE_ID = "15f5320e-6cff-4b17-b49c-70bb253307ff"  # Camera UUID (must match cameras.device_id)
AUTO_UPLOAD_ENABLED = True                      # Auto-upload detections to Supabase
NEXT_APP_URL = os.environ.get("NEXT_APP_URL", "http://localhost:3000")  # Next.js app URL
DEFAULT_LATITUDE = 12.8231                     # Default lat (SRM campus)
DEFAULT_LONGITUDE = 80.0444                    # Default lng

# Try to import requests (for calling Next.js pipeline)
try:
    import requests as http_requests
    REQUESTS_AVAILABLE = True
except ImportError:
    REQUESTS_AVAILABLE = False
    print("⚠️  requests not installed. Auto-upload pipeline trigger disabled.")
    print("   Install with: pip install requests")

# ─── Global State ────────────────────────────────────────────────────────────

class DetectorState:
    def __init__(self):
        self.model = None
        self.is_running = False
        self.is_paused = False
        self.current_video = None
        self.cap = None
        self.latest_frame = None
        self.latest_raw_frame = None
        self.frame_lock = threading.Lock()
        self.detections = []
        self.detection_lock = threading.Lock()
        self.last_detection_time = 0
        self.total_frames_processed = 0
        self.total_detections = 0
        self.current_fps = 0
        self.video_progress = 0  # 0-100
        self.processing_thread = None
        self.start_time = None
        self.supabase_client = None

state = DetectorState()

# ─── Model Loading ───────────────────────────────────────────────────────────

def load_model():
    """Load the YOLOv8 model"""
    if not YOLO_AVAILABLE:
        print("⚠️  YOLO not available, running in demo mode")
        return None
    
    if not MODEL_PATH.exists():
        print(f"❌ Model not found at {MODEL_PATH}")
        return None
    
    print(f"🔄 Loading YOLOv8 model from {MODEL_PATH}...")
    model = YOLO(str(MODEL_PATH))
    print("✅ Model loaded successfully!")
    return model

def init_supabase():
    """Initialize Supabase client if credentials are available"""
    if not SUPABASE_AVAILABLE:
        return None
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("ℹ️  Supabase credentials not set. Detection upload disabled.")
        return None
    try:
        client = create_client(SUPABASE_URL, SUPABASE_KEY)
        print("✅ Supabase client initialized")
        return client
    except Exception as e:
        print(f"⚠️  Supabase init failed: {e}")
        return None

# ─── Auto-Upload to Supabase ─────────────────────────────────────────────────

def auto_upload_detection(detection_record):
    """Auto-upload a detection to Supabase and trigger the classification pipeline.
    Runs in a background thread so it doesn't block video processing."""
    if not state.supabase_client:
        print("⚠️  Supabase not configured, skipping auto-upload")
        return

    try:
        # Upload detection image to Supabase storage
        frame_filename = detection_record["image_path"].split("/")[-1]
        image_path = OUTPUT_DIR / frame_filename
        public_url = ""

        if image_path.exists():
            storage_name = f"live_test_{detection_record['id']}_{uuid.uuid4().hex[:8]}.jpg"
            with open(image_path, "rb") as f:
                state.supabase_client.storage.from_("snake-images").upload(
                    storage_name, f, {"content-type": "image/jpeg"}
                )
            public_url = state.supabase_client.storage.from_("snake-images").get_public_url(storage_name)
            print(f"📸 Image uploaded: {storage_name}")
        else:
            print(f"⚠️  Detection image not found: {image_path}")

        # Insert into snake_detections with device_id for mobile app linkage
        response = state.supabase_client.table("snake_detections").insert({
            "timestamp": detection_record["timestamp"],
            "confidence": detection_record["confidence"],
            "image_url": public_url,
            "latitude": DEFAULT_LATITUDE,
            "longitude": DEFAULT_LONGITUDE,
            "device_id": LIVE_TEST_DEVICE_ID,
            "processed": False,
        }).execute()

        db_id = response.data[0]["id"] if response.data else None
        print(f"✅ Auto-uploaded detection {detection_record['id']} → Supabase ID: {db_id}")

        # Trigger the classification + incident pipeline on the Next.js server
        if db_id and REQUESTS_AVAILABLE:
            try:
                pipeline_resp = http_requests.post(
                    f"{NEXT_APP_URL}/api/detections/process",
                    json={"detectionId": db_id},
                    timeout=30,
                )
                if pipeline_resp.ok:
                    result = pipeline_resp.json()
                    species = result.get("classification", {}).get("species", "unknown")
                    print(f"🧬 Pipeline OK for {db_id}: {species}")
                else:
                    print(f"⚠️  Pipeline returned {pipeline_resp.status_code}: {pipeline_resp.text[:200]}")
            except Exception as e:
                print(f"⚠️  Pipeline trigger failed (non-fatal): {e}")

    except Exception as e:
        print(f"❌ Auto-upload failed: {e}")


# ─── Video Processing ────────────────────────────────────────────────────────

# Detection persistence: keeps bounding box visible even when confidence dips
DISPLAY_THRESHOLD = 0.15   # Lower threshold for SHOWING the bounding box (visual only)
PERSIST_FRAMES = 15        # Keep showing the box for this many frames after last detection

def process_video(video_path: str):
    """Process a video file through the YOLOv8 model"""
    global state
    
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        print(f"❌ Could not open video: {video_path}")
        state.is_running = False
        return
    
    state.cap = cap
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    video_fps = cap.get(cv2.CAP_PROP_FPS) or 30
    frame_delay = 1.0 / min(video_fps, STREAM_FPS)
    
    print(f"🎬 Processing video: {os.path.basename(video_path)}")
    print(f"   Total frames: {total_frames}, FPS: {video_fps:.1f}")
    print(f"   Display threshold: {DISPLAY_THRESHOLD} (for bounding box)")
    print(f"   Save threshold:    {CONFIDENCE_THRESHOLD} (for logging detections)")
    
    frame_count = 0
    fps_start_time = time.time()
    fps_frame_count = 0
    
    # Persistence state: remembers the last bounding box
    last_bbox = None          # (x1, y1, x2, y2)
    last_conf = 0.0
    frames_since_detection = PERSIST_FRAMES + 1  # start with no box
    
    while state.is_running:
        if state.is_paused:
            time.sleep(0.1)
            continue
            
        ret, frame = cap.read()
        if not ret:
            # Video ended - loop back to start
            cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
            frame_count = 0
            print("🔄 Video looped back to start")
            continue
        
        frame_count += 1
        fps_frame_count += 1
        state.total_frames_processed += 1
        
        # Calculate progress
        if total_frames > 0:
            state.video_progress = round((frame_count / total_frames) * 100, 1)
        
        # Calculate FPS
        elapsed = time.time() - fps_start_time
        if elapsed >= 1.0:
            state.current_fps = round(fps_frame_count / elapsed, 1)
            fps_start_time = time.time()
            fps_frame_count = 0
        
        # Run detection
        annotated_frame = frame.copy()
        detected_this_frame = False
        
        if state.model is not None:
            # Use the lower display threshold so we get detections more consistently
            results = state.model(frame, verbose=False, conf=DISPLAY_THRESHOLD)
            
            best_conf = 0
            best_bbox = None
            best_class = None
            
            for result in results:
                boxes = result.boxes
                if boxes is not None and len(boxes) > 0:
                    for box in boxes:
                        conf = float(box.conf[0])
                        cls = int(box.cls[0])
                        class_name = state.model.names[cls]
                        
                        if class_name.lower() == "snake" and conf > best_conf:
                            best_conf = conf
                            best_bbox = [int(c) for c in box.xyxy[0].tolist()]
                            best_class = class_name
            
            if best_bbox is not None:
                detected_this_frame = True
                last_bbox = best_bbox
                last_conf = best_conf
                frames_since_detection = 0
            else:
                frames_since_detection += 1
        
        # Draw bounding box — either current detection or persisted from recent frames
        if frames_since_detection <= PERSIST_FRAMES and last_bbox is not None:
            x1, y1, x2, y2 = last_bbox
            display_conf = last_conf
            
            # Fade the box slightly when persisting (reduce opacity effect via color)
            if detected_this_frame:
                # Fresh detection: bright green
                color = (0, 255, 0) if display_conf > 0.5 else (0, 230, 100) if display_conf > 0.3 else (0, 200, 150)
                thickness = 3
            else:
                # Persisted: slightly dimmer to show it's from recent memory
                fade = max(0.4, 1.0 - (frames_since_detection / PERSIST_FRAMES) * 0.6)
                color = (0, int(200 * fade), int(100 * fade))
                thickness = 2
            
            cv2.rectangle(annotated_frame, (x1, y1), (x2, y2), color, thickness)
            
            # Draw label
            label = f"Snake {display_conf:.0%}"
            (label_w, label_h), baseline = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.7, 2)
            cv2.rectangle(annotated_frame, (x1, y1 - label_h - 10), (x1 + label_w + 10, y1), color, -1)
            cv2.putText(annotated_frame, label, (x1 + 5, y1 - 5),
                       cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 0), 2)
            
            # Record detection with cooldown (only when confidence meets save threshold)
            if detected_this_frame and best_conf >= CONFIDENCE_THRESHOLD:
                current_time = time.time()
                if current_time - state.last_detection_time > DETECTION_COOLDOWN:
                    state.last_detection_time = current_time
                    state.total_detections += 1
                    
                    # Save detection frame
                    detection_id = str(uuid.uuid4())[:8]
                    frame_filename = f"detection_{detection_id}.jpg"
                    frame_path = OUTPUT_DIR / frame_filename
                    cv2.imwrite(str(frame_path), annotated_frame)
                    
                    detection_record = {
                        "id": detection_id,
                        "timestamp": datetime.utcnow().isoformat(),
                        "confidence": round(best_conf, 4),
                        "class": best_class,
                        "bbox": {"x1": x1, "y1": y1, "x2": x2, "y2": y2},
                        "frame_number": frame_count,
                        "video": os.path.basename(video_path),
                        "image_path": f"/detections_output/{frame_filename}",
                        "video_progress": state.video_progress,
                    }
                    
                    with state.detection_lock:
                        state.detections.append(detection_record)
                    
                    print(f"🐍 Detection #{state.total_detections}: {best_class} ({best_conf:.0%}) at frame {frame_count}")
                    
                    # Auto-upload to Supabase in background thread (for mobile app alerts)
                    if AUTO_UPLOAD_ENABLED:
                        upload_thread = threading.Thread(
                            target=auto_upload_detection,
                            args=(detection_record.copy(),),
                            daemon=True,
                        )
                        upload_thread.start()
        
        # Add HUD overlay
        annotated_frame = draw_hud(annotated_frame, frame_count, total_frames)
        
        # Update the latest frame for streaming
        with state.frame_lock:
            state.latest_frame = annotated_frame.copy()
            state.latest_raw_frame = frame.copy()
        
        # Frame rate control
        time.sleep(frame_delay)
    
    cap.release()
    state.cap = None
    print("⏹️  Video processing stopped")


def draw_hud(frame, frame_count, total_frames):
    """Draw heads-up display overlay on frame"""
    h, w = frame.shape[:2]
    
    # Semi-transparent top bar
    overlay = frame.copy()
    cv2.rectangle(overlay, (0, 0), (w, 45), (0, 0, 0), -1)
    cv2.addWeighted(overlay, 0.6, frame, 0.4, 0, frame)
    
    # Status text
    status = "● DETECTING" if state.is_running and not state.is_paused else "⏸ PAUSED" if state.is_paused else "⏹ STOPPED"
    cv2.putText(frame, f"SnakeGuard Live Test | {status}", (10, 30),
               cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)
    
    # Stats on right side
    stats_text = f"FPS: {state.current_fps:.0f} | Detections: {state.total_detections}"
    (tw, _), _ = cv2.getTextSize(stats_text, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)
    cv2.putText(frame, stats_text, (w - tw - 10, 30),
               cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
    
    # Progress bar at bottom
    if total_frames > 0:
        progress = frame_count / total_frames
        bar_y = h - 8
        cv2.rectangle(frame, (0, bar_y), (w, h), (40, 40, 40), -1)
        cv2.rectangle(frame, (0, bar_y), (int(w * progress), h), (0, 200, 0), -1)
    
    return frame


# ─── Flask Routes ────────────────────────────────────────────────────────────

@app.route("/")
def index():
    return jsonify({
        "service": "SnakeGuard Local Detector",
        "status": "running",
        "model_loaded": state.model is not None,
        "model_path": str(MODEL_PATH),
        "videos_dir": str(VIDEOS_DIR),
    })


@app.route("/api/videos")
def list_videos():
    """List all available test videos"""
    videos = []
    if VIDEOS_DIR.exists():
        for f in sorted(VIDEOS_DIR.iterdir()):
            if f.suffix.lower() in (".mp4", ".avi", ".mov", ".mkv", ".webm"):
                size_mb = f.stat().st_size / (1024 * 1024)
                videos.append({
                    "name": f.name,
                    "size_mb": round(size_mb, 1),
                    "path": str(f),
                })
    return jsonify({"videos": videos})


@app.route("/api/start", methods=["POST"])
def start_processing():
    """Start processing a video"""
    global state
    
    if state.is_running:
        return jsonify({"error": "Already running. Stop first."}), 400
    
    data = request.json or {}
    video_name = data.get("video")
    
    if not video_name:
        return jsonify({"error": "No video specified. Use {\"video\": \"filename.mp4\"}"}), 400
    
    video_path = VIDEOS_DIR / video_name
    if not video_path.exists():
        return jsonify({"error": f"Video not found: {video_name}"}), 404
    
    # Reset state
    state.is_running = True
    state.is_paused = False
    state.current_video = video_name
    state.detections = []
    state.total_frames_processed = 0
    state.total_detections = 0
    state.video_progress = 0
    state.current_fps = 0
    state.last_detection_time = 0
    state.start_time = time.time()
    
    # Start processing in background thread
    state.processing_thread = threading.Thread(
        target=process_video, args=(str(video_path),), daemon=True
    )
    state.processing_thread.start()
    
    return jsonify({
        "message": f"Started processing {video_name}",
        "video": video_name,
    })


@app.route("/api/stop", methods=["POST"])
def stop_processing():
    """Stop current processing"""
    global state
    state.is_running = False
    state.is_paused = False
    return jsonify({"message": "Processing stopped"})


@app.route("/api/pause", methods=["POST"])
def pause_processing():
    """Toggle pause on current processing"""
    global state
    if not state.is_running:
        return jsonify({"error": "Not currently running"}), 400
    state.is_paused = not state.is_paused
    return jsonify({"paused": state.is_paused})


@app.route("/api/status")
def get_status():
    """Get current processing status"""
    uptime = round(time.time() - state.start_time, 1) if state.start_time and state.is_running else 0
    return jsonify({
        "is_running": state.is_running,
        "is_paused": state.is_paused,
        "current_video": state.current_video,
        "total_frames_processed": state.total_frames_processed,
        "total_detections": state.total_detections,
        "current_fps": state.current_fps,
        "video_progress": state.video_progress,
        "confidence_threshold": CONFIDENCE_THRESHOLD,
        "model_loaded": state.model is not None,
        "uptime_seconds": uptime,
        "auto_upload": AUTO_UPLOAD_ENABLED,
        "device_id": LIVE_TEST_DEVICE_ID,
        "supabase_connected": state.supabase_client is not None,
    })


@app.route("/api/detections")
def get_detections():
    """Get all detections from current session"""
    with state.detection_lock:
        return jsonify({
            "count": len(state.detections),
            "detections": list(reversed(state.detections)),  # newest first
        })


@app.route("/api/auto-upload", methods=["GET", "POST"])
def toggle_auto_upload():
    """Get or toggle auto-upload to Supabase (for mobile app alerts)"""
    global AUTO_UPLOAD_ENABLED
    if request.method == "POST":
        data = request.json or {}
        if "enabled" in data:
            AUTO_UPLOAD_ENABLED = bool(data["enabled"])
            status_icon = "\u2705" if AUTO_UPLOAD_ENABLED else "\u26d4"
            status_text = "enabled" if AUTO_UPLOAD_ENABLED else "disabled"
            print(f"{status_icon} Auto-upload {status_text}")
    return jsonify({
        "auto_upload": AUTO_UPLOAD_ENABLED,
        "device_id": LIVE_TEST_DEVICE_ID,
        "supabase_connected": state.supabase_client is not None,
    })


@app.route("/api/config", methods=["POST"])
def update_config():
    """Update detection configuration"""
    global CONFIDENCE_THRESHOLD, DETECTION_COOLDOWN
    data = request.json or {}
    if "confidence_threshold" in data:
        CONFIDENCE_THRESHOLD = float(data["confidence_threshold"])
    if "detection_cooldown" in data:
        DETECTION_COOLDOWN = float(data["detection_cooldown"])
    return jsonify({
        "confidence_threshold": CONFIDENCE_THRESHOLD,
        "detection_cooldown": DETECTION_COOLDOWN,
    })


@app.route("/stream")
def video_stream():
    """MJPEG video stream endpoint"""
    def generate():
        while True:
            with state.frame_lock:
                frame = state.latest_frame
            
            if frame is not None:
                encode_param = [int(cv2.IMWRITE_JPEG_QUALITY), JPEG_QUALITY]
                ret, buffer = cv2.imencode('.jpg', frame, encode_param)
                if ret:
                    yield (b'--frame\r\n'
                           b'Content-Type: image/jpeg\r\n\r\n' + buffer.tobytes() + b'\r\n')
            else:
                # Generate placeholder frame
                import numpy as np
                placeholder = np.zeros((480, 640, 3), dtype=np.uint8)
                cv2.putText(placeholder, "Select a video and click Start", (80, 220),
                           cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
                cv2.putText(placeholder, "to begin snake detection...", (100, 260),
                           cv2.FONT_HERSHEY_SIMPLEX, 0.7, (150, 150, 150), 2)
                ret, buffer = cv2.imencode('.jpg', placeholder)
                if ret:
                    yield (b'--frame\r\n'
                           b'Content-Type: image/jpeg\r\n\r\n' + buffer.tobytes() + b'\r\n')
            
            time.sleep(1.0 / STREAM_FPS)
    
    return Response(generate(), mimetype='multipart/x-mixed-replace; boundary=frame')


@app.route("/snapshot")
def snapshot():
    """Get latest frame as JPEG"""
    with state.frame_lock:
        frame = state.latest_frame
    
    if frame is not None:
        ret, buffer = cv2.imencode('.jpg', frame)
        if ret:
            return Response(buffer.tobytes(), mimetype='image/jpeg')
    
    return jsonify({"error": "No frame available"}), 503


@app.route("/api/upload-detection", methods=["POST"])
def upload_detection():
    """Upload a specific detection to Supabase"""
    if not state.supabase_client:
        return jsonify({"error": "Supabase not configured"}), 503
    
    data = request.json or {}
    detection_id = data.get("detection_id")
    
    if not detection_id:
        return jsonify({"error": "No detection_id provided"}), 400
    
    # Find the detection
    detection = None
    with state.detection_lock:
        for d in state.detections:
            if d["id"] == detection_id:
                detection = d.copy()
                break
    
    if not detection:
        return jsonify({"error": "Detection not found"}), 404
    
    try:
        # Upload image to Supabase storage
        image_path = PROJECT_ROOT / "public" / detection["image_path"].lstrip("/")
        if image_path.exists():
            image_name = f"live_test_{uuid.uuid4()}.jpg"
            with open(image_path, "rb") as f:
                state.supabase_client.storage.from_("snake-images").upload(image_name, f)
            
            public_url = state.supabase_client.storage.from_("snake-images").get_public_url(image_name)
        else:
            public_url = ""
        
        # Insert detection record (include device_id for mobile app linkage)
        response = state.supabase_client.table("snake_detections").insert({
            "timestamp": detection["timestamp"],
            "confidence": detection["confidence"],
            "image_url": public_url,
            "latitude": data.get("latitude", DEFAULT_LATITUDE),
            "longitude": data.get("longitude", DEFAULT_LONGITUDE),
            "device_id": LIVE_TEST_DEVICE_ID,
            "processed": False,
        }).execute()
        
        db_id = response.data[0]["id"] if response.data else None
        
        return jsonify({
            "message": "Detection uploaded to Supabase",
            "database_id": db_id,
            "image_url": public_url,
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ─── Main ────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("\n" + "=" * 60)
    print("  🐍 SnakeGuard Local Video Detector")
    print("=" * 60)
    
    # Load model
    state.model = load_model()
    
    # Init Supabase (optional)
    state.supabase_client = init_supabase()
    
    print(f"\n📁 Videos directory: {VIDEOS_DIR}")
    if VIDEOS_DIR.exists():
        videos = [f.name for f in VIDEOS_DIR.iterdir() if f.suffix.lower() in (".mp4", ".avi", ".mov", ".mkv")]
        print(f"   Found {len(videos)} video(s): {', '.join(videos)}")
    
    print(f"\n📱 Mobile Alerts:")
    print(f"   Auto-Upload:  {'✅ Enabled' if AUTO_UPLOAD_ENABLED else '❌ Disabled'}")
    print(f"   Device ID:    {LIVE_TEST_DEVICE_ID}")
    print(f"   Supabase:     {'✅ Connected' if state.supabase_client else '❌ Not configured'}")
    print(f"   Next.js API:  {NEXT_APP_URL}")

    print(f"\n🌐 Starting server on http://localhost:5050")
    print(f"   Stream:     http://localhost:5050/stream")
    print(f"   API:        http://localhost:5050/api/videos")
    print(f"   Snapshot:   http://localhost:5050/snapshot")
    print("=" * 60 + "\n")
    
    app.run(host="0.0.0.0", port=5050, threaded=True, debug=False)
