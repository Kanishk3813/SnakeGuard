'use client';

import { useEffect, useRef, useState } from 'react';
import { SnakeDetection } from '@/types';

interface DetectionMapProps {
  detections: SnakeDetection[];
  height?: string;
  selectedDetectionId?: string;
  viewMode?: 'markers' | 'heatmap' | 'both';
  showControls?: boolean;
  timeRange?: 'all' | 'week' | 'month' | 'year';
  minConfidence?: number;
}

export default function DetectionMap({ 
  detections, 
  height = "500px", 
  selectedDetectionId,
  viewMode = 'markers',
  showControls = false,
  timeRange = 'all',
  minConfidence = 0
}: DetectionMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [currentViewMode, setCurrentViewMode] = useState<'markers' | 'heatmap' | 'both'>(viewMode);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const popupsRef = useRef<any[]>([]);
  const heatmapLayerRef = useRef<any>(null);
  const [heatmapData, setHeatmapData] = useState<number[][]>([]);
  const [loadingHeatmap, setLoadingHeatmap] = useState(false);
  const leafletLoadedRef = useRef(false);
  
  // Sync currentViewMode with viewMode prop
  useEffect(() => {
    setCurrentViewMode(viewMode);
  }, [viewMode]);
  
  // Fetch heatmap data from API
  useEffect(() => {
    if (currentViewMode === 'heatmap' || currentViewMode === 'both') {
      fetchHeatmapData();
    } else {
      setHeatmapData([]);
    }
  }, [currentViewMode, timeRange, minConfidence, detections]);

  const fetchHeatmapData = async () => {
    setLoadingHeatmap(true);
    try {
      const params = new URLSearchParams({
        timeRange: timeRange || 'all',
        minConfidence: (minConfidence || 0).toString()
      });
      
      const response = await fetch(`/api/heatmap?${params}`);
      if (!response.ok) throw new Error('Failed to fetch heatmap data');
      
      const result = await response.json();
      setHeatmapData(result.data || []);
    } catch (error) {
      console.error('Error fetching heatmap data:', error);
      // Fallback to local detections
      const localData = detections
        .filter(d => 
          typeof d.latitude === 'number' && 
          typeof d.longitude === 'number' &&
          !isNaN(d.latitude) && 
          !isNaN(d.longitude) &&
          d.latitude !== 0 &&
          d.longitude !== 0
        )
        .map(d => [d.latitude, d.longitude, d.confidence || 0.5]);
      setHeatmapData(localData);
    } finally {
      setLoadingHeatmap(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    let mapInitialized = false;
    
    const loadLeaflet = async () => {
      try {
        if (typeof window === 'undefined') return;
        
        // Wait for container to be available
        let retries = 0;
        while (!mapContainerRef.current && retries < 10) {
          await new Promise(resolve => setTimeout(resolve, 100));
          retries++;
        }
        
        if (!mapContainerRef.current || !isMounted) {
          console.warn('Map container not available');
          return;
        }
        
        // Load CSS
        if (!document.querySelector('link[href*="leaflet.css"]')) {
          const link = document.createElement('link');
          link.rel = 'stylesheet';
          link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
          link.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
          link.crossOrigin = '';
          document.head.appendChild(link);
          // Wait for CSS to load
          await new Promise(resolve => setTimeout(resolve, 200));
        }
        
        // Load Leaflet
        if (!leafletLoadedRef.current) {
          const L = (await import('leaflet')).default;
          (window as any).L = L;
          leafletLoadedRef.current = true;
          
          // Load heatmap plugin via script tag if needed
          if ((currentViewMode === 'heatmap' || currentViewMode === 'both') && !(window as any).L.heatLayer) {
            await new Promise<void>((resolve) => {
              if ((window as any).L.heatLayer) {
                resolve();
                return;
              }
              const script = document.createElement('script');
              script.src = 'https://unpkg.com/leaflet.heat@0.2.0/dist/leaflet-heat.js';
              script.onload = () => {
                console.log('leaflet.heat loaded');
                resolve();
              };
              script.onerror = () => {
                console.warn('Failed to load leaflet.heat from CDN');
                resolve();
              };
              document.head.appendChild(script);
            });
          }
        }
        
        if (!isMounted || !mapContainerRef.current || mapInitialized) return;
        
        const L = (window as any).L;
        if (!L) {
          console.error('Leaflet not loaded');
          return;
        }
        
        // Small delay to ensure DOM is ready
        await new Promise(resolve => setTimeout(resolve, 100));
        
        if (!isMounted || !mapContainerRef.current) return;
        
        initMap(L);
        mapInitialized = true;
        setMapLoaded(true);
      } catch (error) {
        console.error('Error loading Leaflet:', error);
        setMapLoaded(false);
      }
    };
    
    const initMap = (L: any) => {
      if (!mapContainerRef.current) {
        console.error('Map container not available for initialization');
        return;
      }
      
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.remove();
        } catch (e) {
          console.warn('Error removing existing map:', e);
        }
        mapInstanceRef.current = null;
      }

      // Calculate center from detections
      const validDetections = detections.filter(d => 
        typeof d.latitude === 'number' && 
        typeof d.longitude === 'number' &&
        !isNaN(d.latitude) && 
        !isNaN(d.longitude) &&
        d.latitude !== 0 &&
        d.longitude !== 0
      );
      
      let center: [number, number] = [20.5937, 78.9629]; // Default to India center
      let zoom = 5;
      
      if (validDetections.length > 0) {
        const avgLat = validDetections.reduce((sum, d) => sum + d.latitude, 0) / validDetections.length;
        const avgLng = validDetections.reduce((sum, d) => sum + d.longitude, 0) / validDetections.length;
        center = [avgLat, avgLng];
        zoom = 13;
      }

      try {
        mapInstanceRef.current = L.map(mapContainerRef.current, {
          center,
          zoom,
          scrollWheelZoom: true,
          zoomControl: true,
        });
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          maxZoom: 19,
        }).addTo(mapInstanceRef.current);
        
        // Use setTimeout to ensure map is fully initialized before adding layers
        setTimeout(() => {
          if (mapInstanceRef.current && isMounted) {
            updateMapLayers(L);
          }
        }, 300);
      } catch (error) {
        console.error('Error initializing map:', error);
      }
    };
    
    const updateMapLayers = (L: any) => {
      if (!mapInstanceRef.current) return;
      
      // Remove existing layers
      if (heatmapLayerRef.current) {
        try {
          mapInstanceRef.current.removeLayer(heatmapLayerRef.current);
        } catch (e) {
          console.warn('Error removing heatmap layer:', e);
        }
        heatmapLayerRef.current = null;
      }
      
      markersRef.current.forEach(marker => {
        try {
          marker.remove();
        } catch (e) {
          console.warn('Error removing marker:', e);
        }
      });
      markersRef.current = [];
      popupsRef.current = [];
      
      const validDetections = detections.filter(d => 
        typeof d.latitude === 'number' && 
        typeof d.longitude === 'number' &&
        !isNaN(d.latitude) && 
        !isNaN(d.longitude) &&
        d.latitude !== 0 &&
        d.longitude !== 0
      );
      
      if (validDetections.length === 0) {
        console.log('No valid detections to display');
        return;
      }
      
      // Add markers FIRST (so they appear above heatmap)
      if (currentViewMode === 'markers' || currentViewMode === 'both') {
        console.log('Adding', validDetections.length, 'markers');
        addMarkers(L, validDetections);
      }
      
      // Add heatmap layer AFTER markers (so heatmap is below)
      if ((currentViewMode === 'heatmap' || currentViewMode === 'both') && heatmapData.length > 0) {
        try {
          const L = (window as any).L;
          if (L && L.heatLayer) {
            console.log('Creating heatmap with', heatmapData.length, 'points');
            heatmapLayerRef.current = L.heatLayer(heatmapData, {
              radius: 30,
              blur: 20,
              maxZoom: 17,
              max: 1.0,
              gradient: {
                0.0: 'blue',
                0.3: 'cyan',
                0.5: 'lime',
                0.7: 'yellow',
                1.0: 'red'
              }
            });
            heatmapLayerRef.current.addTo(mapInstanceRef.current);
            console.log('Heatmap layer added');
          } else {
            console.warn('L.heatLayer not available');
          }
        } catch (error) {
          console.error('Error creating heatmap layer:', error);
        }
      }
      
      // Fit bounds
      try {
        const bounds = L.latLngBounds(
          validDetections.map((d: SnakeDetection) => [d.latitude, d.longitude])
        );
        mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50] });
        
        if (mapInstanceRef.current.getZoom() > 18) {
          mapInstanceRef.current.setZoom(18);
        }
      } catch (e) {
        console.warn('Error fitting bounds:', e);
      }
    };
    
    const addMarkers = (L: any, validDetections: SnakeDetection[]) => {
      if (!mapInstanceRef.current) {
        console.warn('Map instance not available for adding markers');
        return;
      }
      
      console.log('addMarkers called with', validDetections.length, 'detections');
      
      validDetections.forEach((detection) => {
        // Create custom divIcon that doesn't rely on external resources
        const getMarkerColor = () => {
          if (detection.id === selectedDetectionId) return '#ef4444'; // red-500
          if (detection.confidence > 0.8) return '#22c55e'; // green-500
          if (detection.confidence > 0.6) return '#eab308'; // yellow-500
          return '#ef4444'; // red-500
        };
        
        const color = getMarkerColor();
        
        const icon = L.divIcon({
          className: 'custom-snake-marker',
          html: `<div style="
            width: 32px;
            height: 32px;
            background-color: ${color};
            border: 3px solid white;
            border-radius: 50%;
            box-shadow: 0 2px 8px rgba(0,0,0,0.4);
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            z-index: 1000;
            position: relative;
          ">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M12 8V12M12 16H12.01M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>`,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        });
        
        const marker = L.marker([detection.latitude, detection.longitude], { 
          icon,
          zIndexOffset: 1000
        });
        
        const popupContent = `
          <div style="min-width: 200px; padding: 8px;">
            <div style="margin-bottom: 8px; position: relative;">
              <img 
                src="${detection.image_url || '/placeholder-snake.jpg'}" 
                alt="Snake detection" 
                style="width: 100%; height: 100px; object-fit: cover; border-radius: 4px;"
                onerror="this.src='data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'200\' height=\'100\'%3E%3Crect fill=\'%23ddd\' width=\'200\' height=\'100\'/%3E%3Ctext fill=\'%23999\' font-family=\'sans-serif\' font-size=\'14\' x=\'50%25\' y=\'50%25\' text-anchor=\'middle\' dy=\'.3em\'%3ENo Image%3C/text%3E%3C/svg%3E'"
              />
              <div style="position: absolute; top: 4px; right: 4px; background: rgba(0,0,0,0.7); color: white; padding: 2px 6px; border-radius: 3px; font-size: 11px;">
                ${(detection.confidence * 100).toFixed(0)}%
              </div>
            </div>
            <h3 style="font-weight: bold; font-size: 14px; margin: 4px 0;">${detection.species || 'Snake Detected'}</h3>
            <p style="font-size: 12px; color: #666; margin: 4px 0;">${new Date(detection.timestamp).toLocaleString()}</p>
            ${detection.notes ? `<p style="font-size: 11px; font-style: italic; margin-top: 4px; color: #888;">${detection.notes}</p>` : ''}
          </div>
        `;
        
        marker.addTo(mapInstanceRef.current).bindPopup(popupContent);
        
        if (detection.id === selectedDetectionId) {
          marker.openPopup();
        }
        
        markersRef.current.push(marker);
        console.log('Marker added at:', detection.latitude, detection.longitude);
      });
      
      console.log('Markers added:', markersRef.current.length);
    };
    
    // Initialize map on mount only
    loadLeaflet();
    
    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        try {
          if (heatmapLayerRef.current) {
            mapInstanceRef.current.removeLayer(heatmapLayerRef.current);
          }
          mapInstanceRef.current.remove();
          mapInstanceRef.current = null;
        } catch (e) {
          console.error('Error cleaning up map:', e);
        }
      }
    };
  }, []); // Only run on mount
  
  // Update layers when detections or view mode changes
  useEffect(() => {
    if (mapLoaded && mapInstanceRef.current) {
      const L = (window as any).L;
      if (L) {
        // Small delay to ensure map is ready
        setTimeout(() => {
          if (mapInstanceRef.current) {
            const updateLayers = () => {
              if (!mapInstanceRef.current) return;
              
              // Remove existing layers
              if (heatmapLayerRef.current) {
                try {
                  mapInstanceRef.current.removeLayer(heatmapLayerRef.current);
                } catch (e) {
                  // Ignore
                }
                heatmapLayerRef.current = null;
              }
              
              markersRef.current.forEach(marker => {
                try {
                  marker.remove();
                } catch (e) {
                  // Ignore
                }
              });
              markersRef.current = [];
              popupsRef.current = [];
              
              const validDetections = detections.filter(d => 
                typeof d.latitude === 'number' && 
                typeof d.longitude === 'number' &&
                !isNaN(d.latitude) && 
                !isNaN(d.longitude) &&
                d.latitude !== 0 &&
                d.longitude !== 0
              );
              
              if (validDetections.length === 0) return;
              
              // Add markers FIRST (so they appear above heatmap)
              if (currentViewMode === 'markers' || currentViewMode === 'both') {
                console.log('Updating markers, count:', validDetections.length);
                
                validDetections.forEach((detection: SnakeDetection) => {
                  // Create custom divIcon that doesn't rely on external resources
                  const getMarkerColor = () => {
                    if (detection.id === selectedDetectionId) return '#ef4444'; // red-500
                    if (detection.confidence > 0.8) return '#22c55e'; // green-500
                    if (detection.confidence > 0.6) return '#eab308'; // yellow-500
                    return '#ef4444'; // red-500
                  };
                  
                  const color = getMarkerColor();
                  const icon = L.divIcon({
                    className: 'custom-snake-marker',
                    html: `<div style="
                      width: 32px;
                      height: 32px;
                      background-color: ${color};
                      border: 3px solid white;
                      border-radius: 50%;
                      box-shadow: 0 2px 8px rgba(0,0,0,0.4);
                      display: flex;
                      align-items: center;
                      justify-content: center;
                      cursor: pointer;
                      z-index: 1000;
                      position: relative;
                    ">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                        <path d="M12 8V12M12 16H12.01M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                      </svg>
                    </div>`,
                    iconSize: [32, 32],
                    iconAnchor: [16, 16],
                  });
                  
                  const marker = L.marker([detection.latitude, detection.longitude], { 
                    icon,
                    zIndexOffset: 1000
                  });
                  
                  const popupContent = `
                    <div style="min-width: 200px; padding: 8px;">
                      <div style="margin-bottom: 8px; position: relative;">
                        <img 
                          src="${detection.image_url || '/placeholder-snake.jpg'}" 
                          alt="Snake detection" 
                          style="width: 100%; height: 100px; object-fit: cover; border-radius: 4px;"
                          onerror="this.src='data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'200\' height=\'100\'%3E%3Crect fill=\'%23ddd\' width=\'200\' height=\'100\'/%3E%3Ctext fill=\'%23999\' font-family=\'sans-serif\' font-size=\'14\' x=\'50%25\' y=\'50%25\' text-anchor=\'middle\' dy=\'.3em\'%3ENo Image%3C/text%3E%3C/svg%3E'"
                        />
                        <div style="position: absolute; top: 4px; right: 4px; background: rgba(0,0,0,0.7); color: white; padding: 2px 6px; border-radius: 3px; font-size: 11px;">
                          ${(detection.confidence * 100).toFixed(0)}%
                        </div>
                      </div>
                      <h3 style="font-weight: bold; font-size: 14px; margin: 4px 0;">${detection.species || 'Snake Detected'}</h3>
                      <p style="font-size: 12px; color: #666; margin: 4px 0;">${new Date(detection.timestamp).toLocaleString()}</p>
                      ${detection.notes ? `<p style="font-size: 11px; font-style: italic; margin-top: 4px; color: #888;">${detection.notes}</p>` : ''}
                    </div>
                  `;
                  
                  marker.addTo(mapInstanceRef.current).bindPopup(popupContent);
                  
                  if (detection.id === selectedDetectionId) {
                    marker.openPopup();
                  }
                  
                  markersRef.current.push(marker);
                });
                
                console.log('Total markers on map:', markersRef.current.length);
              }
              
              // Add heatmap layer AFTER markers (so heatmap is below)
              if ((currentViewMode === 'heatmap' || currentViewMode === 'both') && heatmapData.length > 0) {
                try {
                  if (L.heatLayer) {
                    console.log('Updating heatmap with', heatmapData.length, 'points');
                    heatmapLayerRef.current = L.heatLayer(heatmapData, {
                      radius: 30,
                      blur: 20,
                      maxZoom: 17,
                      max: 1.0,
                      gradient: {
                        0.0: 'blue',
                        0.3: 'cyan',
                        0.5: 'lime',
                        0.7: 'yellow',
                        1.0: 'red'
                      }
                    });
                    heatmapLayerRef.current.addTo(mapInstanceRef.current);
                  }
                } catch (error) {
                  console.error('Error updating heatmap layer:', error);
                }
              }
              
              // Fit bounds
              try {
                const bounds = L.latLngBounds(
                  validDetections.map((d: SnakeDetection) => [d.latitude, d.longitude])
                );
                mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50] });
              } catch (e) {
                // Ignore
              }
            };
            
            updateLayers();
          }
        }, 100);
      }
    }
  }, [detections, selectedDetectionId, mapLoaded, currentViewMode, heatmapData]);
  
  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden relative">
      {showControls && (
        <div className="absolute top-4 right-4 z-[1000] bg-white rounded-lg shadow-lg p-2 flex gap-2">
          <button
            onClick={() => setCurrentViewMode('markers')}
            className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
              currentViewMode === 'markers' || currentViewMode === 'both'
                ? 'bg-green-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Markers
          </button>
          <button
            onClick={() => setCurrentViewMode('heatmap')}
            className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
              currentViewMode === 'heatmap' || currentViewMode === 'both'
                ? 'bg-green-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Heatmap
          </button>
          <button
            onClick={() => setCurrentViewMode('both')}
            className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
              currentViewMode === 'both'
                ? 'bg-green-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Both
          </button>
        </div>
      )}
      {loadingHeatmap && (
        <div className="absolute top-4 left-4 z-[1000] bg-white rounded-lg shadow-lg p-2">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-green-600 border-t-transparent"></div>
            Loading heatmap...
          </div>
        </div>
      )}
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
