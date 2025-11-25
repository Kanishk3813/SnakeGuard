# SnakeGuard: IoT-Enabled Snake Detection System

## 🐍 About the Project

SnakeGuard is an IoT-enabled continuous snake detection system with GPS-based alerting designed for wildlife conservation and human safety. This project leverages YOLOv8n, a lightweight object detection model, to identify snakes in real-time from camera feeds and automatically processes detections through an AI-powered incident response pipeline.

### 📊 Key Performance Metrics

- **mAP@0.5:** 90.2%
- **F1-Score:** 84%
- **Precision:** 89% 
- **Recall:** 84%
- **Inference Speed:** 15-20 FPS on Raspberry Pi

## 🎯 Features

### Core Detection
- **Real-time Snake Detection:** Uses YOLOv8n model for efficient, accurate detection
- **Edge Computing:** Optimized for deployment on Raspberry Pi devices
- **GPS Integration:** Geo-tags each detection for precise location tracking
- **Offline Capability:** ⚡ **NEW!** Automatic offline queue with background sync - detections are stored locally when offline and automatically synced when connection is restored

### Automated Incident Response Pipeline ⚡
- **AI-Powered Species Classification:** Automatically classifies snake species using Google Gemini AI
- **Risk Assessment:** Determines venomous status and assigns risk levels (low, medium, high, critical)
- **Auto-Playbook Assignment:** Automatically attaches appropriate incident playbooks based on risk level and species
- **Automated Notifications:** Sends alerts via email and SMS to nearby users and global contacts
- **Incident Tracking:** Creates incident assignments with step-by-step checklists
- **Response Metrics:** Tracks pipeline performance and response times
- **AI Playbook Generator:** Generate incident playbooks with a single click using an LLM (optional auto-save to Supabase)

### Web Dashboard
- **Interactive Monitoring:** Real-time dashboard for viewing detections and activity patterns
- **Heat Map Visualization:** Geographic visualization of detection hotspots
- **Admin Panel:** Comprehensive admin interface for managing users, playbooks, and settings
- **Pipeline Dashboard:** Monitor automated processing pipeline performance
- **AI Chatbot:** Interactive chatbot for snake-related queries and first-aid information

### Incident Management
- **Incident Playbooks:** SOP builder that auto-attaches checklists, contacts, and first-aid guides
- **Step Tracking:** Mark checklist items as complete with notes
- **Contact Management:** One-click call/SMS buttons for emergency contacts
- **Status Management:** Track incidents from pending to completed

## 🔧 Tech Stack

### Hardware
- Raspberry Pi 4B
- Pi Camera Module v2
- GPS Module (NEO-6M)

### Software
- **Model:** YOLOv8n (Ultralytics)
- **Frontend/Backend:** Next.js 15 (App Router), React 19, TypeScript
- **Styling:** Tailwind CSS 4
- **Database:** Supabase (PostgreSQL)
- **AI/ML:** Google Gemini API (for species classification)
- **Image Processing:** OpenCV (Python)
- **Notifications:** Nodemailer (Email), Twilio (SMS - optional)
- **Deployment:** Vercel
- **Real-time:** Supabase Realtime subscriptions

## 📋 Installation

### Prerequisites
- Python 3.8+ (for Raspberry Pi detection script)
- Node.js 18+ (for Next.js application)
- Raspberry Pi with Raspberry Pi OS (for edge device)
- Git
- Supabase account
- Google Gemini API key

### Setting up the Next.js Application

```bash
# Clone the repository
git clone https://github.com/Kanishk3813/SnakeGuard.git
cd snakedetection

# Install dependencies
npm install

# Configure environment variables
cp .env.example .env.local
# Edit .env.local with your credentials
```

### Required Environment Variables

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Google Gemini API (for AI classification)
GEMINI_API_KEY=your_gemini_api_key

# Email Notifications (Nodemailer)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password

# Twilio (Optional - for SMS)
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=your_twilio_number

# Application URL (for webhooks/triggers)
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
```

### Setting up the Raspberry Pi Detection System

```bash
# On your Raspberry Pi
cd pi

# Create and activate a virtual environment
python3 -m venv venv
source venv/bin/activate

# Install required packages
pip install -r requirements.txt

# Download the trained YOLOv8n model
# Place it in the pi/ directory

# Configure environment variables
export APP_BASE_URL=https://your-app.vercel.app
export SUPABASE_URL=your_supabase_url
export SUPABASE_KEY=your_supabase_anon_key

# Optional: Enable offline mode (recommended for remote deployments)
export OFFLINE_MODE=auto  # Options: "auto", "always", "never"
# - "auto": Try online first, queue if offline (recommended)
# - "always": Always queue (for testing)
# - "never": Online-only mode (original behavior)

# Optional: Enable automatic pipeline triggering
export AUTO_TRIGGER_PIPELINE=1

# Run the detection system
# Choose based on your needs:
python rasp_offline.py  # With offline support (recommended)
# OR
python rasp.py          # Online-only mode
```

**Offline Mode Features:**
- Automatically queues detections when internet is unavailable
- Background sync thread syncs queued detections when connection is restored
- No data loss during connectivity issues
- See `pi/OFFLINE_MODE_README.md` for detailed documentation

### Database Setup

1. **Create Supabase Project:**
   - Go to [supabase.com](https://supabase.com) and create a new project
   - Run the database migrations (if available in `database/` folder)

2. **Enable Extensions:**
   - In Supabase Dashboard → Database → Extensions
   - Enable `pg_net` extension (for automated pipeline triggers)

3. **Set up Automated Pipeline (Optional but Recommended):**
   - Go to Admin → Settings in your app
   - Set "Alert Webhook URL" to your production URL
   - Run the trigger SQL script from `database/triggers/` folder in Supabase SQL Editor

## 🚀 Usage

### Development

```bash
# Start the development server
npm run dev

# Visit http://localhost:3000
```

### Production Build

```bash
# Build for production
npm run build

# Start production server
npm start
```

### Accessing the Dashboard

- **Local Development:** `http://localhost:3000`
- **Production:** `https://snakeguard.vercel.app/`

### Key Features Usage

#### Automated Pipeline
When a new detection is created:
1. **Automatic Classification:** AI classifies the snake species and determines risk level
2. **Playbook Assignment:** System automatically assigns matching incident playbook
3. **Notifications:** Alerts sent to nearby users and emergency contacts
4. **Incident Creation:** Incident assignment created with step-by-step checklist

#### Managing Incident Playbooks
1. Go to **Admin → Settings → Incident Playbooks**
2. Create playbooks for different risk levels (low, medium, high, critical)
3. Add species-specific playbooks for targeted responses
4. Define steps, contacts, and first-aid information
5. Playbooks automatically attach to matching detections
6. **Generate with AI:** Call the `/api/admin/playbooks/generate` endpoint (or use the upcoming UI button) to auto-create a playbook. Provide `riskLevel`, optional `species`, `scenario`, and set `save: true` to store it.

Example:
```bash
curl -X POST https://your-app.vercel.app/api/admin/playbooks/generate \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
        "riskLevel": "high",
        "species": "Russell\'s Viper",
        "scenario": "Farmer bitten in remote field",
        "location": "Tamil Nadu agricultural belt",
        "save": true
      }'
```

#### Monitoring Pipeline Performance
1. Go to **Admin → Pipeline**
2. View real-time metrics:
   - Total processed detections
   - Average response time
   - Success rates
   - Classification completion rates
3. Manually trigger polling if needed (for testing)

#### IoT Configuration
The Raspberry Pi agent automatically:
- Pulls latest detection thresholds from the API
- Refreshes settings every 5 minutes (configurable)
- Respects cooldown periods and rate limits
- Optionally triggers pipeline automatically after upload

## 🔄 System Architecture

![System Architecture](/Architecture_Snake.png)

### Detection Flow
1. **Camera captures video feed** on Raspberry Pi
2. **YOLOv8n model processes frames** in real-time (15-20 FPS)
3. **When snake detected:**
   - Captures image with bounding box
   - Records GPS coordinates
   - Uploads to Supabase storage and database
4. **Automated Pipeline Triggers:**
   - AI classifies species and risk level
   - Assigns appropriate playbook
   - Sends notifications
   - Creates incident assignment
5. **Dashboard displays** detection data in real-time

### Automated Pipeline Architecture

```
New Detection Created
    ↓
[Database Trigger] → /api/detections/process
    ↓
┌─────────────────────────────────────┐
│ 1. AI Classification (Gemini)      │
│ 2. Risk Level Assignment            │
│ 3. Playbook Auto-Assignment         │
│ 4. Notification Dispatch            │
│ 5. Incident Assignment Creation     │
│ 6. Metrics Tracking                 │
└─────────────────────────────────────┘
    ↓
Marked as Processed
```

## 📊 Results and Impact

- Achieved 90.2% mAP@0.5 on a diverse dataset of 25,000+ snake images
- Real-world testing in varied environments showed strong performance across different lighting conditions
- Automated response pipeline reduces manual intervention by 95%
- Average incident response time: 2-5 seconds from detection to notification
- Addresses UN Sustainable Development Goal 15 (Life on Land) by promoting human-wildlife coexistence

## 🔮 Future Enhancements

- ✅ **Species Classification:** Implemented using Google Gemini AI
- Thermal camera integration for improved night detection
- LoRaWAN or satellite communication for ultra-remote areas
- Mobile app interface for field personnel
- Solar-powered setup for autonomous operation
- Active learning for continuous model improvement
- Multi-camera support for wider coverage
- Advanced analytics and prediction models

## 📁 Project Structure

```
snakedetection/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── admin/              # Admin dashboard pages
│   │   ├── api/                # API routes
│   │   │   ├── detections/     # Detection endpoints
│   │   │   ├── classify-async/ # AI classification
│   │   │   └── incidents/      # Incident management
│   │   └── page.tsx            # Main dashboard
│   ├── components/             # React components
│   ├── lib/                    # Utilities and helpers
│   └── types/                  # TypeScript definitions
├── pi/                         # Raspberry Pi detection script
│   └── rasp.py                 # Main detection script
├── database/                   # Database scripts
│   └── triggers/               # Automated pipeline triggers
└── public/                     # Static assets
```

## 🛠️ API Endpoints

### Detection Endpoints
- `POST /api/detections/process` - Automated pipeline processing
- `POST /api/detections/poll` - Manual polling for unprocessed detections
- `GET /api/detections/classify` - Manual classification trigger

### Classification
- `POST /api/classify-async` - AI-powered species classification

### Incidents
- `POST /api/incidents/assign` - Assign playbook to detection
- `PATCH /api/incidents/[id]/steps` - Update incident steps

### Admin
- `GET/POST /api/admin/playbooks` - Manage incident playbooks
- `GET/PUT /api/admin/settings` - System settings

## 👥 Contributors

- [Kanishk Reddy](https://github.com/Kanishk3813) 
- [Sujal Limje](https://github.com/sujallimje)

## 🙏 Acknowledgements

- Dr. Sivakumar B, Associate Professor, Department of Computing Technologies, SRM Institute of Science and Technology
- SRM Institute of Science and Technology, Faculty of Engineering and Technology
- All staff members of Department of Computing Technologies, School of Computing

## 📄 License

This project is part of academic research at SRM Institute of Science and Technology.

---

*This project was developed as part of the Bachelor of Technology in Computer Science Engineering at SRM Institute of Science and Technology.*
