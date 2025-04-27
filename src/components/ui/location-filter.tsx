import { useState, useEffect } from 'react';
import { MapPin, Loader } from 'lucide-react';
import { useCallback } from 'react';

interface LocationFilterProps {
  onRadiusChange: (radius: number) => void;
  onLocationPermission: (granted: boolean, coords?: { lat: number, lng: number }) => void;
  defaultRadius?: number;
}

export default function LocationFilter({ 
  onRadiusChange, 
  onLocationPermission,
  defaultRadius = 50 
}: LocationFilterProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number, lng: number } | null>(null);
  const [selectedRadius, setSelectedRadius] = useState<number>(defaultRadius);
  
  const radiusOptions = [
    { label: '10 km', value: 10 },
    { label: '25 km', value: 25 },
    { label: '50 km', value: 50 },
    { label: '100 km', value: 100 },
    { label: '250 km', value: 250 },
    { label: 'Any', value: 0 }
  ];

  useEffect(() => {
    if (navigator.geolocation && localStorage.getItem('locationPermissionGranted') === 'true') {
      setHasPermission(true);
      const cachedLocation = localStorage.getItem('userLocation');
      if (cachedLocation) {
        try {
          const location = JSON.parse(cachedLocation);
          setCurrentLocation(location);
          onLocationPermission(true, location);
        } catch (error) {
          console.error('Error parsing cached location:', error);
        }
      }
    }
  }, [onLocationPermission]);

  useEffect(() => {
    if (hasPermission && currentLocation) {
      onRadiusChange(selectedRadius);
    }
  }, [hasPermission, currentLocation, selectedRadius, onRadiusChange]); 

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
        
        localStorage.setItem('locationPermissionGranted', 'true');
        localStorage.setItem('userLocation', JSON.stringify(location));
        
        onLocationPermission(true, location);
        
      },
      (error) => {
        setIsLoading(false);
        console.error('Error getting location:', error);
        
        let message = 'Unable to access your location.';
        if (error.code === 1) {
          message = 'Location permission denied. Please enable location access to see nearby snake detections.';
        } else if (error.code === 2) {
          message = 'Your location is currently unavailable. Please try again later.';
        }
        
        alert(message);
        onLocationPermission(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000
      }
    );
  };

  const handleRadiusChange = (radius: number) => {
    if (radius !== selectedRadius) {
      setSelectedRadius(radius);
      onRadiusChange(radius);
    }
  };

  const resetLocationPermission = () => {
    setHasPermission(false);
    setCurrentLocation(null);
    localStorage.removeItem('locationPermissionGranted');
    localStorage.removeItem('userLocation');
    onLocationPermission(false);
  };

  return (
    <div className="flex flex-wrap items-center gap-2 mb-4">
      {!hasPermission ? (
        <button
          onClick={requestLocationPermission}
          disabled={isLoading}
          className="flex items-center px-3 py-1.5 text-sm bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-all"
        >
          {isLoading ? (
            <>
              <Loader className="animate-spin h-3.5 w-3.5 mr-1.5" />
              <span>Loading...</span>
            </>
          ) : (
            <>
              <MapPin className="h-3.5 w-3.5 mr-1.5 text-green-600" />
              <span>Use my location</span>
            </>
          )}
        </button>
      ) : (
        <>
          <div className="flex items-center text-xs bg-green-50 text-green-700 px-2 py-1 rounded-full">
            <MapPin className="h-3 w-3 mr-1" />
            <span>Location active</span>
          </div>
          
          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-500">Radius:</span>
            <div className="flex">
              {radiusOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => handleRadiusChange(option.value)}
                  className={`px-2 py-1 text-xs border-y border-r first:border-l first:rounded-l-md last:rounded-r-md ${
                    selectedRadius === option.value
                      ? 'bg-green-600 text-white border-green-600'
                      : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          
          <button
            onClick={resetLocationPermission}
            className="text-xs text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </>
      )}
    </div>
  );
}