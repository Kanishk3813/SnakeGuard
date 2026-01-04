# Camera Monitoring Setup Guide

This guide will help you set up live camera monitoring for your SnakeGuard system.

## Prerequisites

1. Raspberry Pi with camera module connected
2. Python 3.8+ installed
3. Supabase project with database access
4. Network connectivity (for streaming)

## Step 1: Database Setup

Run the database migration in your Supabase SQL Editor:

```sql
-- Copy and run the contents of database/cameras_schema.sql
```

This creates:
- `cameras` table for device registration
- Adds `device_id` column to `snake_detections` table
- Sets up indexes and security policies

## Step 2: Install Dependencies

On your Raspberry Pi, install the required Python packages:

```bash
cd pi
pip install -r requirements.txt
```

The new dependencies include:
- `flask` - For the video streaming server

## Step 3: Register Your Camera Device

First, register your Raspberry Pi as a camera device:

```bash
export SUPABASE_URL="your-supabase-url"
export SUPABASE_KEY="your-supabase-anon-key"
export DEVICE_NAME="Main Campus Camera"  # Optional
export DEVICE_LATITUDE="12.9716"  # Optional
export DEVICE_LONGITUDE="77.5946"  # Optional

python register_device.py
```

This will:
- Generate a unique device ID (based on MAC address)
- Register the camera in the Supabase database
- Set up the stream URL automatically

**Note:** The device will be registered with status "online" and the stream URL will point to your Pi's local IP address.

## Step 4: Start the Video Streaming Server

**⚠️ IMPORTANT:** You must run `register_device.py` FIRST (Step 3) before starting the stream server. The registration script saves the stream URL to the database, which the admin dashboard needs to display the feed.

In a separate terminal, start the MJPEG streaming server:

```bash
cd pi
python stream_server.py
```

The server will start on port 8080 and provide:
- **Live Stream:** `http://your-pi-ip:8080/stream`
- **Snapshot:** `http://your-pi-ip:8080/snapshot`
- **Status:** `http://your-pi-ip:8080/status`
- **Health Check:** `http://your-pi-ip:8080/health`

**Important:** 
- Make sure port 8080 is accessible from your network
- The stream URL must be accessible from where you're viewing the admin dashboard
- If accessing remotely, you may need to:
  - Configure port forwarding on your router
  - Set up a VPN or tunnel
  - Use a service like ngrok for testing

## Step 5: View Live Feed in Admin Dashboard

Now that both the device is registered AND the stream server is running:

1. Open your web browser and go to your admin dashboard
2. Navigate to **Admin → Cameras**
3. You should see your registered camera in the list
4. Click on the camera to view the live feed
5. The feed will automatically load from the `stream_url` stored in the database

**If the feed doesn't appear:**
- Check that `stream_server.py` is running (you should see "Starting MJPEG streaming server..." in the terminal)
- Verify the stream URL is correct: Open `http://your-pi-ip:8080/stream` directly in a browser - you should see the video feed
- Check that the IP address in the database matches your Pi's current IP
- Make sure your admin dashboard can reach the Pi's IP address (same network or properly configured routing)

## Step 6: Update Stream URL (If Needed)

If your Raspberry Pi's IP address changes or you're using a different network setup, update the stream URL:

1. Go to Admin → Cameras in your web dashboard
2. Or re-run `register_device.py` to update the URL automatically
3. Or use the API to update the camera's `stream_url`

## Step 7: Run Detection Script with Device Tracking

Your detection script (`rasp_offline.py`) has been updated to automatically include `device_id` in detections. Just run it as usual:

```bash
python rasp_offline.py
```

The script will:
- Automatically detect the device ID
- Link detections to the registered camera
- Upload detections with device association

## Complete Workflow Summary

Here's the **complete order of operations** to get everything working:

1. ✅ **Database Setup** - Run `database/cameras_schema.sql` in Supabase
2. ✅ **Register Device** - Run `python register_device.py` (creates camera entry in database)
3. ✅ **Start Stream Server** - Run `python stream_server.py` (starts video streaming)
4. ✅ **View in Dashboard** - Go to Admin → Cameras (should see camera and live feed)
5. ✅ **Run Detection** - Run `python rasp_offline.py` (optional, for snake detection)

**Key Points:**
- Registration (Step 2) must happen BEFORE the stream server (Step 3) for the URL to be saved
- Both registration AND stream server must be done before viewing in dashboard
- The admin dashboard reads the `stream_url` from the database and displays it
- If you only run `stream_server.py` without registering, the camera won't appear in the dashboard

## Running Multiple Services

For production, you'll want to run multiple services simultaneously:

### Option 1: Separate Terminals
```bash
# Terminal 1: Detection script
python rasp_offline.py

# Terminal 2: Stream server
python stream_server.py
```

### Option 2: Systemd Services (Recommended for Production)

Create systemd service files to run both services automatically on boot.

**Example service file:** `/etc/systemd/system/snake-detection.service`
```ini
[Unit]
Description=Snake Detection Service
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/snakedetection/pi
Environment="SUPABASE_URL=your-url"
Environment="SUPABASE_KEY=your-key"
ExecStart=/usr/bin/python3 /home/pi/snakedetection/pi/rasp_offline.py
Restart=always

[Install]
WantedBy=multi-user.target
```

**Example service file:** `/etc/systemd/system/camera-stream.service`
```ini
[Unit]
Description=Camera Stream Server
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/snakedetection/pi
ExecStart=/usr/bin/python3 /home/pi/snakedetection/pi/stream_server.py
Restart=always

[Install]
WantedBy=multi-user.target
```

Then enable and start:
```bash
sudo systemctl enable snake-detection.service
sudo systemctl enable camera-stream.service
sudo systemctl start snake-detection.service
sudo systemctl start camera-stream.service
```

## Troubleshooting

### Stream Not Loading
- Check if the stream server is running: `curl http://localhost:8080/health`
- Verify the IP address is correct in the camera registration
- Check firewall rules (port 8080 should be open)
- Try accessing the stream URL directly in a browser

### Device Not Found
- Make sure you ran `register_device.py` first
- Check that the device_id matches (MAC address should be consistent)
- Verify Supabase connection and credentials

### Performance Issues
- Lower the stream FPS in `stream_server.py` (default: 10 FPS)
- Reduce JPEG quality (default: 80)
- Lower resolution in camera config (default: 640x480)

### Camera Status Shows Offline
- The status is updated when the device registers or sends heartbeats
- You can manually update status in the admin panel
- Consider adding a heartbeat mechanism to keep status current

## Next Steps

- **Multiple Cameras:** Register additional Raspberry Pi devices using the same process
- **WebRTC Streaming:** Upgrade from MJPEG to WebRTC for better performance
- **Recording:** Add snapshot/recording on detection events
- **Alerts:** Set up alerts when camera goes offline

## Security Notes

⚠️ **Important Security Considerations:**

1. **Authentication:** The stream server currently has no authentication. For production:
   - Add authentication to the Flask server
   - Use HTTPS/WSS for encrypted streams
   - Implement IP whitelisting

2. **Network Access:** 
   - Only expose the stream server on trusted networks
   - Use VPN for remote access
   - Consider using a reverse proxy with authentication

3. **Database Security:**
   - Use service role key only on the Pi (not in frontend)
   - Implement proper RLS policies
   - Regularly rotate API keys

