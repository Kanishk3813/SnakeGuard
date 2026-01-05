"""
Device Registration Script
Registers or updates camera device in Supabase database

Run this once to register your Raspberry Pi, or set it to run on startup.

Usage:
    python register_device.py

Configuration:
    Edit the variables below to configure your device registration.
"""

import os
import uuid
import socket
import requests
from datetime import datetime

# ============================================================================
# CONFIGURATION - Edit these values
# ============================================================================

# Supabase Configuration
SUPABASE_URL = "https://your-project.supabase.co"  # Replace with your Supabase URL
SUPABASE_KEY = "your-service-role-key-here"  # Replace with your Supabase SERVICE ROLE key (not anon key)

# Device Configuration
DEVICE_NAME = "Camera"  # Custom name for your camera (or leave as "Camera")
DEVICE_LATITUDE = None  # Optional: Set to your camera's latitude (e.g., 12.9716)
DEVICE_LONGITUDE = None  # Optional: Set to your camera's longitude (e.g., 77.5946)
STREAM_PORT = 8080  # Port for video stream (default: 8080)

# ============================================================================
# END CONFIGURATION
# ============================================================================

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
    
    # Check if configuration is set
    if not SUPABASE_URL or SUPABASE_URL == "https://your-project.supabase.co":
        print("❌ ERROR: Please edit register_device.py and set SUPABASE_URL")
        print("   Get your Supabase URL from: Dashboard → Settings → API")
        return False
    
    if not SUPABASE_KEY or SUPABASE_KEY == "your-service-role-key-here":
        print("❌ ERROR: Please edit register_device.py and set SUPABASE_KEY")
        print("   Get your Service Role key from: Dashboard → Settings → API → service_role (secret)")
        print("   ⚠️  Use the SERVICE ROLE key (not anon key) to bypass RLS")
        return False
    
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    
    device_id = get_device_id()
    device_name = DEVICE_NAME if DEVICE_NAME else f"Camera-{socket.gethostname()}"
    latitude = DEVICE_LATITUDE
    longitude = DEVICE_LONGITUDE
    stream_port = STREAM_PORT
    
    local_ip = get_local_ip()
    stream_url = f"http://{local_ip}:{stream_port}/stream"
    
    print(f"📷 Registering device...")
    print(f"   Device ID: {device_id}")
    print(f"   Name: {device_name}")
    print(f"   Stream URL: {stream_url}")
    if latitude and longitude:
        print(f"   Location: {latitude}, {longitude}")
    
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
    
    if latitude is not None:
        device_data["latitude"] = float(latitude)
    if longitude is not None:
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


