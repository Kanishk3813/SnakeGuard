# Quick Start: Camera Monitoring Setup

## 🎯 Simple 3-Step Setup

Follow these steps **in order** to get your camera feed visible in the admin dashboard:

### Step 1: Database Setup (One-time)
Run the SQL migration in Supabase SQL Editor:
```sql
-- Copy and paste contents of database/cameras_schema.sql
```

### Step 2: Register Your Camera (One-time per device)
On your Raspberry Pi:
```bash
export SUPABASE_URL="your-supabase-url"
export SUPABASE_KEY="your-supabase-key"
export DEVICE_NAME="My Camera"  # Optional
python register_device.py
```

**What this does:**
- Creates a camera entry in the database
- Saves your Pi's IP address and stream URL
- Makes the camera visible in Admin → Cameras page

### Step 3: Start Stream Server (Every time you want live feed)
On your Raspberry Pi:
```bash
python stream_server.py
```

**What this does:**
- Starts the video streaming server on port 8080
- Makes the live feed available at `http://your-pi-ip:8080/stream`

### Step 4: View in Dashboard
1. Open your admin dashboard in a web browser
2. Go to **Admin → Cameras**
3. You should see your camera listed
4. Click on it to view the live feed

---

## ❓ Troubleshooting

### Camera doesn't appear in dashboard?
- ✅ Did you run `register_device.py`? (Step 2)
- ✅ Check Supabase database - is there an entry in the `cameras` table?
- ✅ Refresh the admin page

### Feed doesn't load?
- ✅ Is `stream_server.py` running? (Step 3)
- ✅ Test the stream directly: Open `http://your-pi-ip:8080/stream` in browser
- ✅ Can your admin dashboard reach the Pi's IP address? (network/firewall)
- ✅ Check the `stream_url` in the database matches your Pi's current IP

### Stream works in browser but not in dashboard?
- ✅ Check browser console for errors (F12 → Console)
- ✅ Verify CORS/network access
- ✅ The dashboard uses the `stream_url` from database - make sure it's correct

---

## 🔄 Daily Usage

**Every time you want to view the live feed:**

1. Start the stream server:
   ```bash
   python stream_server.py
   ```

2. Open Admin → Cameras in your dashboard

3. Click on your camera to view the feed

**Note:** You only need to register the device once. After that, just start the stream server when you want to view the feed.

---

## 📋 Complete Setup Checklist

- [ ] Database migration run (`cameras_schema.sql`)
- [ ] Device registered (`register_device.py` run successfully)
- [ ] Stream server running (`stream_server.py` started)
- [ ] Camera visible in Admin → Cameras page
- [ ] Live feed loading in dashboard
- [ ] (Optional) Detection script running (`rasp_offline.py`)

---

## 🆘 Still Having Issues?

1. **Check stream server is running:**
   ```bash
   curl http://localhost:8080/health
   # Should return: {"status": "healthy"}
   ```

2. **Check device registration:**
   - Go to Supabase Dashboard → Table Editor → `cameras`
   - You should see your device with a `stream_url` field

3. **Test stream URL directly:**
   - Copy the `stream_url` from the database
   - Paste it in your browser
   - You should see the live video feed

4. **Check network connectivity:**
   - Can your admin dashboard computer reach the Pi's IP?
   - Is port 8080 open/firewall configured?
   - Are they on the same network?


