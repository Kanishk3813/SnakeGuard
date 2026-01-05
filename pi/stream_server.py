"""
MJPEG Video Streaming Server for Raspberry Pi
Serves live camera feed as MJPEG stream accessible via web browser

This version reads frames from a shared file created by rasp_offline.py,
allowing both scripts to run simultaneously without camera conflicts.

Usage:
    python stream_server.py

The stream will be available at:
    http://raspberry-pi-ip:8080/stream
    http://raspberry-pi-ip:8080/snapshot

Requirements:
    pip install flask opencv-python

Note: Make sure rasp_offline.py is running to generate frames.
"""

from flask import Flask, Response, jsonify
import cv2
import threading
import time
import os
import uuid
import socket
from datetime import datetime

app = Flask(__name__)

# Shared frame file (created by rasp_offline.py)
SHARED_FRAME_FILE = "/tmp/snake_latest_frame.jpg"

# Stream settings
STREAM_FPS = 10  # Frames per second for stream (lower = less bandwidth)
JPEG_QUALITY = 80  # JPEG quality (1-100, lower = smaller file size)

# Get device ID (MAC address or generate UUID)
def get_device_id():
    """Get unique device identifier"""
    try:
        # Try to get MAC address
        mac = ':'.join(['{:02x}'.format((uuid.getnode() >> elements) & 0xff) 
                       for elements in range(0,2*6,2)][::-1])
        return mac
    except:
        # Fallback to hostname-based ID
        return socket.gethostname()

DEVICE_ID = get_device_id()
print(f"📷 Device ID: {DEVICE_ID}")

# Global frame buffer
latest_frame = None
frame_lock = threading.Lock()

def generate_frames():
    """Generate MJPEG frames from shared file (created by rasp_offline.py)
    
    This reads the latest frame from a file that's continuously updated by rasp_offline.py.
    The stream is LIVE because the file is updated in real-time (every frame capture).
    """
    global latest_frame
    
    last_modified = 0
    
    while True:
        try:
            # Read latest frame from shared file
            if os.path.exists(SHARED_FRAME_FILE):
                # Check if file was modified (to ensure we're reading fresh frames)
                current_modified = os.path.getmtime(SHARED_FRAME_FILE)
                
                # Only read if file was updated (or first read)
                if current_modified != last_modified or last_modified == 0:
                    frame = cv2.imread(SHARED_FRAME_FILE, cv2.IMREAD_COLOR)
                    
                    if frame is not None and frame.size > 0:
                        # Encode frame as JPEG
                        encode_param = [int(cv2.IMWRITE_JPEG_QUALITY), JPEG_QUALITY]
                        result, buffer = cv2.imencode('.jpg', frame, encode_param)
                        
                        if result:
                            with frame_lock:
                                latest_frame = buffer.tobytes()
                            
                            # Yield frame in MJPEG format
                            yield (b'--frame\r\n'
                                   b'Content-Type: image/jpeg\r\n\r\n' + buffer.tobytes() + b'\r\n')
                            
                            last_modified = current_modified
                    else:
                        # Frame file exists but couldn't be read (might be in use)
                        time.sleep(0.05)  # Shorter sleep for faster retry
                else:
                    # File hasn't changed, but still yield last frame to maintain stream
                    if latest_frame:
                        yield (b'--frame\r\n'
                               b'Content-Type: image/jpeg\r\n\r\n' + latest_frame + b'\r\n')
            else:
                # No frame file yet (rasp_offline.py not running or just started)
                # Create a placeholder frame
                import numpy as np
                placeholder = np.zeros((480, 640, 3), dtype=np.uint8)
                cv2.putText(placeholder, "Waiting for detection script...", (50, 240),
                           cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
                
                encode_param = [int(cv2.IMWRITE_JPEG_QUALITY), JPEG_QUALITY]
                result, buffer = cv2.imencode('.jpg', placeholder, encode_param)
                if result:
                    yield (b'--frame\r\n'
                           b'Content-Type: image/jpeg\r\n\r\n' + buffer.tobytes() + b'\r\n')
            
            # Control frame rate (10 FPS for stream)
            time.sleep(1.0 / STREAM_FPS)
            
        except Exception as e:
            print(f"Error generating frame: {e}")
            time.sleep(0.1)

@app.route('/stream')
def video_stream():
    """MJPEG video stream endpoint"""
    return Response(
        generate_frames(),
        mimetype='multipart/x-mixed-replace; boundary=frame'
    )

@app.route('/snapshot')
def snapshot():
    """Get single snapshot image"""
    global latest_frame
    
    with frame_lock:
        if latest_frame:
            return Response(
                latest_frame,
                mimetype='image/jpeg',
                headers={
                    'Content-Disposition': f'attachment; filename=snapshot_{datetime.now().strftime("%Y%m%d_%H%M%S")}.jpg'
                }
            )
        else:
            return jsonify({"error": "No frame available"}), 503

@app.route('/status')
def status():
    """Camera status endpoint"""
    frame_available = os.path.exists(SHARED_FRAME_FILE)
    return jsonify({
        "status": "online" if frame_available else "waiting",
        "device_id": DEVICE_ID,
        "fps": STREAM_FPS,
        "resolution": "640x480",
        "frame_source": "shared_file",
        "frame_available": frame_available,
        "note": "Reading frames from rasp_offline.py" if frame_available else "Waiting for rasp_offline.py to start",
        "timestamp": datetime.now().isoformat()
    })

@app.route('/health')
def health():
    """Health check endpoint"""
    return jsonify({"status": "healthy"}), 200

if __name__ == '__main__':
    print("🎥 Starting MJPEG streaming server...")
    print(f"📡 Stream URL: http://0.0.0.0:8080/stream")
    print(f"📸 Snapshot URL: http://0.0.0.0:8080/snapshot")
    print(f"💚 Health check: http://0.0.0.0:8080/health")
    print(f"📊 Status: http://0.0.0.0:8080/status")
    print("\n📝 Note: This server reads frames from rasp_offline.py")
    print("   Make sure rasp_offline.py is running to see the live feed")
    print("   Frame file: " + SHARED_FRAME_FILE)
    print("\n⚠️  Make sure your Raspberry Pi's IP is accessible from your network")
    print("   You may need to configure firewall rules if accessing remotely")
    
    # Run Flask server
    app.run(host='0.0.0.0', port=8080, threaded=True, debug=False)


