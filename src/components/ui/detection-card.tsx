import Image from "next/image";
import { SnakeDetection } from "@/types";
import {
  formatDate,
  getTimeAgo,
  getConfidenceColor,
  calculateDistance,
} from "@/lib/utils";
import { useState, useEffect, useRef } from "react";
import {
  MapPin,
  Clock,
  AlertCircle,
  Map,
  AlertTriangle,
  X,
  Info,
} from "lucide-react";

interface DetectionCardProps {
  detection: SnakeDetection;
  userLocation?: { lat: number; lng: number } | null;
}

export default function DetectionCard({
  detection,
  userLocation,
}: DetectionCardProps) {
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [timeAgo, setTimeAgo] = useState<string>("");
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const leafletLoadedRef = useRef<boolean>(false);

  // Risk level styling - subtle and professional
  const riskLevelConfig = {
    critical: {
      badge: "bg-gray-900 text-white",
      dot: "bg-gray-900",
      label: "Critical",
    },
    high: {
      badge: "bg-gray-700 text-white",
      dot: "bg-gray-700",
      label: "High Risk",
    },
    medium: {
      badge: "bg-gray-500 text-white",
      dot: "bg-gray-500",
      label: "Medium",
    },
    low: {
      badge: "bg-gray-300 text-gray-700",
      dot: "bg-gray-300",
      label: "Low Risk",
    },
  };

  const riskLevel = (detection.risk_level || "low") as keyof typeof riskLevelConfig;
  const riskConfig = riskLevelConfig[riskLevel] || riskLevelConfig.low;

  // Calculate time ago on client side only to avoid hydration mismatch
  useEffect(() => {
    setTimeAgo(getTimeAgo(detection.classified_at || detection.timestamp));
  }, [detection.classified_at, detection.timestamp]);

  const handleViewMap = () => {
    if (hasCoordinates) {
      setShowMap(true);
    }
  };

  const hasCoordinates =
    detection.latitude !== null && detection.longitude !== null;

  useEffect(() => {
    if (!showMap || !hasCoordinates || !mapContainerRef.current) return;

    const loadLeaflet = async () => {
      try {
        if (!document.querySelector('link[href*="leaflet.css"]')) {
          const link = document.createElement("link");
          link.rel = "stylesheet";
          link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
          link.integrity =
            "sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=";
          link.crossOrigin = "";
          document.head.appendChild(link);

          await new Promise((resolve) => setTimeout(resolve, 100));
        }

        if (!leafletLoadedRef.current) {
          const L = (await import("leaflet")).default;
          leafletLoadedRef.current = true;
          if (mapInstanceRef.current) {
            mapInstanceRef.current.remove();
          }
          if (mapContainerRef.current) {
            mapInstanceRef.current = L.map(mapContainerRef.current).setView(
              [detection.latitude!, detection.longitude!],
              14
            );
          }

          L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            attribution:
              '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 19,
          }).addTo(mapInstanceRef.current);

          markerRef.current = L.marker([
            detection.latitude!,
            detection.longitude!,
          ])
            .addTo(mapInstanceRef.current)
            .bindPopup(
              `
              <div class="p-2 text-center">
                <strong>${detection.species || "Snake Detection"}</strong><br>
                <small>${formatDate(detection.timestamp)}</small><br>
                <small>Confidence: ${(detection.confidence * 100).toFixed(
                  1
                )}%</small>
              </div>
            `
            )
            .openPopup();
        }
      } catch (error) {
        console.error("Error loading map:", error);
      }

      if (mapInstanceRef.current) {
        setTimeout(() => {
          mapInstanceRef.current.invalidateSize();
        }, 0);
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
  }, [showMap, hasCoordinates]); 

  return (
    <div className="bg-white rounded-lg shadow-sm overflow-hidden transition-all duration-200 hover:shadow-md border border-gray-200 flex flex-col h-full">
      {/* Image Section */}
      <div className="relative">
        <div className="aspect-video relative overflow-hidden bg-gray-100">
          {!imageError && detection.image_url ? (
            <Image
              src={detection.image_url}
              alt={`Snake detected at ${formatDate(detection.timestamp)}`}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gray-50">
              <div className="text-center p-4">
                <AlertCircle className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-400">Image not available</p>
              </div>
            </div>
          )}
          
          {/* Subtle overlays */}
          <div className="absolute top-3 left-3 flex items-center gap-2">
            {detection.risk_level && (
              <span className={`${riskConfig.badge} px-2.5 py-1 rounded text-xs font-medium`}>
                {riskConfig.label}
              </span>
            )}
            {detection.venomous && (
              <span className="bg-gray-800 text-white px-2.5 py-1 rounded text-xs font-medium">
                Venomous
              </span>
            )}
          </div>

          <div className="absolute top-3 right-3">
            <div className="bg-black bg-opacity-60 text-white px-2.5 py-1 rounded text-xs font-medium backdrop-blur-sm">
              {(detection.confidence * 100).toFixed(0)}%
            </div>
          </div>

          {detection.processed === false && (
            <div className="absolute bottom-3 left-3 bg-gray-800 text-white px-2.5 py-1 rounded text-xs font-medium">
              New
            </div>
          )}
        </div>
      </div>

      {/* Content Section - Compact */}
      <div className="p-4 flex-1 flex flex-col min-h-0">
        {/* Species Name */}
        <h3 className="font-semibold text-gray-900 text-base mb-2">
          {detection.species || "Unknown Species"}
        </h3>

        {/* Essential Info Only */}
        <div className="flex items-center flex-wrap gap-x-3 gap-y-1.5 text-xs text-gray-600 mb-3">
          <div className="flex items-center gap-1.5 whitespace-nowrap">
            <Clock className="h-3.5 w-3.5 flex-shrink-0" />
            <span suppressHydrationWarning>{timeAgo || formatDate(detection.classified_at || detection.timestamp)}</span>
          </div>
          {hasCoordinates && userLocation && (
            <div className="flex items-center gap-1.5 whitespace-nowrap">
              <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
              <span>
                {calculateDistance(
                  userLocation.lat,
                  userLocation.lng,
                  detection.latitude!,
                  detection.longitude!
                ).toFixed(1)} km away
              </span>
            </div>
          )}
          {detection.venomous !== undefined && (
            <div className="flex items-center gap-1.5 whitespace-nowrap">
              <div className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${detection.venomous ? 'bg-gray-800' : 'bg-gray-300'}`} />
              <span>{detection.venomous ? "Venomous" : "Non-venomous"}</span>
            </div>
          )}
        </div>

        {/* Action Buttons - Always at bottom */}
        <div className="flex gap-2 mt-auto pt-3 border-t border-gray-100">
          {hasCoordinates && (
            <button
              onClick={handleViewMap}
              className="flex-1 flex items-center justify-center px-3 py-2 bg-gray-900 text-white rounded text-xs font-medium hover:bg-gray-800 transition-colors"
            >
              <Map className="h-3.5 w-3.5 mr-1.5" />
              Map
            </button>
          )}

          <button
            onClick={() => setShowDetailsModal(true)}
            className="flex items-center justify-center px-3 py-2 text-gray-700 bg-white border border-gray-300 rounded text-xs font-medium hover:bg-gray-50 transition-colors"
          >
            <Info className="h-3.5 w-3.5 mr-1.5" />
            Details
          </button>
        </div>
      </div>

      {/* Details Modal */}
      {showDetailsModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md"
          onClick={() => setShowDetailsModal(false)}
        >
          <div 
            className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-semibold text-xl text-gray-900">
                {detection.species || "Unknown Species"}
              </h3>
              <button
                onClick={() => setShowDetailsModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Description */}
              {detection.classification_description && (
                <div>
                  <div className="text-sm font-semibold text-gray-900 mb-2">Description</div>
                  <p className="text-sm text-gray-700 leading-relaxed">
                    {detection.classification_description}
                  </p>
                </div>
              )}

              {/* Key Information Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs font-medium text-gray-500 mb-1">Detected</div>
                  <p className="text-sm text-gray-900">{formatDate(detection.timestamp)}</p>
                </div>
                {detection.classified_at && (
                  <div>
                    <div className="text-xs font-medium text-gray-500 mb-1">Classified</div>
                    <p className="text-sm text-gray-900">{formatDate(detection.classified_at)}</p>
                  </div>
                )}
                <div>
                  <div className="text-xs font-medium text-gray-500 mb-1">Detection Confidence</div>
                  <p className="text-sm text-gray-900">{(detection.confidence * 100).toFixed(0)}%</p>
                </div>
                {detection.classification_confidence && (
                  <div>
                    <div className="text-xs font-medium text-gray-500 mb-1">ID Confidence</div>
                    <p className="text-sm text-gray-900">{(detection.classification_confidence * 100).toFixed(0)}%</p>
                  </div>
                )}
                {hasCoordinates && (
                  <div className="col-span-2">
                    <div className="text-xs font-medium text-gray-500 mb-1">Coordinates</div>
                    <p className="text-sm text-gray-900 font-mono">
                      {`${detection.latitude.toFixed(6)}, ${detection.longitude.toFixed(6)}`}
                    </p>
                  </div>
                )}
                <div>
                  <div className="text-xs font-medium text-gray-500 mb-1">Type</div>
                  <p className="text-sm text-gray-900">
                    {detection.venomous ? "Venomous" : "Non-venomous"}
                  </p>
                </div>
                <div>
                  <div className="text-xs font-medium text-gray-500 mb-1">Status</div>
                  <div className="inline-flex items-center px-2.5 py-1 rounded text-xs font-medium bg-gray-100 text-gray-700">
                    {detection.status === "captured"
                      ? "Captured"
                      : detection.status === "reviewed"
                      ? "Reviewed"
                      : detection.status === "false_alarm"
                      ? "False Alarm"
                      : "Pending Review"}
                  </div>
                </div>
              </div>

              {/* First Aid Info */}
              {detection.venomous && detection.classification_first_aid && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="text-sm font-semibold text-red-900 mb-2 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    First Aid Instructions
                  </div>
                  <p className="text-sm text-red-800 whitespace-pre-wrap leading-relaxed">
                    {detection.classification_first_aid}
                  </p>
                </div>
              )}

              {/* Notes */}
              {detection.notes && (
                <div>
                  <div className="text-sm font-semibold text-gray-900 mb-2">Additional Notes</div>
                  <p className="text-sm text-gray-700">{detection.notes}</p>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              {hasCoordinates && (
                <button
                  onClick={() => {
                    setShowDetailsModal(false);
                    setShowMap(true);
                  }}
                  className="px-4 py-2 bg-gray-900 text-white rounded text-sm font-medium hover:bg-gray-800 transition-colors"
                >
                  <Map className="h-4 w-4 inline mr-2" />
                  View on Map
                </button>
              )}
              <button
                onClick={() => setShowDetailsModal(false)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded text-sm font-medium hover:bg-gray-200 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Map Popup */}
      {showMap && hasCoordinates && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md">
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
              <div
                className="h-full w-full relative rounded overflow-hidden"
                style={{ height: "500px" }} 
              >
                <div ref={mapContainerRef} className="w-full h-full" />
              </div>
            </div>
            <div className="p-4 border-t border-gray-200 flex flex-wrap gap-3">
              <div className="flex items-center text-sm text-gray-600">
                <MapPin className="h-4 w-4 mr-1 text-gray-500" />
                <span>{`${detection.latitude?.toFixed(6) || "N/A"}, ${
                  detection.longitude?.toFixed(6) || "N/A"
                }`}</span>
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

