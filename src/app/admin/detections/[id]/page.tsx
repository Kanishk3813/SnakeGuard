'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Image from 'next/image';
import { 
  AlertCircle, Clock, MapPin, Check, X, ChevronLeft, 
  Edit, Save, Trash2, ShieldCheck, Sparkles, AlertTriangle,
  ListChecks, Phone, Mail, Copy, Loader2
} from 'lucide-react';
import Link from 'next/link';
import { formatDate } from '@/lib/utils';
import { IncidentAssignment } from '@/types';

type DetectionStatus = 'pending' | 'reviewed' | 'captured' | 'false_alarm';

interface DetectionDetails {
  id: string;
  image_url: string;
  timestamp: string;
  updated_at: string;
  species: string | null;
  confidence: number;
  latitude: number | null;
  longitude: number | null;
  processed: boolean;
  notes: string | null;
  status: DetectionStatus;
  venomous?: boolean | null;
  risk_level?: 'low' | 'medium' | 'high' | 'critical' | null;
  classification_confidence?: number | null;
  classification_description?: string | null;
  classification_first_aid?: string | null;
  classified_at?: string | null;
}

export default function DetectionDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const [detection, setDetection] = useState<DetectionDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<DetectionStatus>('pending');
  const [species, setSpecies] = useState('');
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapInstance, setMapInstance] = useState<any>(null);
  const [classifying, setClassifying] = useState(false);
  const [classificationError, setClassificationError] = useState<string | null>(null);
  const [assignment, setAssignment] = useState<IncidentAssignment | null>(null);
  const [assignmentLoading, setAssignmentLoading] = useState(false);
  const [assigningPlaybook, setAssigningPlaybook] = useState(false);
  const [stepsUpdating, setStepsUpdating] = useState(false);
  const [firstAidCopied, setFirstAidCopied] = useState(false);
  const [playbookMessage, setPlaybookMessage] = useState<string | null>(null);

  const fetchDetectionDetails = async () => {
    try {
      if (!params?.id) {
        throw new Error("Detection ID is missing. Please check the URL.");
      }
      
      console.log("Fetching detection with ID:", params.id);
      
      const { data, error: fetchError } = await supabase
        .from('snake_detections')
        .select('*')
        .eq('id', params.id)
        .single();
  
      if (fetchError) {
        console.error("Supabase fetch error:", fetchError);
        throw fetchError;
      }
      
      if (!data) {
        throw new Error('Detection not found');
      }
  
      console.log("Fetched detection data:", data);
      setDetection(data as DetectionDetails);
      setNotes(data.notes || '');
      setStatus(data.status as DetectionStatus || 'pending');
      setSpecies(data.species || '');
    } catch (err: any) {
      console.error('Error fetching detection:', err);
      setError(err.message || 'Failed to fetch detection details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetectionDetails();
  }, [params.id]);

  const handleSave = async () => {
    try {
      setSaving(true);
      
      if (!detection?.id) {
        throw new Error("Detection ID is missing");
      }
      
      const updates = {
        notes,
        status,
        species,
        processed: true,
        updated_at: new Date().toISOString()
      };
  
      console.log("Updating detection with ID:", detection.id);
      console.log("Update payload:", updates);
  
      const { data, error: updateError } = await supabase
        .from('snake_detections')
        .update(updates)
        .eq('id', detection.id)
        .select();  
  
      if (updateError) {
        console.error("Supabase update error:", updateError);
        throw updateError;
      }
  
      console.log("Update success, updated data:", data);
      
      await fetchDetectionDetails();
      setEditMode(false);
    } catch (err: any) {
      console.error('Error updating detection:', err);
      setError(err.message || 'Failed to update detection');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      setDeleting(true);
      
      const { error: deleteError } = await supabase
        .from('snake_detections')
        .delete()
        .eq('id', detection?.id);

      if (deleteError) throw deleteError;

      router.push('/admin/detections');
    } catch (err: any) {
      console.error('Error deleting detection:', err);
      setError('Failed to delete detection');
      setDeleting(false);
    }
  };

  const handleClassify = async () => {
    if (!detection) return;
    
    try {
      setClassifying(true);
      setClassificationError(null);
      
      console.log('Starting classification for detection:', detection.id);
      console.log('Image URL:', detection.image_url);
      
      const response = await fetch('/api/classify-async', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          detectionId: detection.id
        })
      });
  
      const result = await response.json();
      
      console.log('API Response:', {
        ok: response.ok,
        status: response.status,
        result
      });
      
      if (!response.ok) {
        const errorMsg = result.message || result.error || 'Classification failed';
        console.error('Classification failed:', errorMsg);
        throw new Error(errorMsg);
      }
  
      console.log('Classification result:', result);
  
      if (result.alreadyClassified) {
        console.log('Detection was already classified, refreshing data');
        await fetchDetectionDetails();
        setClassifying(false);
        return;
      }
  
      if (result.success && result.classification) {
        console.log('Classification successful:', result.classification);
        await fetchDetectionDetails();
        setClassifying(false);
      } else {
        throw new Error('Invalid response from classification API');
      }
  
    } catch (err: any) {
      console.error('Classification error:', err);
      const errorMessage = err.message || 'Failed to classify snake';
      console.error('Error message:', errorMessage);
      setClassificationError(errorMessage);
      setClassifying(false);
    }
  };

  const loadAssignment = async (detectionId: string) => {
    try {
      setAssignmentLoading(true);
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        throw new Error('Missing admin session');
      }

      const response = await fetch(`/api/incidents?detectionId=${detectionId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Failed to load assignment');
      setAssignment(body.data || null);
    } catch (err) {
      console.error('Assignment load error:', err);
      setAssignment(null);
    } finally {
      setAssignmentLoading(false);
    }
  };

  useEffect(() => {
    if (detection?.id) {
      loadAssignment(detection.id);
    }
  }, [detection?.id]);

  const handleAttachPlaybook = async () => {
    if (!detection?.id || !detection.risk_level) {
      setPlaybookMessage('Classification risk level is required before attaching a playbook.');
      return;
    }
    try {
      setPlaybookMessage(null);
      setAssigningPlaybook(true);
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('Missing admin session');

      const response = await fetch('/api/incidents/assign', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          detectionId: detection.id,
          riskLevel: detection.risk_level,
          species: detection.species,
        }),
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.message || body.error || 'Failed to attach playbook');
      }
      await loadAssignment(detection.id);
      setPlaybookMessage('Playbook assigned successfully.');
    } catch (err: any) {
      console.error('Attach playbook error:', err);
      setPlaybookMessage(err.message || 'Unable to attach playbook');
    } finally {
      setAssigningPlaybook(false);
    }
  };

  const toggleStepCompletion = async (stepId: string, completed: boolean) => {
    if (!assignment) return;
    try {
      setStepsUpdating(true);
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('Missing admin session');

      const response = await fetch(`/api/incidents/${assignment.id}/steps`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          steps_state: [{ id: stepId, completed }],
        }),
      });
      const raw = await response.text();
      const body = raw ? JSON.parse(raw) : null;
      if (!response.ok) {
        throw new Error(body?.error || 'Failed to update step status');
      }
      setAssignment(body?.data || null);
    } catch (err: any) {
      console.error('Step update error:', err);
      setPlaybookMessage(err.message || 'Unable to update step');
    } finally {
      setStepsUpdating(false);
    }
  };

  const handleCopyFirstAid = async (text?: string | null) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setFirstAidCopied(true);
      setTimeout(() => setFirstAidCopied(false), 1500);
    } catch (err) {
      console.error('Clipboard error', err);
    }
  };

  useEffect(() => {
    if (!detection || !detection.latitude || !detection.longitude || mapLoaded) return;

    const loadMap = async () => {
      try {
        if (!document.querySelector('link[href*="leaflet.css"]')) {
          const link = document.createElement('link');
          link.rel = 'stylesheet';
          link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
          document.head.appendChild(link);
        }

        const L = (await import('leaflet')).default;
        
        const mapContainer = document.getElementById('detailMap');
        if (!mapContainer) return;
        
const map = L.map(mapContainer).setView(
  [detection.latitude!, detection.longitude!], 
  14
);

L.marker([detection.latitude!, detection.longitude!])
  .addTo(map)
  .bindPopup(`<b>${detection.species || 'Snake Detection'}</b><br>${formatDate(detection.timestamp)}`)
  .openPopup();
          
        setMapInstance(map);
        setMapLoaded(true);
      } catch (error) {
        console.error('Error loading map:', error);
      }
    };

    loadMap();

    return () => {
      if (mapInstance) {
        mapInstance.remove();
      }
    };
  }, [detection, mapLoaded]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-600"></div>
      </div>
    );
  }

  if (error || !detection) {
    return (
      <div className="bg-red-50 p-4 rounded-md">
        <div className="flex">
          <div className="flex-shrink-0">
            <AlertCircle className="h-5 w-5 text-red-400" />
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">Error</h3>
            <div className="mt-2 text-sm text-red-700">
              <p>{error || 'Detection not found'}</p>
            </div>
            <div className="mt-4">
              <Link 
                href="/admin/detections"
                className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200"
              >
                Go back to detections
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const statusColors = {
    pending: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    reviewed: 'bg-blue-100 text-blue-800 border-blue-300',
    captured: 'bg-green-100 text-green-800 border-green-300',
    false_alarm: 'bg-gray-100 text-gray-800 border-gray-300'
  };

  const statusLabels = {
    pending: 'Pending Review',
    reviewed: 'Reviewed',
    captured: 'Snake Captured',
    false_alarm: 'False Alarm'
  };

  const confidenceLevel = detection.confidence >= 0.8 
    ? 'high' 
    : detection.confidence >= 0.6 
      ? 'medium' 
      : 'low';

  const confidenceClasses = {
    high: "bg-green-100 text-green-800 border-green-300",
    medium: "bg-yellow-100 text-yellow-800 border-yellow-300",
    low: "bg-red-100 text-red-800 border-red-300"
  };

  return (
    <div>
      <div className="pb-5 border-b border-gray-200 mb-6 flex justify-between items-center">
        <div className="flex items-center">
          <Link 
            href="/admin/detections"
            className="mr-4 p-1 rounded-full hover:bg-gray-100"
          >
            <ChevronLeft className="h-5 w-5 text-gray-500" />
          </Link>
          <h1 className="text-2xl font-bold leading-tight text-gray-900">
            Detection Details
          </h1>
        </div>
        <div className="flex space-x-3">
          {!editMode ? (
            <>
              <button
                onClick={handleClassify}
                disabled={classifying}
                className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-purple-700 bg-white hover:bg-purple-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:bg-gray-100 disabled:text-gray-400"
              >
                {classifying ? (
                  <>
                    <div className="h-4 w-4 mr-1 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
                    Classifying...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-1" />
                    {detection.venomous !== null ? 'Re-classify' : 'Classify Species'}
                  </>
                )}
              </button>
              <button
                onClick={() => setEditMode(true)}
                className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              >
                <Edit className="h-4 w-4 mr-1" />
                Edit
              </button>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Delete
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setEditMode(false)}
                className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
              >
                <X className="h-4 w-4 mr-1" />
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center px-3 py-2 border border-transparent shadow-sm text-sm leading-4 font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:bg-green-300"
              >
                {saving ? (
                  <div className="h-4 w-4 mr-1 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-1" />
                )}
                Save Changes
              </button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          {/* Image */}
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <div className="p-4 bg-gray-50 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-900">Detection Image</h2>
            </div>
            <div className="p-4">
              <div className="aspect-video relative rounded-lg overflow-hidden">
                <Image
                  src={detection.image_url}
                  alt={`Snake detection ${detection.id}`}
                  fill
                  className="object-contain"
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                />
              </div>
            </div>
          </div>

          {/* Map */}
          {detection.latitude && detection.longitude && (
            <div className="bg-white shadow rounded-lg overflow-hidden">
              <div className="p-4 bg-gray-50 border-b border-gray-200">
                <h2 className="text-lg font-medium text-gray-900">Location</h2>
              </div>
              <div className="p-4">
                <div className="mb-3 flex items-center text-gray-600 text-sm">
                  <MapPin className="h-4 w-4 mr-2 text-gray-500" />
                  <span>{`${detection.latitude?.toFixed(6) || 'N/A'}, ${detection.longitude?.toFixed(6) || 'N/A'}`}</span>
                </div>
                <div className="aspect-video relative rounded-lg overflow-hidden border border-gray-200">
                  <div id="detailMap" className="h-full w-full"></div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          {/* Details */}
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <div className="p-4 bg-gray-50 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-900">Detection Details</h2>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-1 gap-4">
                {/* Species */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Species
                  </label>
                  {editMode ? (
                    <input
                      type="text"
                      value={species}
                      onChange={(e) => setSpecies(e.target.value)}
                      className="shadow-sm focus:ring-green-500 focus:border-green-500 block w-full sm:text-sm border-gray-300 rounded-md"
                      placeholder="Enter snake species"
                    />
                  ) : (
                    <div className="text-sm text-gray-900 bg-gray-50 rounded-md px-3 py-2 border border-gray-200">
                      {detection.species || 'Unknown Species'}
                    </div>
                  )}
                </div>

                {/* Confidence */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Confidence Level
                  </label>
                  <div className={`text-sm rounded-md px-3 py-2 inline-flex items-center ${confidenceClasses[confidenceLevel]} border`}>
                    <AlertCircle className="h-4 w-4 mr-2" />
                    {(detection.confidence * 100).toFixed(1)}% confidence
                  </div>
                </div>

                {/* Status */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Status
                  </label>
                  {editMode ? (
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as DetectionStatus)}
                      className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm rounded-md"
                    >
                      <option value="pending">Pending Review</option>
                      <option value="reviewed">Reviewed</option>
                      <option value="captured">Snake Captured</option>
                      <option value="false_alarm">False Alarm</option>
                    </select>
                  ) : (
                    <div className={`text-sm rounded-md px-3 py-2 inline-flex items-center ${statusColors[detection.status || 'pending']} border`}>
                      {status === 'captured' ? (
                        <ShieldCheck className="h-4 w-4 mr-2" />
                      ) : (
                        <AlertCircle className="h-4 w-4 mr-2" />
                      )}
                      {statusLabels[detection.status || 'pending']}
                    </div>
                  )}
                </div>

                {/* Timestamp */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Detected At
                  </label>
                  <div className="text-sm text-gray-900 bg-gray-50 rounded-md px-3 py-2 border border-gray-200 flex items-center">
                    <Clock className="h-4 w-4 mr-2 text-gray-500" />
                    {formatDate(detection.timestamp)}
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notes
                  </label>
                  {editMode ? (
                    <textarea
                      rows={4}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="shadow-sm focus:ring-green-500 focus:border-green-500 block w-full sm:text-sm border-gray-300 rounded-md"
                      placeholder="Add notes about this detection"
                    />
                  ) : (
                    <div className="text-sm text-gray-900 bg-gray-50 rounded-md px-3 py-2 border border-gray-200 min-h-[100px]">
                      {detection.notes || (
                        <span className="text-gray-400 italic">No notes available</span>
                      )}
                    </div>
                  )}
                </div>

                {!editMode && detection.status !== 'captured' && (
                  <button
                    onClick={() => {
                      setStatus('captured');
                      setEditMode(true);
                    }}
                    className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                  >
                    <ShieldCheck className="h-4 w-4 mr-2" />
                    Mark as Captured
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* AI Classification */}
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <div className="p-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-medium text-gray-900 flex items-center">
                <Sparkles className="h-5 w-5 mr-2 text-purple-600" />
                Classification
              </h2>
              {detection.classified_at && (
                <span className="text-xs text-gray-500">
                  Classified {formatDate(detection.classified_at)}
                </span>
              )}
            </div>
            <div className="p-4">
              {classificationError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-sm text-red-800">{classificationError}</p>
                </div>
              )}
              
              {detection.venomous !== null && detection.venomous !== undefined ? (
                <div className="space-y-4">
                  {/* Species */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Identified Species
                    </label>
                    <div className="text-sm font-semibold text-gray-900 bg-gray-50 rounded-md px-3 py-2 border border-gray-200">
                      {detection.species || 'Unknown'}
                    </div>
                  </div>

                  {/* Venomous Status */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Venomous Status
                    </label>
                    <div className={`text-sm rounded-md px-3 py-2 inline-flex items-center font-medium ${
                      detection.venomous 
                        ? 'bg-red-100 text-red-800 border-red-300' 
                        : 'bg-green-100 text-green-800 border-green-300'
                    } border`}>
                      {detection.venomous ? (
                        <>
                          <AlertTriangle className="h-4 w-4 mr-2" />
                          Venomous - High Risk
                        </>
                      ) : (
                        <>
                          <Check className="h-4 w-4 mr-2" />
                          Non-venomous - Low Risk
                        </>
                      )}
                    </div>
                  </div>

                  {/* Risk Level */}
                  {detection.risk_level && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Risk Level
                      </label>
                      <div className={`text-sm rounded-md px-3 py-2 inline-flex items-center font-medium ${
                        detection.risk_level === 'critical' ? 'bg-red-200 text-red-900 border-red-400' :
                        detection.risk_level === 'high' ? 'bg-orange-100 text-orange-800 border-orange-300' :
                        detection.risk_level === 'medium' ? 'bg-yellow-100 text-yellow-800 border-yellow-300' :
                        'bg-green-100 text-green-800 border-green-300'
                      } border`}>
                        {detection.risk_level.toUpperCase()}
                      </div>
                    </div>
                  )}

                  {/* Classification Confidence */}
                  {detection.classification_confidence !== null && detection.classification_confidence !== undefined && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Classification Confidence
                      </label>
                      <div className="text-sm text-gray-900 bg-gray-50 rounded-md px-3 py-2 border border-gray-200">
                        {(detection.classification_confidence * 100).toFixed(1)}%
                      </div>
                    </div>
                  )}

                  {/* Description */}
                  {detection.classification_description && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Description
                      </label>
                      <div className="text-sm text-gray-700 bg-gray-50 rounded-md px-3 py-2 border border-gray-200">
                        {detection.classification_description}
                      </div>
                    </div>
                  )}

                  {/* First Aid */}
                  {detection.venomous && detection.classification_first_aid && (
                    <div>
                      <label className="block text-sm font-medium text-red-700 mb-1">
                        ⚠️ First Aid Guidance
                      </label>
                      <div className="text-sm text-red-800 bg-red-50 rounded-md px-3 py-2 border border-red-200">
                        {detection.classification_first_aid}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Sparkles className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-sm text-gray-500 mb-4">
                    This detection hasn't been classified yet.
                  </p>
                  <button
                    onClick={handleClassify}
                    disabled={classifying}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:bg-gray-400"
                  >
                    {classifying ? (
                      <>
                        <div className="h-4 w-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Classifying...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 mr-2" />
                        Classify Species
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Incident Playbook */}
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <div className="p-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-medium text-gray-900 flex items-center">
                <ListChecks className="h-5 w-5 mr-2 text-green-600" />
                Incident Playbook
              </h2>
              {assignment && (
                <span
                  className={`px-3 py-1 text-xs font-semibold rounded-full ${
                    assignment.status === 'completed'
                      ? 'bg-green-100 text-green-800'
                      : assignment.status === 'cancelled'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-blue-100 text-blue-700'
                  }`}
                >
                  {assignment.status.toUpperCase()}
                </span>
              )}
            </div>
            <div className="p-4 space-y-4">
              {playbookMessage && (
                <div className="text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-md px-3 py-2">
                  {playbookMessage}
                </div>
              )}

              {assignmentLoading ? (
                <div className="flex items-center justify-center py-8 text-gray-500">
                  <Loader2 className="h-5 w-5 animate-spin text-green-600" />
                </div>
              ) : assignment ? (
                <>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">
                        {assignment.playbook?.title || 'Playbook'}
                      </p>
                      <p className="text-xs text-gray-500">
                        {assignment.playbook?.species
                          ? `${assignment.playbook.species} • ${assignment.playbook.risk_level}`
                          : assignment.playbook?.risk_level || 'General'}
                      </p>
                    </div>
                    <span className="text-xs text-gray-500">
                      {(assignment.steps_state || []).filter(step => step.completed).length}/
                      {(assignment.steps_state || []).length} steps
                    </span>
                  </div>

                  <div className="space-y-2">
                    {(assignment.steps_state || []).map(step => (
                      <div
                        key={step.id}
                        className={`border rounded-md px-3 py-2 flex items-start justify-between ${
                          step.completed ? 'bg-green-50 border-green-200' : 'bg-white'
                        }`}
                      >
                        <div>
                          <p className="text-sm font-medium text-gray-900">{step.title}</p>
                          {step.note && (
                            <p className="text-xs text-gray-500 mt-1">Note: {step.note}</p>
                          )}
                          {step.completed_at && (
                            <p className="text-xs text-gray-400 mt-1">
                              Completed {formatDate(step.completed_at)}
                            </p>
                          )}
                        </div>
                        <button
                          disabled={stepsUpdating}
                          onClick={() => toggleStepCompletion(step.id, !step.completed)}
                          className={`ml-3 inline-flex items-center justify-center h-8 w-8 rounded-full border ${
                            step.completed
                              ? 'bg-green-600 text-white border-green-600'
                              : 'border-gray-300 text-gray-400 hover:border-green-500 hover:text-green-500'
                          } ${stepsUpdating ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          {step.completed ? <Check className="h-4 w-4" /> : null}
                        </button>
                      </div>
                    ))}
                  </div>

                  {assignment.playbook?.contacts?.length ? (
                    <div>
                      <h4 className="text-sm font-semibold text-gray-900 flex items-center mb-2">
                        <Phone className="h-4 w-4 mr-2 text-blue-600" />
                        Contact Tree
                      </h4>
                      <div className="space-y-2">
                        {assignment.playbook.contacts.map(contact => (
                          <div
                            key={contact.id}
                            className="border rounded-md px-3 py-2 text-sm flex flex-col sm:flex-row sm:items-center sm:justify-between"
                          >
                            <div>
                              <p className="font-medium text-gray-900">{contact.name}</p>
                              <p className="text-xs text-gray-500">{contact.role}</p>
                            </div>
                            <div className="flex items-center space-x-3 text-xs text-gray-600 mt-2 sm:mt-0">
                              {contact.phone && (
                                <a
                                  href={`tel:${contact.phone}`}
                                  className="inline-flex items-center hover:text-green-600"
                                >
                                  <Phone className="h-3 w-3 mr-1" />
                                  Call
                                </a>
                              )}
                              {contact.email && (
                                <a
                                  href={`mailto:${contact.email}`}
                                  className="inline-flex items-center hover:text-blue-600"
                                >
                                  <Mail className="h-3 w-3 mr-1" />
                                  Email
                                </a>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {assignment.playbook?.first_aid && (
                    <div className="border border-red-200 bg-red-50 rounded-md p-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-red-800 flex items-center">
                          <AlertTriangle className="h-4 w-4 mr-2" />
                          First Aid Guidance
                        </p>
                        <button
                          onClick={() => handleCopyFirstAid(assignment.playbook?.first_aid)}
                          className="text-xs text-red-600 hover:text-red-800 inline-flex items-center"
                        >
                          <Copy className="h-3 w-3 mr-1" />
                          {firstAidCopied ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                      <div className="text-sm text-red-800 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                        {assignment.playbook.first_aid}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-6 text-sm text-gray-500 space-y-3">
                  <p>No playbook is attached to this detection yet.</p>
                  <button
                    onClick={handleAttachPlaybook}
                    disabled={!detection.risk_level || assigningPlaybook}
                    className="inline-flex items-center px-4 py-2 rounded-md text-white bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    {assigningPlaybook ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Linking...
                      </>
                    ) : (
                      <>
                        <ListChecks className="h-4 w-4 mr-2" />
                        Attach Playbook
                      </>
                    )}
                  </button>
                  {!detection.risk_level && (
                    <p className="text-xs text-red-500">
                      Classification risk level required before attaching a playbook.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center">
            <div className="fixed inset-0 transition-opacity" onClick={() => setShowDeleteConfirm(false)}>
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>

            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
                    <AlertCircle className="h-6 w-6 text-red-600" />
                  </div>
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                    <h3 className="text-lg leading-6 font-medium text-gray-900">
                      Delete Detection
                    </h3>
                    <div className="mt-2">
                      <p className="text-sm text-gray-500">
                        Are you sure you want to delete this detection? This action cannot be undone.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:ml-3 sm:w-auto sm:text-sm"
                  onClick={handleDelete}
                  disabled={deleting}
                >
                  {deleting && (
                    <div className="h-4 w-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  )}
                  Delete
                </button>
                <button
                  type="button"
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                  onClick={() => setShowDeleteConfirm(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}