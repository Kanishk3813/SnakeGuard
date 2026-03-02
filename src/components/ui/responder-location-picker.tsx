'use client';

import { useState, useEffect } from 'react';
import { MapPin, Loader2, CheckCircle, Navigation } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface ResponderLocationPickerProps {
  onLocationSaved?: (location: { lat: number; lng: number }) => void;
}

export default function ResponderLocationPicker({ onLocationSaved }: ResponderLocationPickerProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
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
        setCurrentLocation(null);
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

  // Compact inline bar when location is already saved
  if (savedLocation && savedLocation.lat && savedLocation.lng && !currentLocation) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
            <MapPin className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">Your Location</span>
            <span className="text-xs text-gray-400 font-mono">
              {savedLocation.lat.toFixed(4)}, {savedLocation.lng.toFixed(4)}
            </span>
            {savedLocation.updated_at && (
              <span className="text-xs text-gray-400 hidden md:inline">
                · Updated {new Date(savedLocation.updated_at).toLocaleDateString()}
              </span>
            )}
          </div>
          {showSuccess && (
            <div className="flex items-center gap-1 text-emerald-600">
              <CheckCircle className="h-3.5 w-3.5" />
              <span className="text-xs font-medium">Saved</span>
            </div>
          )}
        </div>
        <button
          onClick={requestLocationPermission}
          disabled={isLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-all duration-200"
        >
          {isLoading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Navigation className="h-3.5 w-3.5" />
          )}
          Update
        </button>
      </div>
    );
  }

  // Compact state when user has fetched location but not saved yet
  if (currentLocation) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
            <Navigation className="h-4 w-4 text-blue-600" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">New Location</span>
            <span className="text-xs text-blue-600 font-mono">
              {currentLocation.lat.toFixed(6)}, {currentLocation.lng.toFixed(6)}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentLocation(null)}
            className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-all duration-200"
          >
            Cancel
          </button>
          <button
            onClick={saveLocation}
            disabled={isSaving}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-all duration-200 disabled:bg-gray-300"
          >
            {isSaving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <CheckCircle className="h-3.5 w-3.5" />
            )}
            Save Location
          </button>
        </div>
      </div>
    );
  }

  // No location set yet — still compact but with a CTA
  return (
    <div className="bg-white rounded-2xl border border-gray-100 px-4 py-3 flex items-center justify-between shadow-sm">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
          <MapPin className="h-4 w-4 text-gray-400" />
        </div>
        <div>
          <span className="text-sm font-medium text-gray-700">Set your location</span>
          <span className="text-xs text-gray-400 ml-2 hidden md:inline">to receive nearby assignment requests</span>
        </div>
      </div>
      <button
        onClick={requestLocationPermission}
        disabled={isLoading}
        className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-all duration-200 disabled:bg-gray-300"
      >
        {isLoading ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Locating...
          </>
        ) : (
          <>
            <Navigation className="h-3.5 w-3.5" />
            Get Location
          </>
        )}
      </button>
    </div>
  );
}
