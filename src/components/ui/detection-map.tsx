'use client';

import { useEffect, useRef, useState } from 'react';
import { SnakeDetection } from '@/types';

interface DetectionMapProps {
  detections: SnakeDetection[];
  height?: string;
  selectedDetectionId?: string;
}

export default function DetectionMap({ 
  detections, 
  height = "500px", 
  selectedDetectionId 
}: DetectionMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const popupsRef = useRef<any[]>([]);
  
  // Load Leaflet dynamically on client side
  useEffect(() => {
    let isMounted = true;
    
    const loadLeaflet = async () => {
      try {
        // Only import if we're in the browser
        if (typeof window !== 'undefined') {
          // Load CSS
          if (!document.querySelector('link[href*="leaflet.css"]')) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
            link.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
            link.crossOrigin = '';
            document.head.appendChild(link);
          }
          
          const L = (await import('leaflet')).default;
          
          if (!isMounted || !mapContainerRef.current) return;
          
          initMap(L);
          setMapLoaded(true);
        }
      } catch (error) {
        console.error('Error loading Leaflet:', error);
      }
    };
    
    const initMap = (L: any) => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markersRef.current = [];
        popupsRef.current = [];
      }
  
      mapInstanceRef.current = L.map(mapContainerRef.current, {
        center: [0, 0],
        zoom: 2,
        scrollWheelZoom: true,
        zoomControl: true,
      });
      
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(mapInstanceRef.current);
      
      addMarkers(L);
    };
    
    const addMarkers = (L: any) => {
      if (!mapInstanceRef.current) return;
      
      markersRef.current.forEach(marker => {
        if (marker) marker.remove();
      });
      markersRef.current = [];
      
      popupsRef.current.forEach(popup => {
        if (popup) popup.remove();
      });
      popupsRef.current = [];
      
      const validDetections = detections.filter(d => 
        typeof d.latitude === 'number' && 
        typeof d.longitude === 'number' &&
        !isNaN(d.latitude) && 
        !isNaN(d.longitude)
      );
      
      if (validDetections.length === 0) return;
      
      const bounds = L.latLngBounds(
        validDetections.map(d => [d.latitude, d.longitude])
      );
      
      validDetections.forEach((detection) => {
        const icon = L.divIcon({
          className: 'custom-map-marker',
          html: `<div class="${
            detection.id === selectedDetectionId
              ? 'bg-red-500 border-red-700'
              : detection.confidence > 0.8
                ? 'bg-green-500 border-green-700'
                : detection.confidence > 0.6
                  ? 'bg-yellow-500 border-yellow-700'
                  : 'bg-red-500 border-red-700'
          } flex items-center justify-center w-6 h-6 rounded-full border-2 text-white transform transition-transform hover:scale-110 shadow-md">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
            </svg>
          </div>`,
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        });
        
        const marker = L.marker([detection.latitude, detection.longitude], { icon });
        
        const popupContent = document.createElement('div');
        popupContent.className = 'snake-detection-popup';
        popupContent.innerHTML = `
          <div class="w-56 p-2">
            <div class="relative w-full h-24 mb-2 overflow-hidden rounded">
              <img 
                src="${detection.image_url || '/placeholder-snake.jpg'}" 
                alt="Snake detection" 
                class="absolute top-0 left-0 w-full h-full object-cover"
              />
              <div class="absolute top-1 right-1 bg-black bg-opacity-70 text-white px-1.5 py-0.5 rounded text-xs">
                ${(detection.confidence * 100).toFixed(0)}%
              </div>
            </div>
            <h3 class="font-bold text-sm mb-1">${detection.species || 'Unknown Species'}</h3>
            <p class="text-xs text-gray-600 mb-1">${new Date(detection.timestamp).toLocaleString()}</p>
            ${detection.notes ? `<p class="text-xs italic mt-1">${detection.notes}</p>` : ''}
            <button class="mt-2 px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium hover:bg-blue-200 w-full text-center">
              View Details
            </button>
          </div>
        `;
        
        const viewButton = popupContent.querySelector('button');
        if (viewButton) {
          viewButton.addEventListener('click', () => {
            console.log(`View details for detection ${detection.id}`);
          });
        }
        
        const popup = L.popup({
          closeButton: true,
          autoClose: true,
          className: 'snake-detection-popup',
        }).setContent(popupContent);
        
        popupsRef.current.push(popup);
        
        marker.addTo(mapInstanceRef.current).bindPopup(popup);
        
        if (detection.id === selectedDetectionId) {
          marker.openPopup();
        }
        
        markersRef.current.push(marker);
      });
      
      mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50] });
      
      if (mapInstanceRef.current.getZoom() > 15) {
        mapInstanceRef.current.setZoom(15);
      }
    };
    
    loadLeaflet();
    
    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.remove();
          mapInstanceRef.current = null;
        } catch (e) {
          console.error('Error cleaning up map:', e);
        }
      }
    };
  }, [detections, selectedDetectionId]);
  
  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div 
        ref={mapContainerRef} 
        style={{ height, width: '100%' }} 
        className="bg-gray-100"
      >
        {!mapLoaded && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center p-6">
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                className="h-12 w-12 text-gray-400 mx-auto mb-4" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
              <h3 className="text-lg font-medium text-gray-700">Map Loading...</h3>
              <p className="text-gray-500 mt-2">
                Displaying {detections.length} snake detection{detections.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}