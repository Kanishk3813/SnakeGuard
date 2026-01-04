"""
Device Registration Script
Registers or updates camera device in Supabase database

Run this once to register your Raspberry Pi, or set it to run on startup.

Usage:
    python register_device.py

Environment Variables:
    SUPABASE_URL - Your Supabase project URL
    SUPABASE_KEY - Your Supabase anon key (or service role key)
    DEVICE_NAME - Optional custom name for the camera (default: "Camera")
    DEVICE_LATITUDE - Optional latitude for camera location
    DEVICE_LONGITUDE - Optional longitude for camera location
    STREAM_PORT - Port for video stream (default: 8080)
"""

import os
import uuid
import socket
import requests
from datetime import datetime

try:
    from supabase import create_client, Client
    SUPABASE_AVAILABLE = True
except ImportError:
    SUPABASE_AVAILABLE = False
    print("⚠️  supabase-py not installed. Install with: pip install supabase")

def get_device_id():
    """Get unique device identifier (MAC address)"""
    try:
        # Get MAC address
        mac = ':'.join(['{:02x}'.format((uuid.getnode() >> i) & 0xff) 
                       for i in range(0, 8*6, 8)][::-1])
        return mac
    except:
        # Fallback to hostname
        return socket.gethostname()

def get_local_ip():
    """Get local IP address"""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except:
        return "unknown"

def register_device():
    """Register or update device in Supabase"""
    if not SUPABASE_AVAILABLE:
        print("❌ Supabase client not available")
        return False
    
    SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
    SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "")
    
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("❌ SUPABASE_URL and SUPABASE_KEY environment variables required")
        return False
    
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    
    device_id = get_device_id()
    device_name = os.environ.get("DEVICE_NAME", f"Camera-{socket.gethostname()}")
    latitude = os.environ.get("DEVICE_LATITUDE")
    longitude = os.environ.get("DEVICE_LONGITUDE")
    stream_port = int(os.environ.get("STREAM_PORT", 8080))
    
    local_ip = get_local_ip()
    stream_url = f"http://{local_ip}:{stream_port}/stream"
    
    print(f"📷 Registering device...")
    print(f"   Device ID: {device_id}")
    print(f"   Name: {device_name}")
    print(f"   Stream URL: {stream_url}")
    
    # Check if device already exists
    existing = supabase.table("cameras").select("*").eq("device_id", device_id).execute()
    
    device_data = {
        "device_id": device_id,
        "name": device_name,
        "stream_url": stream_url,
        "stream_port": stream_port,
        "status": "online",
        "last_seen": datetime.utcnow().isoformat(),
    }
    
    if latitude:
        device_data["latitude"] = float(latitude)
    if longitude:
        device_data["longitude"] = float(longitude)
    
    try:
        if existing.data and len(existing.data) > 0:
            # Update existing device
            result = supabase.table("cameras").update(device_data).eq("device_id", device_id).execute()
            print(f"✅ Device updated successfully (ID: {result.data[0]['id']})")
        else:
            # Insert new device
            result = supabase.table("cameras").insert(device_data).execute()
            print(f"✅ Device registered successfully (ID: {result.data[0]['id']})")
        
        return True
    except Exception as e:
        print(f"❌ Error registering device: {e}")
        return False

if __name__ == "__main__":
    register_device()


