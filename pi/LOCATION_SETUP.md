# Setting Device Location for Snake Detections

When snakes are detected by the Raspberry Pi, the location (latitude and longitude) is automatically saved with each detection. Here's how to configure it:

## Method 1: Environment Variables (Recommended)

Set these environment variables on your Raspberry Pi:

```bash
export DEVICE_LATITUDE=12.9716
export DEVICE_LONGITUDE=77.5946
```

To make them permanent, add to `~/.bashrc` or create a `.env` file:

```bash
# Add to ~/.bashrc
echo 'export DEVICE_LATITUDE=12.9716' >> ~/.bashrc
echo 'export DEVICE_LONGITUDE=77.5946' >> ~/.bashrc
source ~/.bashrc
```

## Method 2: Register Device with Location

Edit `register_device.py` and set:

```python
DEVICE_LATITUDE = 12.9716   # Your camera's latitude
DEVICE_LONGITUDE = 77.5946   # Your camera's longitude
```

Then run:
```bash
python register_device.py
```

The location will be stored in the `cameras` table and automatically used for all detections from this device.

## Method 3: GPS Module (Future Enhancement)

If you have a GPS module connected, you can modify the code to read location from it in real-time.

## Priority Order

The system checks for location in this order:
1. **Environment variables** (`DEVICE_LATITUDE`, `DEVICE_LONGITUDE`) - Highest priority
2. **Camera record** in database (from `register_device.py`)
3. **None** - Detection saved without location (not recommended)

## Finding Your Location

You can find your location using:
- Google Maps: Right-click on your location → Copy coordinates
- GPS device
- Online tools like latlong.net

## Verification

After setting up location, when a snake is detected, you should see in the logs:
```
📍 Using device location: 12.9716, 77.5946
```

If you see:
```
⚠️ No device location configured. Detection will be saved without location.
```

Then the location is not set up correctly. Check the methods above.



