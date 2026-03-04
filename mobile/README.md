# SnakeGuard Mobile App

React Native / Expo mobile companion app for the SnakeGuard IoT snake detection system.

## Features

- **Device Registration** — Register your Raspberry Pi camera device and link it to your account
- **24/7 Live Monitoring** — Watch MJPEG live feeds from your camera directly in the app
- **Instant Alerts** — Get real-time push notifications when a snake is detected by your camera
- **Detection History** — Browse all past detections with species, risk level, venomous status, confidence, and location
- **Detection Detail** — View full classification info, first-aid instructions, and assigned incident playbooks
- **Device Management** — Add/remove cameras, view device status (online/offline), and connection info
- **Realtime Alerts Feed** — In-app alerts powered by Supabase Realtime with haptic feedback

## Tech Stack

| Layer              | Technology                                  |
| ------------------ | ------------------------------------------- |
| Framework          | Expo SDK 52, React Native 0.76              |
| Routing            | Expo Router 4 (file-based)                  |
| Auth & DB          | Supabase (same backend as web dashboard)    |
| Secure Storage     | expo-secure-store                           |
| Push Notifications | expo-notifications + Expo Push Service      |
| Live Stream        | react-native-webview (MJPEG)                |
| Realtime           | Supabase Realtime (postgres_changes)        |
| Haptics            | expo-haptics                                |

## Prerequisites

- Node.js 18+
- Expo CLI (`npm install -g expo-cli`)
- Supabase project (same instance used by the web app)
- Physical device or emulator (push notifications require a real device)

## Setup

### 1. Install dependencies

```bash
cd mobile
npm install
```

### 2. Configure environment

Copy the example env file and fill in your Supabase credentials:

```bash
cp .env.example .env
```

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
EXPO_PUBLIC_API_URL=http://localhost:3000
```

### 3. Database migrations

Add the following columns to your Supabase tables (run in SQL Editor):

```sql
-- Add user_id to cameras table (links camera to mobile app user)
ALTER TABLE cameras ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
CREATE INDEX IF NOT EXISTS idx_cameras_user_id ON cameras(user_id);

-- Add expo_push_token to user_profiles table
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS expo_push_token TEXT;
```

### 4. Start the app

```bash
npx expo start
```

Then:
- Press `a` for Android emulator
- Press `i` for iOS simulator
- Scan QR code with Expo Go on your physical device

## Project Structure

```
mobile/
├── app/                        # Expo Router screens
│   ├── _layout.tsx             # Root layout (auth guard)
│   ├── (auth)/                 # Auth screens
│   │   ├── _layout.tsx
│   │   ├── login.tsx
│   │   └── signup.tsx
│   ├── (tabs)/                 # Main tab navigator
│   │   ├── _layout.tsx         # Tab bar with 5 tabs
│   │   ├── index.tsx           # Home dashboard
│   │   ├── feed.tsx            # Live camera feeds
│   │   ├── detections.tsx      # Detection history
│   │   ├── alerts.tsx          # Realtime alerts
│   │   └── settings.tsx        # Profile & settings
│   ├── detection/
│   │   └── [id].tsx            # Detection detail
│   └── devices/
│       ├── index.tsx           # Device list
│       └── add.tsx             # Register new device
├── src/
│   ├── components/             # Reusable UI components
│   │   ├── AlertItem.tsx
│   │   ├── DetectionCard.tsx
│   │   ├── DeviceCard.tsx
│   │   ├── LiveStreamView.tsx
│   │   └── StatCard.tsx
│   ├── contexts/
│   │   └── AuthContext.tsx      # Auth state management
│   ├── hooks/
│   │   ├── useDetections.ts    # Fetch user's detections
│   │   ├── useDevices.ts       # CRUD for camera devices
│   │   └── useRealtimeAlerts.ts # Supabase Realtime alerts
│   └── lib/
│       ├── notifications.ts    # Push notification setup
│       ├── supabase.ts         # Supabase client (SecureStore)
│       ├── theme.ts            # Design tokens
│       └── types.ts            # TypeScript interfaces
├── app.json                    # Expo config
├── babel.config.js
├── package.json
└── tsconfig.json
```

## How It Works

### Detection Flow

1. Your Raspberry Pi camera detects a snake using the YOLO model
2. Detection is uploaded to Supabase `snake_detections` table
3. **Instant path**: Supabase Realtime triggers in-app alert with haptic feedback
4. **Pipeline path**: Server classifies species → assigns playbook → sends push notification via Expo Push Service
5. You see the alert in the app and can view full details, first-aid info, and response playbook

### Push Notifications

The app registers for push notifications on login and saves the Expo push token to `user_profiles.expo_push_token`. The server's notification API (`/api/notifications/send`) sends push notifications to:

1. **Nearby users** — Based on geo-radius from detection location
2. **Camera owner** — Always notified via push when their device detects a snake

### Live Streaming

The Pi runs `stream_server.py` which serves an MJPEG stream. The app uses a WebView to render the stream. Ensure your Pi and phone are on the same network, or configure port forwarding for remote access.

## Building for Production

```bash
# Install EAS CLI
npm install -g eas-cli

# Configure EAS
eas build:configure

# Build for Android
eas build --platform android

# Build for iOS
eas build --platform ios
```

## Notes

- Push notifications require a physical device (not available in simulators)
- MJPEG streaming requires the Pi's stream server to be accessible from the phone's network
- The app shares the same Supabase backend as the web dashboard — all detections appear in both
