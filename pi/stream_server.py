"""
MJPEG Video Streaming Server for Raspberry Pi
Serves live camera feed as MJPEG stream accessible via web browser

Usage:
    python stream_server.py

The stream will be available at:
    http://raspberry-pi-ip:8080/stream
    http://raspberry-pi-ip:8080/snapshot

Requirements:
    pip install flask picamera2 opencv-python
"""

from flask import Flask, Response, jsonify
from picamera2 import Picamera2
import cv2
import threading
import time
import os
import uuid
import socket
from datetime import datetime

app = Flask(__name__)

# Camera configuration
picam2 = Picamera2()
camera_config = picam2.create_preview_configuration(main={"size": (640, 480)})
picam2.configure(camera_config)
picam2.start()

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
    """Generate MJPEG frames from camera"""
    global latest_frame
    
    while True:
        try:
            # Capture frame from camera
            frame = picam2.capture_array()
            
            # Convert RGB to BGR for OpenCV
            frame_bgr = cv2.cvtColor(frame, cv2.COLOR_RGB2BGR)
            
            # Encode frame as JPEG
            encode_param = [int(cv2.IMWRITE_JPEG_QUALITY), JPEG_QUALITY]
            result, buffer = cv2.imencode('.jpg', frame_bgr, encode_param)
            
            if result:
                with frame_lock:
                    latest_frame = buffer.tobytes()
                
                # Yield frame in MJPEG format
                yield (b'--frame\r\n'
                       b'Content-Type: image/jpeg\r\n\r\n' + buffer.tobytes() + b'\r\n')
            
            # Control frame rate
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
    return jsonify({
        "status": "online",
        "device_id": DEVICE_ID,
        "fps": STREAM_FPS,
        "resolution": "640x480",
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
    print("\n⚠️  Make sure your Raspberry Pi's IP is accessible from your network")
    print("   You may need to configure firewall rules if accessing remotely")
    
    # Run Flask server
    app.run(host='0.0.0.0', port=8080, threaded=True, debug=False)


