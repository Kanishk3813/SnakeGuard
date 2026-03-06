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

export interface AssignmentRequest {
  id: string;
  detection_id: string;
  responder_id: string;
  distance_km: number;
  priority: number;
  status: 'pending' | 'accepted' | 'rejected' | 'expired' | 'cancelled';
  requested_at: string;
  responded_at?: string;
  expires_at: string;
  detection?: SnakeDetection;
}

export interface ResponderAssignment {
  id: string;
  detection_id: string;
  responder_id: string;
  assigned_at: string;
  status: 'assigned' | 'in_progress' | 'completed' | 'cancelled';
  notes?: string | null;
  arrived_at?: string | null;
  completed_at?: string | null;
  created_at: string;
  updated_at: string;
  detection?: SnakeDetection;
}

export interface ResponderStats {
  activeJobs: number;
  completedJobs: number;
  pendingRequests: number;
  avgResponseTime: string;
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
