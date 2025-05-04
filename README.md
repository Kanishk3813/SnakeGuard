# SnakeGuard: IoT-Enabled Snake Detection System


## 🐍 About the Project

SnakeGuard is an IoT-enabled continuous snake detection system with GPS-based alerting designed for wildlife conservation and human safety. This project leverages YOLOv8n, a lightweight object detection model, to identify snakes in real-time from camera feeds and alert authorities with precise location data.

### 📊 Key Performance Metrics

- **mAP@0.5:** 90.2%
- **F1-Score:** 84%
- **Precision:** 89% 
- **Recall:** 84%
- **Inference Speed:** 15-20 FPS on Raspberry Pi

## 🎯 Features

- **Real-time Snake Detection:** Uses YOLOv8n model for efficient, accurate detection
- **Edge Computing:** Optimized for deployment on Raspberry Pi devices
- **GPS Integration:** Geo-tags each detection for precise location tracking
- **Automated Alerting:** Sends notifications to forest officials and local authorities
- **Web Dashboard:** Interactive interface for monitoring detections and activity patterns
- **Offline Capability:** Works without internet connectivity in remote areas

## 🔧 Tech Stack

### Hardware
- Raspberry Pi 4B
- Pi Camera Module v2
- GPS Module (NEO-6M)

### Software
- **Model:** YOLOv8n (Ultralytics)
- **Backend:** Node.js, Flask API
- **Frontend:** Next.js, Tailwind CSS
- **Database:** Supabase (PostgreSQL)
- **Image Processing:** OpenCV
- **Deployment:** Vercel

## 📋 Installation

### Prerequisites
- Python 3.8+
- Raspberry Pi with Raspberry Pi OS
- Node.js 16+
- Git

### Setting up the detection system

```bash
# Clone the repository
git clone https://github.com/Kanishk3813/SnakeGuard.git
cd snake-vision

# Create and activate a virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install required packages
pip install -r requirements.txt

# Download the trained model
https://drive.google.com/file/d/1-GXW2JWcPoVCP5WajGWTiDJq1hhYzElS/view?usp=sharing

# Configure environment variables
cp .env.example .env
# Edit .env file with your Supabase credentials
```

### Setting up the dashboard

```bash
# Navigate to the dashboard directory
cd dashboard

# Install dependencies
npm install

# Start the development server
npm run dev
```

## 🚀 Usage

### Running the detection system

```bash
python snake_detection.py
```

### Accessing the dashboard
Visit `http://localhost:3000` in your browser to access the local development server.

For production deployment, visit our hosted version at: `https://snakeguard.vercel.app/`

## 🔄 System Architecture

![System Architecture](/Architecture_Snake.png)

The system follows this workflow:
1. Camera captures video feed
2. YOLOv8n model processes frames in real-time
3. When a snake is detected, the system:
   - Captures the image with bounding box
   - Records GPS coordinates
   - Uploads data to Supabase
   - Sends alert to authorities
4. Dashboard displays detection data for monitoring

## 📊 Results and Impact

- Achieved 90.2% mAP@0.5 on a diverse dataset of 25,000+ snake images
- Real-world testing in varied environments showed strong performance across different lighting conditions
- Addresses UN Sustainable Development Goal 15 (Life on Land) by promoting human-wildlife coexistence

## 🔮 Future Enhancements

- Thermal camera integration for improved night detection
- LoRaWAN or satellite communication for ultra-remote areas
- Mobile app interface for field personnel
- Species classification to identify venomous vs. non-venomous snakes
- Solar-powered setup for autonomous operation
- Active learning for continuous model improvement

## 👥 Contributors

- [Kanishk Reddy](https://github.com/Kanishk3813) 
- [Sujal Limje](https://github.com/sujallimje)

## 🙏 Acknowledgements

- Dr. Sivakumar B, Associate Professor, Department of Computing Technologies, SRM Institute of Science and Technology
- SRM Institute of Science and Technology, Faculty of Engineering and Technology
- All staff members of Department of Computing Technologies, School of Computing


*This project was developed as part of the Bachelor of Technology in Computer Science Engineering at SRM Institute of Science and Technology.*
