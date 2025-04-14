export interface SnakeDetection {
    id: string;
    timestamp: string;
    confidence: number;
    image_url: string;
    latitude: number;
    longitude: number;
    processed: boolean;
    species?: string;
    notes?: string;
    created_at: string;
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
  