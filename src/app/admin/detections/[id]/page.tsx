'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Image from 'next/image';
import { 
  AlertCircle, Clock, MapPin, Check, X, ChevronLeft, 
  Edit, Save, Trash2, FileText, ShieldCheck
} from 'lucide-react';
import Link from 'next/link';
import { formatDate, getConfidenceColor } from '@/lib/utils';

type DetectionStatus = 'pending' | 'reviewed' | 'captured' | 'false_alarm';

interface DetectionDetails {
  id: string;
  image_url: string;
  timestamp: string;
  created_at: string;
  species: string | null;
  confidence: number;
  latitude: number | null;
  longitude: number | null;
  processed: boolean;
  notes: string | null;
  status: DetectionStatus;
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

                {/* Created At */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Record Created
                  </label>
                  <div className="text-sm text-gray-900 bg-gray-50 rounded-md px-3 py-2 border border-gray-200 flex items-center">
                    <Clock className="h-4 w-4 mr-2 text-gray-500" />
                    {formatDate(detection.created_at)}
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