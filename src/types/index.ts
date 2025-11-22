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
}

export interface ClassificationResult {
  species: string;
  venomous: boolean;
  confidence: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  description?: string;
  firstAid?: string;
}

  export interface DashboardStats {
    totalDetections: number;
    recentDetections: number;
    highConfidenceDetections: number;
    avgConfidence: number;
  }
  
  export interface TimeSeriesData {
    date: string;
    detections: number;
  }

  export interface UserSettings {
    id?: string;
    user_id?: string;
    // Notification Settings
    email_notifications: boolean;
    sms_notifications: boolean;
    push_notifications: boolean;
    notification_frequency: 'realtime' | 'hourly' | 'daily' | 'weekly';
    high_confidence_only: boolean;
    // Display Preferences
    theme: 'light' | 'dark' | 'auto';
    items_per_page: number;
    default_map_zoom: number;
    show_distance: boolean;
    // Detection Preferences
    min_confidence_threshold: number;
    filter_by_species: string[];
    location_radius: number;
    // Alert Settings
    alert_radius: number;
    alert_high_risk_only: boolean;
    // Privacy
    share_location: boolean;
    // Created/Updated
    created_at?: string;
    updated_at?: string;
  }

  export interface SystemSettings {
    id?: string;
    // Detection Settings
    confidence_threshold: number;
    detection_cooldown: number;
    max_detections_per_hour: number;
    // Alert Configuration
    alert_enabled: boolean;
    alert_email_recipients: string[];
    alert_sms_recipients: string[];
    alert_webhook_url?: string;
    // Model Settings
    model_version: string;
    model_update_auto: boolean;
    // Storage Settings
    image_retention_days: number;
    auto_cleanup: boolean;
    // API Settings
    api_rate_limit: number;
    api_key_expiry_days: number;
    // Integration Settings
    weather_api_enabled: boolean;
    weather_api_key?: string;
    twilio_enabled: boolean;
    twilio_account_sid?: string;
    twilio_auth_token?: string;
    twilio_phone_number?: string;
    // Created/Updated
    created_at?: string;
    updated_at?: string;
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

export interface IncidentPlaybook {
  id: string;
  title: string;
  risk_level: string;
  species?: string | null;
  description?: string | null;
  first_aid?: string | null;
  steps: IncidentPlaybookStep[];
  contacts: IncidentPlaybookContact[];
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface IncidentAssignmentStepState {
  id: string;
  title: string;
  completed: boolean;
  completed_at?: string;
  note?: string;
}

export interface IncidentAssignment {
  id: string;
  detection_id: string;
  playbook_id: string;
  status: 'active' | 'completed' | 'cancelled';
  steps_state: IncidentAssignmentStepState[];
  created_at?: string;
  updated_at?: string;
  playbook?: IncidentPlaybook;
}

export interface PipelineMetrics {
  id: string;
  detection_id: string;
  response_time_ms: number;
  classification_completed: boolean;
  playbook_assigned: boolean;
  notifications_sent: boolean;
  errors?: string[] | null;
  created_at: string;
}

export interface PipelineResult {
  success: boolean;
  detectionId: string;
  classificationCompleted: boolean;
  playbookAssigned: boolean;
  notificationsSent: boolean;
  incidentCreated: boolean;
  errors: string[];
  responseTime: number;
  message?: string;
  alreadyProcessed?: boolean;
  skipped?: boolean;
}
