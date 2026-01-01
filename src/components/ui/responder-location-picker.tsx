'use client';

import { useState, useEffect } from 'react';
import { MapPin, Loader2, CheckCircle, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface ResponderLocationPickerProps {
  onLocationSaved?: (location: { lat: number; lng: number }) => void;
}

export default function ResponderLocationPicker({ onLocationSaved }: ResponderLocationPickerProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [savedLocation, setSavedLocation] = useState<{ lat: number; lng: number; updated_at: string } | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    loadSavedLocation();
  }, []);

  const loadSavedLocation = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const headers: HeadersInit = {};
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const response = await fetch('/api/responders/location', { headers });
      const data = await response.json();

      if (data.success && data.location && data.location.lat && data.location.lng) {
        setSavedLocation(data.location);
      }
    } catch (error) {
      console.error('Error loading saved location:', error);
    }
  };

  const requestLocationPermission = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser');
      return;
    }

    setIsLoading(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setIsLoading(false);
        setHasPermission(true);
        
        const location = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        
        setCurrentLocation(location);
      },
      (error) => {
        setIsLoading(false);
        console.error('Error getting location:', error);
        
        let message = 'Unable to access your location.';
        if (error.code === 1) {
          message = 'Location permission denied. Please enable location access.';
        } else if (error.code === 2) {
          message = 'Your location is currently unavailable.';
        }
        
        alert(message);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  };

  const saveLocation = async () => {
    if (!currentLocation) return;

    try {
      setIsSaving(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        alert('Please log in to save your location');
        return;
      }

      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const response = await fetch('/api/responders/location', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          latitude: currentLocation.lat,
          longitude: currentLocation.lng
        })
      });

      const data = await response.json();

      if (data.success) {
        setSavedLocation(data.location);
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);
        onLocationSaved?.(data.location);
      } else {
        alert(data.error || 'Failed to save location');
      }
    } catch (error: any) {
      console.error('Error saving location:', error);
      alert('Error saving location: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <MapPin className="h-5 w-5 text-green-600" />
            Responder Location
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            Set your location to receive automatic assignment requests for nearby snake detections
          </p>
        </div>
        {showSuccess && (
          <div className="flex items-center gap-2 text-green-600 text-sm">
            <CheckCircle className="h-5 w-5" />
            <span>Location saved!</span>
          </div>
        )}
      </div>

      {savedLocation && savedLocation.lat && savedLocation.lng && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-900">Location Saved</p>
              <p className="text-xs text-green-700 mt-1">
                {savedLocation.lat.toFixed(6)}, {savedLocation.lng.toFixed(6)}
              </p>
              {savedLocation.updated_at && (
                <p className="text-xs text-green-600 mt-1">
                  Updated {new Date(savedLocation.updated_at).toLocaleString()}
                </p>
              )}
            </div>
            <button
              onClick={() => setSavedLocation(null)}
              className="text-green-600 hover:text-green-800"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {!currentLocation ? (
          <button
            onClick={requestLocationPermission}
            disabled={isLoading}
            className="w-full flex items-center justify-center px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 transition-colors font-medium"
          >
            {isLoading ? (
              <>
                <Loader2 className="animate-spin h-5 w-5 mr-2" />
                Getting location...
              </>
            ) : (
              <>
                <MapPin className="h-5 w-5 mr-2" />
                Get My Current Location
              </>
            )}
          </button>
        ) : (
          <div className="space-y-3">
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm font-medium text-blue-900 mb-1">Current Location</p>
              <p className="text-xs text-blue-700 font-mono">
                {currentLocation.lat.toFixed(6)}, {currentLocation.lng.toFixed(6)}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={saveLocation}
                disabled={isSaving}
                className="flex-1 flex items-center justify-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 transition-colors font-medium"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="animate-spin h-4 w-4 mr-2" />
                    Saving...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Save Location
                  </>
                )}
              </button>
              <button
                onClick={() => {
                  setCurrentLocation(null);
                  setHasPermission(false);
                }}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

