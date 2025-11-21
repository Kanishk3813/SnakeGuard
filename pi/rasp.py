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

from supabase import create_client, Client

# Supabase config
SUPABASE_URL = ""
SUPABASE_KEY = ""
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

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
last_detection_time = 0
last_settings_refresh = 0
recent_detection_times = []

def upload_detection(image_path, confidence):
    try:
        image_name = f"{uuid.uuid4()}.jpg"
        # Try storage upload first
        print("Attempting storage upload...")
        with open(image_path, "rb") as f:
            result = supabase.storage.from_("snake-images").upload(image_name, f)
            print(f"Storage upload result: {result}")
        
        # If storage upload works, get URL
        public_url = supabase.storage.from_("snake-images").get_public_url(image_name)
        print(f"Got public URL: {public_url}")
        
        # Then try database insert
        print("Attempting database insert...")
        response = supabase.table("snake_detections").insert({
            "timestamp": datetime.utcnow().isoformat(),
            "confidence": round(confidence, 2),
            "image_url": public_url,
            # "latitude":, # Add your latitude here
            # "longitude": # Add your longitude here
        }).execute()
        print(f"Database insert response: {response}")
        
        print("✅ Uploaded to Supabase")
    except Exception as e:
        print("❌ Supabase upload failed:", e)
        print("Error details:", repr(e))
        print("Error type:", type(e))

def refresh_detection_settings(force=False):
    global CONFIDENCE_THRESHOLD, DETECTION_COOLDOWN, MAX_DETECTIONS_PER_HOUR, last_settings_refresh
    now = time.time()
    if not force and now - last_settings_refresh < SETTINGS_REFRESH_INTERVAL:
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
            print(f"[Settings] Failed to refresh detection settings: HTTP {response.status_code}")
    except Exception as e:
        print(f"[Settings] Unable to refresh detection settings: {e}")
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

refresh_detection_settings(force=True)

while True:
    refresh_detection_settings()
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
                    image_path = "/tmp/snake_detected.jpg"
                    cv2.imwrite(image_path, frame)

                    # Upload image and metadata
                    upload_detection(image_path, conf)

    # Show the video feed
    cv2.imshow("Snake Detection", frame)

    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

cv2.destroyAllWindows()
