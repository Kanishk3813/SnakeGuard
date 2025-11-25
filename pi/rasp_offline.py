"""
Enhanced Raspberry Pi Detection Script with Offline Support
Automatically queues detections when offline and syncs when connection is restored
"""
import cv2
import torch
from ultralytics import YOLO
from picamera2 import Picamera2
import numpy as np
from datetime import datetime
import uuid
import os
import time
import requests

# Optional supabase import
try:
    from supabase import create_client, Client  # type: ignore
    SUPABASE_AVAILABLE = True
except ImportError:
    SUPABASE_AVAILABLE = False
    Client = None  # type: ignore
    def create_client(*args, **kwargs):
        return None

from offline_queue import OfflineQueue
from offline_sync import OfflineSync

# Supabase config
SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "")
supabase = create_client(SUPABASE_URL, SUPABASE_KEY) if (SUPABASE_AVAILABLE and SUPABASE_URL and SUPABASE_KEY) else None

# Load the YOLOv8 model
model = YOLO("best.pt")  

# Initialize Picamera2
picam2 = Picamera2()
picam2.configure(picam2.create_preview_configuration(main={"size": (640, 480)}))
picam2.start()

# Detection threshold and cooldown settings in seconds
CONFIDENCE_THRESHOLD = float(os.environ.get("CONFIDENCE_THRESHOLD", 0.5))
DETECTION_COOLDOWN = int(os.environ.get("DETECTION_COOLDOWN", 10))
MAX_DETECTIONS_PER_HOUR = int(os.environ.get("MAX_DETECTIONS_PER_HOUR", 100))
SETTINGS_REFRESH_INTERVAL = int(os.environ.get("SETTINGS_REFRESH_INTERVAL", 300))
APP_BASE_URL = os.environ.get("APP_BASE_URL", "http://localhost:3000")
OFFLINE_MODE = os.environ.get("OFFLINE_MODE", "auto")  # "auto", "always", "never"

# Initialize offline queue and sync
queue = OfflineQueue()
sync_manager = OfflineSync(SUPABASE_URL, SUPABASE_KEY, APP_BASE_URL) if SUPABASE_URL else None

# Start background sync thread
if sync_manager:
    sync_thread = sync_manager.start_background_sync(interval=60)  # Sync every 60 seconds
    print("🔄 Background sync thread started")

last_detection_time = 0
last_settings_refresh = 0
recent_detection_times = []

# Local storage directory for offline images
OFFLINE_STORAGE_DIR = os.path.join(os.path.dirname(__file__), "offline_detections")
os.makedirs(OFFLINE_STORAGE_DIR, exist_ok=True)

def check_connection():
    """Check if internet connection is available"""
    try:
        response = requests.get("https://www.google.com", timeout=3)
        return response.status_code == 200
    except:
        return False

def upload_detection(image_path, confidence, latitude=None, longitude=None):
    """
    Upload detection with offline fallback
    
    Returns:
        success: bool, detection_id: str or None
    """
    is_online = check_connection() if OFFLINE_MODE == "auto" else (OFFLINE_MODE == "never")
    
    # Try online upload first if connected
    if is_online and supabase:
        try:
            image_name = f"{uuid.uuid4()}.jpg"
            print("Attempting online upload...")
            
            with open(image_path, "rb") as f:
                result = supabase.storage.from_("snake-images").upload(image_name, f)
            
            if result:
                public_url = supabase.storage.from_("snake-images").get_public_url(image_name)
                
                response = supabase.table("snake_detections").insert({
                    "timestamp": datetime.utcnow().isoformat(),
                    "confidence": round(confidence, 2),
                    "image_url": public_url,
                    "latitude": latitude,
                    "longitude": longitude,
                }).execute()
                
                if response.data and len(response.data) > 0:
                    detection_id = response.data[0].get('id')
                    print(f"✅ Uploaded to Supabase (ID: {detection_id})")
                    
                    # Trigger pipeline if enabled
                    auto_trigger = os.environ.get("AUTO_TRIGGER_PIPELINE", "0") == "1"
                    if auto_trigger and detection_id:
                        try:
                            requests.post(
                                f"{APP_BASE_URL}/api/detections/process",
                                json={"detectionId": detection_id},
                                timeout=10
                            )
                        except:
                            pass  # Non-critical
                    
                    return True, detection_id
        
        except Exception as e:
            print(f"⚠️ Online upload failed: {e}")
            # Fall through to offline queue
    
    # Offline mode: queue the detection
    if OFFLINE_MODE in ["auto", "always"]:
        # Copy image to offline storage
        offline_image_path = os.path.join(OFFLINE_STORAGE_DIR, f"{uuid.uuid4()}.jpg")
        import shutil
        shutil.copy2(image_path, offline_image_path)
        
        # Add to queue
        detection_id = queue.add_detection(
            image_path=offline_image_path,
            confidence=confidence,
            latitude=latitude,
            longitude=longitude,
            metadata={"original_path": image_path}
        )
        
        print(f"📦 Detection queued offline (ID: {detection_id})")
        
        # Try immediate sync if connection available
        if sync_manager and check_connection():
            stats = sync_manager.sync_all(batch_size=1)
            if stats.get("synced", 0) > 0:
                print(f"✅ Immediately synced queued detection")
        
        return True, detection_id
    
    print("❌ Upload failed and offline mode disabled")
    return False, None

def refresh_detection_settings(force=False):
    global CONFIDENCE_THRESHOLD, DETECTION_COOLDOWN, MAX_DETECTIONS_PER_HOUR, last_settings_refresh
    now = time.time()
    if not force and now - last_settings_refresh < SETTINGS_REFRESH_INTERVAL:
        return

    if not check_connection():
        print("[Settings] No connection, using cached settings")
        return

    try:
        response = requests.get(f"{APP_BASE_URL}/api/settings/detection", timeout=5)
        if response.status_code == 200:
            data = response.json()
            CONFIDENCE_THRESHOLD = float(data.get('confidenceThreshold', CONFIDENCE_THRESHOLD))
            DETECTION_COOLDOWN = int(data.get('detectionCooldown', DETECTION_COOLDOWN))
            MAX_DETECTIONS_PER_HOUR = int(data.get('maxDetectionsPerHour', MAX_DETECTIONS_PER_HOUR))
            print(f"[Settings] Updated thresholds: confidence={CONFIDENCE_THRESHOLD}, cooldown={DETECTION_COOLDOWN}s, max/hr={MAX_DETECTIONS_PER_HOUR}")
        else:
            print(f"[Settings] Failed to refresh: HTTP {response.status_code}")
    except Exception as e:
        print(f"[Settings] Unable to refresh (using cached): {e}")
    finally:
        last_settings_refresh = now

def can_record_detection():
    global recent_detection_times
    now = time.time()
    one_hour_ago = now - 3600
    recent_detection_times = [ts for ts in recent_detection_times if ts >= one_hour_ago]
    if len(recent_detection_times) >= MAX_DETECTIONS_PER_HOUR:
        return False
    recent_detection_times.append(now)
    return True

def print_queue_stats():
    """Print current queue statistics"""
    stats = queue.get_queue_stats()
    if stats["unsynced"] > 0:
        print(f"📊 Queue: {stats['unsynced']} unsynced, {stats['synced']} synced ({(stats['queue_usage_percent']):.1f}% full)")

# Initialize
refresh_detection_settings(force=True)
print_queue_stats()

print("\n🐍 SnakeGuard Detection System Started")
print(f"   Mode: {'Offline-capable' if OFFLINE_MODE in ['auto', 'always'] else 'Online-only'}")
print(f"   Confidence Threshold: {CONFIDENCE_THRESHOLD}")
print(f"   Detection Cooldown: {DETECTION_COOLDOWN}s\n")

while True:
    refresh_detection_settings()
    
    # Print queue stats periodically
    if int(time.time()) % 300 == 0:  # Every 5 minutes
        print_queue_stats()
    
    frame = picam2.capture_array()
    frame = cv2.cvtColor(frame, cv2.COLOR_RGB2BGR)

    results = model(frame)

    for result in results[0].boxes.data:
        x1, y1, x2, y2, conf, cls = result.tolist()
        if conf > CONFIDENCE_THRESHOLD:
            class_name = model.names[int(cls)]
            if class_name == "snake":
                current_time = time.time()
                if current_time - last_detection_time > DETECTION_COOLDOWN:
                    if not can_record_detection():
                        print(f"Skipping detection to respect max {MAX_DETECTIONS_PER_HOUR} detections/hour limit.")
                        continue
                    print(f"Snake Detected! Confidence: {conf:.2f}")
                    last_detection_time = current_time

                    # Draw bounding box
                    cv2.rectangle(frame, (int(x1), int(y1)), (int(x2), int(y2)), (0, 255, 0), 2)
                    cv2.putText(frame, f"{class_name} {conf:.2f}", (int(x1), int(y1) - 10),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)

                    # Save image locally
                    image_path = f"/tmp/snake_detected_{int(time.time())}.jpg"
                    cv2.imwrite(image_path, frame)

                    # Upload with offline fallback
                    upload_detection(image_path, conf)

    # Show the video feed
    cv2.imshow("Snake Detection", frame)

    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

cv2.destroyAllWindows()

