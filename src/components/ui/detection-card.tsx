import Image from 'next/image';
import { SnakeDetection } from '@/types';
import { formatDate, getTimeAgo, getConfidenceColor } from '@/lib/utils';
import { useState, useEffect, useRef } from 'react';
import { MapPin, Clock, AlertCircle, Check, Map, FileText, ChevronDown, ChevronUp, AlertTriangle, X } from 'lucide-react';

interface DetectionCardProps {
  detection: SnakeDetection;
  onMarkReviewed?: (id: string) => void;
}

export default function DetectionCard({ 
  detection, 
  onMarkReviewed
}: DetectionCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  
  const confidenceLevel = detection.confidence >= 0.9 ? 'high' : 
                          detection.confidence >= 0.7 ? 'medium' : 'low';
  
  const confidenceClasses = {
    high: "bg-green-100 text-green-800 border-green-300",
    medium: "bg-yellow-100 text-yellow-800 border-yellow-300",
    low: "bg-red-100 text-red-800 border-red-300"
  };
  
  const confidenceIcons = {
    high: <Check className="h-4 w-4" />,
    medium: <AlertTriangle className="h-4 w-4" />,
    low: <AlertCircle className="h-4 w-4" />
  };

  const handleMarkReviewed = () => {
    if (onMarkReviewed) {
      onMarkReviewed(detection.id);
    }
  };

  const handleViewMap = () => {
    if (hasCoordinates) {
      setShowMap(true);
    }
  };

  const hasCoordinates = detection.latitude !== null && detection.longitude !== null;

  useEffect(() => {
    if (!showMap || !hasCoordinates || !mapContainerRef.current) return;

    const loadLeaflet = async () => {
      try {
        if (!document.querySelector('link[href*="leaflet.css"]')) {
          const link = document.createElement('link');
          link.rel = 'stylesheet';
          link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
          link.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
          link.crossOrigin = '';
          document.head.appendChild(link);
        }
        
        const L = (await import('leaflet')).default;
        
        if (mapInstanceRef.current) {
          mapInstanceRef.current.remove();
        }
        
        if (mapContainerRef.current) {
          mapInstanceRef.current = L.map(mapContainerRef.current).setView(
            [detection.latitude!, detection.longitude!], 14
          );
        }
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          maxZoom: 19,
        }).addTo(mapInstanceRef.current);
        
        markerRef.current = L.marker([detection.latitude!, detection.longitude!])
          .addTo(mapInstanceRef.current)
          .bindPopup(`
            <div class="p-2 text-center">
              <strong>${detection.species || 'Snake Detection'}</strong><br>
              <small>${formatDate(detection.timestamp)}</small><br>
              <small>Confidence: ${(detection.confidence * 100).toFixed(1)}%</small>
            </div>
          `)
          .openPopup();
        
      } catch (error) {
        console.error('Error loading map:', error);
      }
    };
    
    loadLeaflet();
    
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      if (markerRef.current) {
        markerRef.current = null;
      }
    };
  }, [showMap, detection.latitude, detection.longitude, detection.species, detection.timestamp, detection.confidence, hasCoordinates]);

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden transition-all duration-300 hover:shadow-xl border border-gray-200">
      <div className="relative">
        <div className="aspect-video relative overflow-hidden group">
          <Image
            src={detection.image_url}
            alt={`Snake detected at ${formatDate(detection.timestamp)}`}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
          <div className="absolute top-2 left-2 flex items-center space-x-1 bg-black bg-opacity-70 text-white px-2 py-1 rounded-full text-xs backdrop-blur-sm">
            <Clock className="h-3 w-3" />
            <span>{getTimeAgo(detection.timestamp)}</span>
          </div>
          
          <div className={`absolute top-2 right-2 flex items-center space-x-1 ${confidenceClasses[confidenceLevel]} px-2 py-1 rounded-full text-xs font-medium border`}>
            {confidenceIcons[confidenceLevel]}
            <span>{(detection.confidence * 100).toFixed(0)}%</span>
          </div>
          
          {detection.processed === false && (
            <div className="absolute bottom-2 left-2 bg-blue-600 text-white px-2 py-1 rounded text-xs font-medium">
              New
            </div>
          )}
        </div>
      </div>
      
      <div className="p-4">
        <div className="flex justify-between items-start mb-2">
          <div>
            <h3 className="font-semibold text-gray-900 text-lg">
              {detection.species || 'Unknown Species'}
            </h3>
            <div className="flex items-center text-gray-500 text-sm mt-1">
              <Clock className="h-3 w-3 mr-1" />
              <span>{formatDate(detection.timestamp)}</span>
            </div>
          </div>
        </div>

        {hasCoordinates && (
          <div className="flex items-center text-gray-600 text-sm mt-2">
            <MapPin className="h-3 w-3 text-gray-400 mr-1" />
            <span className="truncate">
              {`${detection.latitude.toFixed(6)}, ${detection.longitude.toFixed(6)}`}
            </span>
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <button 
            onClick={handleMarkReviewed}
            className="flex items-center px-3 py-1.5 bg-green-50 text-green-700 rounded-md text-xs font-medium hover:bg-green-100 transition-colors"
          >
            <Check className="h-3 w-3 mr-1" />
            Mark as Reviewed
          </button>
          
          {hasCoordinates && (
            <button 
              onClick={handleViewMap}
              className="flex items-center px-3 py-1.5 bg-blue-50 text-blue-700 rounded-md text-xs font-medium hover:bg-blue-100 transition-colors"
            >
              <Map className="h-3 w-3 mr-1" />
              View on Map
            </button>
          )}

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center ml-auto px-3 py-1.5 text-gray-600 rounded-md text-xs font-medium hover:bg-gray-100 transition-colors"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="h-3 w-3 mr-1" />
                Less Details
              </>
            ) : (
              <>
                <ChevronDown className="h-3 w-3 mr-1" />
                More Details
              </>
            )}
          </button>
        </div>

        {isExpanded && (
          <div className="mt-4 pt-4 border-t border-gray-100 space-y-3 text-sm">
            {detection.notes ? (
              <div className="flex items-start">
                <FileText className="h-4 w-4 text-gray-400 mr-2 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="font-medium text-gray-700 mb-1">Notes</div>
                  <p className="text-gray-600">{detection.notes}</p>
                </div>
              </div>
            ) : (
              <div className="flex items-start">
                <FileText className="h-4 w-4 text-gray-400 mr-2 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="font-medium text-gray-700 mb-1">Notes</div>
                  <p className="text-gray-400 italic">No notes available</p>
                </div>
              </div>
            )}
            
            <div className="flex items-start">
              <Clock className="h-4 w-4 text-gray-400 mr-2 mt-0.5 flex-shrink-0" />
              <div>
                <div className="font-medium text-gray-700 mb-1">Created</div>
                <p className="text-gray-600">{formatDate(detection.created_at)}</p>
              </div>
            </div>
            
            <div className="flex items-start">
              <AlertCircle className="h-4 w-4 text-gray-400 mr-2 mt-0.5 flex-shrink-0" />
              <div>
                <div className="font-medium text-gray-700 mb-1">Status</div>
                <div className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${detection.processed ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                  {detection.processed ? 'Processed' : 'Pending Review'}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Map Popup */}
      {showMap && hasCoordinates && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-4xl max-h-full flex flex-col overflow-hidden">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-semibold text-lg">
                Snake Detection Location
              </h3>
              <button 
                onClick={() => setShowMap(false)}
                className="text-gray-500 hover:text-gray-700 p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 min-h-0 p-1 bg-gray-100">
              <div className="h-full w-full relative rounded overflow-hidden" style={{ minHeight: "400px" }}>
                {/* Map container for Leaflet */}
                <div ref={mapContainerRef} className="w-full h-full" />
              </div>
            </div>
            <div className="p-4 border-t border-gray-200 flex flex-wrap gap-3">
              <div className="flex items-center text-sm text-gray-600">
                <MapPin className="h-4 w-4 mr-1 text-gray-500" />
                <span>{`${detection.latitude.toFixed(6)}, ${detection.longitude.toFixed(6)}`}</span>
              </div>
              
              <a 
                href={`https://www.openstreetmap.org/?mlat=${detection.latitude}&mlon=${detection.longitude}#map=16/${detection.latitude}/${detection.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto flex items-center px-3 py-1.5 bg-blue-50 text-blue-700 rounded-md text-xs font-medium hover:bg-blue-100 transition-colors"
              >
                <Map className="h-3 w-3 mr-1" />
                Open in OpenStreetMap
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}