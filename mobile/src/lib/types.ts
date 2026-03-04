export interface SnakeDetection {
  id: string;
  timestamp: string;
  confidence: number;
  image_url: string;
  latitude: number;
  longitude: number;
  processed: boolean;
  species?: string;
  venomous?: boolean;
  risk_level?: 'low' | 'medium' | 'high' | 'critical';
  classification_confidence?: number;
  classification_description?: string;
  classification_first_aid?: string;
  classified_at?: string;
  notes?: string;
  created_at: string;
  status?: 'pending' | 'reviewed' | 'captured' | 'false_alarm';
  device_id?: string;
}

export interface Device {
  id: string;
  device_id: string;
  name: string;
  description?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  status: 'online' | 'offline' | 'maintenance' | 'error';
  stream_url?: string | null;
  stream_type: 'mjpeg' | 'webrtc' | 'hls';
  stream_port?: number;
  last_seen?: string | null;
  firmware_version?: string | null;
  user_id?: string;
  created_at: string;
  updated_at: string;
}

export interface DashboardStats {
  totalDetections: number;
  activeDevices: number;
  recentAlerts: number;
  avgConfidence: number;
}

export interface Alert {
  id: string;
  detection: SnakeDetection;
  timestamp: string;
  read: boolean;
}

export interface IncidentPlaybook {
  id: string;
  title: string;
  risk_level: string;
  species?: string | null;
  description?: string | null;
  first_aid?: string | null;
  steps: IncidentPlaybookStep[];
  contacts: IncidentPlaybookContact[];
}

export interface IncidentPlaybookStep {
  id: string;
  title: string;
  description?: string;
}

export interface IncidentPlaybookContact {
  id: string;
  name: string;
  role?: string;
  phone?: string;
  email?: string;
}

export interface IncidentAssignment {
  id: string;
  detection_id: string;
  playbook_id: string;
  status: 'active' | 'completed' | 'cancelled';
  steps_state: {
    id: string;
    title: string;
    completed: boolean;
    completed_at?: string;
    note?: string;
  }[];
  created_at?: string;
  updated_at?: string;
  playbook?: IncidentPlaybook;
}
