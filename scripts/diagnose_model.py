"""
Quick diagnostic script to check what the YOLOv8 model detects.
This will tell us the class names, what it finds, and at what confidence.
"""
import cv2
import sys
import os

# Add project root
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    from ultralytics import YOLO
except ImportError:
    print("ERROR: ultralytics not installed. Run: pip install ultralytics")
    sys.exit(1)

MODEL_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "model", "best.pt")
VIDEOS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "public", "vids")

print("=" * 60)
print("  🔍 SnakeGuard Model Diagnostic Tool")
print("=" * 60)

# 1. Load model and inspect it
print(f"\n📦 Loading model from: {MODEL_PATH}")
if not os.path.exists(MODEL_PATH):
    print(f"   ❌ Model file not found!")
    sys.exit(1)

model = YOLO(MODEL_PATH)
print(f"   ✅ Model loaded successfully")

# 2. Print model class names - THIS IS CRITICAL
print(f"\n📋 Model class names ({len(model.names)} classes):")
for idx, name in model.names.items():
    print(f"   [{idx}] = '{name}'")

# 3. Get a video to test
videos = [f for f in os.listdir(VIDEOS_DIR) if f.endswith(('.mp4', '.avi', '.mov', '.mkv'))]
print(f"\n🎬 Available videos: {videos}")

if not videos:
    print("   No videos found!")
    sys.exit(1)

# Use the first video
test_video = os.path.join(VIDEOS_DIR, videos[0])
print(f"   Testing with: {videos[0]}")

cap = cv2.VideoCapture(test_video)
if not cap.isOpened():
    print(f"   ❌ Could not open video!")
    sys.exit(1)

total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
print(f"   Total frames: {total_frames}")

# 4. Process frames and report ALL detections (no filtering)
print(f"\n🔄 Processing first 100 frames with NO confidence filter...")
print(f"   (Showing ALL detections regardless of class or confidence)\n")

frames_with_detections = 0
all_detections = []

for i in range(min(100, total_frames)):
    ret, frame = cap.read()
    if not ret:
        break
    
    # Run model with very low confidence to see everything
    results = model(frame, verbose=False, conf=0.01)
    
    for result in results:
        boxes = result.boxes
        if boxes is not None and len(boxes) > 0:
            frames_with_detections += 1
            for box in boxes:
                conf = float(box.conf[0])
                cls = int(box.cls[0])
                class_name = model.names[cls]
                x1, y1, x2, y2 = [int(c) for c in box.xyxy[0].tolist()]
                
                det_info = {
                    "frame": i,
                    "class_id": cls,
                    "class_name": class_name,
                    "confidence": conf,
                    "bbox": (x1, y1, x2, y2)
                }
                all_detections.append(det_info)
                
                if conf > 0.1:  # Only print detections above 10%
                    print(f"   Frame {i:3d} | Class: '{class_name}' (id={cls}) | Conf: {conf:.4f} | Box: ({x1},{y1})-({x2},{y2})")

cap.release()

# 5. Summary
print(f"\n{'=' * 60}")
print(f"  📊 DIAGNOSTIC SUMMARY")
print(f"{'=' * 60}")
print(f"  Frames analyzed:          {min(100, total_frames)}")
print(f"  Frames with detections:   {frames_with_detections}")
print(f"  Total detections:         {len(all_detections)}")

if all_detections:
    # Group by class name
    class_counts = {}
    class_max_conf = {}
    for d in all_detections:
        cn = d["class_name"]
        class_counts[cn] = class_counts.get(cn, 0) + 1
        class_max_conf[cn] = max(class_max_conf.get(cn, 0), d["confidence"])
    
    print(f"\n  Classes detected:")
    for cn in sorted(class_counts.keys()):
        print(f"    '{cn}': {class_counts[cn]} detections (max conf: {class_max_conf[cn]:.4f})")
    
    # Check if "snake" class exists
    snake_classes = [cn for cn in class_counts if "snake" in cn.lower()]
    if not snake_classes:
        print(f"\n  ⚠️  WARNING: No class containing 'snake' was detected!")
        print(f"  The model's classes are: {list(model.names.values())}")
        print(f"  The local_detector.py is looking for class_name == 'snake'")
        print(f"  You may need to update the class name filter in local_detector.py")
else:
    print(f"\n  ⚠️  No detections found at all (even at 1% confidence)!")
    print(f"  This could mean:")
    print(f"    - The model is not trained for this type of video")
    print(f"    - The video frames are too different from training data")
    print(f"    - The model needs a specific input resolution")

print(f"\n  Model input size: {model.overrides.get('imgsz', 'default (640)')}")
print(f"  Model task: {model.task}")
print(f"{'=' * 60}")
