// src/app/map/page.tsx

'use client';

import { useEffect, useState } from 'react';
import Header from '@/components/ui/header';
import Sidebar from '@/components/ui/sidebar';
import DetectionMap from '@/components/ui/detection-map';
import { supabase } from '@/lib/supabase';
import { SnakeDetection } from '@/types';

interface ActivityArea {
  name: string;
  count: number;
  lat: number;
  lng: number;
}

interface SpeciesCount {
  species: string;
  count: number;
  percentage: number;
}

export default function MapPage() {
  const [loading, setLoading] = useState(true);
  const [detections, setDetections] = useState<SnakeDetection[]>([]);
  const [timeRange, setTimeRange] = useState<'all' | 'week' | 'month' | 'year'>('all');
  const [viewMode, setViewMode] = useState<'markers' | 'heatmap' | 'both'>('heatmap');
  const [minConfidence, setMinConfidence] = useState(0);
  const [activityAreas, setActivityAreas] = useState<ActivityArea[]>([]);
  const [speciesDistribution, setSpeciesDistribution] = useState<SpeciesCount[]>([]);
  const [showSafetyTips, setShowSafetyTips] = useState(false);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      
      let query = supabase
        .from('snake_detections')
        .select('*')
        .order('timestamp', { ascending: false });
      
      const now = new Date();
      
      if (timeRange === 'week') {
        const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        query = query.gte('timestamp', oneWeekAgo.toISOString());
      } else if (timeRange === 'month') {
        const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        query = query.gte('timestamp', oneMonthAgo.toISOString());
      }
      
      const { data, error } = await query;
      
      if (error) {
        console.error('Error fetching detections:', error);
      } else {
        const detectionData = data as SnakeDetection[];
        setDetections(detectionData);
        
        // Calculate activity areas (group by location clusters) - async with geocoding
        calculateActivityAreas(detectionData).catch(err => {
          console.error('Error calculating activity areas:', err);
        });
        
        // Calculate species distribution
        calculateSpeciesDistribution(detectionData);
      }
      
      setLoading(false);
    }
    
    fetchData();
  }, [timeRange]);

  // Reverse geocode coordinates to get location name
  const reverseGeocode = async (lat: number, lng: number): Promise<string> => {
    try {
      // Use OpenStreetMap Nominatim API (free, no API key required)
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=16&addressdetails=1`,
        {
          headers: {
            'User-Agent': 'SnakeDetectionApp/1.0'
          }
        }
      );
      
      if (!response.ok) {
        return `Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
      }
      
      const data = await response.json();
      
      // Extract meaningful location name
      if (data.address) {
        const addr = data.address;
        // Try to get a meaningful name in priority order
        if (addr.village || addr.town || addr.city) {
          return addr.village || addr.town || addr.city;
        }
        if (addr.suburb || addr.neighbourhood) {
          return addr.suburb || addr.neighbourhood;
        }
        if (addr.road) {
          return addr.road;
        }
        if (addr.county || addr.state) {
          return `${addr.county || addr.state}`;
        }
      }
      
      return data.display_name?.split(',')[0] || `Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
    } catch (error) {
      console.error('Reverse geocoding error:', error);
      return `Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
    }
  };

  // Group detections by location clusters to find highest activity areas
  const calculateActivityAreas = async (detections: SnakeDetection[]) => {
    const validDetections = detections.filter(d => 
      d.latitude && d.longitude && 
      !isNaN(d.latitude) && !isNaN(d.longitude) &&
      d.latitude !== 0 && d.longitude !== 0
    );

    if (validDetections.length === 0) {
      setActivityAreas([]);
      return;
    }

    // Cluster detections by proximity (0.01 degrees ≈ 1km)
    const clusterThreshold = 0.01;
    const clusters: { lat: number; lng: number; count: number; detections: SnakeDetection[] }[] = [];

    validDetections.forEach(detection => {
      let assigned = false;
      for (const cluster of clusters) {
        const distance = Math.sqrt(
          Math.pow(detection.latitude! - cluster.lat, 2) + 
          Math.pow(detection.longitude! - cluster.lng, 2)
        );
        if (distance < clusterThreshold) {
          cluster.count++;
          cluster.detections.push(detection);
          // Update cluster center
          cluster.lat = cluster.detections.reduce((sum, d) => sum + d.latitude!, 0) / cluster.detections.length;
          cluster.lng = cluster.detections.reduce((sum, d) => sum + d.longitude!, 0) / cluster.detections.length;
          assigned = true;
          break;
        }
      }
      if (!assigned) {
        clusters.push({
          lat: detection.latitude!,
          lng: detection.longitude!,
          count: 1,
          detections: [detection]
        });
      }
    });

    // Sort by count and take top 3
    const sortedClusters = clusters
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);

    // Reverse geocode each cluster to get location names
    const topAreas = await Promise.all(
      sortedClusters.map(async (cluster, index) => {
        const locationName = await reverseGeocode(cluster.lat, cluster.lng);
        // Add small delay to respect rate limits (1 request per second)
        if (index < sortedClusters.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        return {
          name: locationName,
          count: cluster.count,
          lat: cluster.lat,
          lng: cluster.lng
        };
      })
    );

    setActivityAreas(topAreas);
  };

  // Calculate species distribution
  const calculateSpeciesDistribution = (detections: SnakeDetection[]) => {
    const speciesMap = new Map<string, number>();
    
    detections.forEach(detection => {
      const species = detection.species || 'Unknown';
      speciesMap.set(species, (speciesMap.get(species) || 0) + 1);
    });

    const total = detections.length || 1;
    const distribution: SpeciesCount[] = Array.from(speciesMap.entries())
      .map(([species, count]) => ({
        species,
        count,
        percentage: (count / total) * 100
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5); // Top 5 species

    setSpeciesDistribution(distribution);
  };

  // Export map data as CSV
  const handleExportData = () => {
    const csvHeaders = ['ID', 'Timestamp', 'Species', 'Confidence', 'Latitude', 'Longitude', 'Venomous', 'Risk Level'];
    const csvRows = detections.map(d => [
      d.id,
      new Date(d.timestamp).toISOString(),
      d.species || 'Unknown',
      (d.confidence * 100).toFixed(1) + '%',
      d.latitude?.toFixed(6) || 'N/A',
      d.longitude?.toFixed(6) || 'N/A',
      d.venomous ? 'Yes' : 'No',
      d.risk_level || 'Unknown'
    ]);

    const csvContent = [
      csvHeaders.join(','),
      ...csvRows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `snake-detections-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8">
              <h1 className="text-2xl font-bold text-gray-900">Snake Detection Map</h1>
              
              <div className="mt-4 md:mt-0 flex flex-wrap gap-2">
                <div className="flex border border-gray-300 rounded-lg overflow-hidden">
                  <button
                    onClick={() => setTimeRange('all')}
                    className={`px-4 py-2 ${
                      timeRange === 'all'
                        ? 'bg-green-600 text-white'
                        : 'bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    All Time
                  </button>
                  <button
                    onClick={() => setTimeRange('year')}
                    className={`px-4 py-2 border-l border-gray-300 ${
                      timeRange === 'year'
                        ? 'bg-green-600 text-white'
                        : 'bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    Last Year
                  </button>
                  <button
                    onClick={() => setTimeRange('month')}
                    className={`px-4 py-2 border-l border-gray-300 ${
                      timeRange === 'month'
                        ? 'bg-green-600 text-white'
                        : 'bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    Last 30 Days
                  </button>
                  <button
                    onClick={() => setTimeRange('week')}
                    className={`px-4 py-2 border-l border-gray-300 ${
                      timeRange === 'week'
                        ? 'bg-green-600 text-white'
                        : 'bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    Last 7 Days
                  </button>
                </div>
                <div className="flex border border-gray-300 rounded-lg overflow-hidden">
                  <button
                    onClick={() => setViewMode('markers')}
                    className={`px-4 py-2 ${
                      viewMode === 'markers'
                        ? 'bg-green-600 text-white'
                        : 'bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    Markers
                  </button>
                  <button
                    onClick={() => setViewMode('heatmap')}
                    className={`px-4 py-2 border-l border-gray-300 ${
                      viewMode === 'heatmap'
                        ? 'bg-green-600 text-white'
                        : 'bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    Heatmap
                  </button>
                  <button
                    onClick={() => setViewMode('both')}
                    className={`px-4 py-2 border-l border-gray-300 ${
                      viewMode === 'both'
                        ? 'bg-green-600 text-white'
                        : 'bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    Both
                  </button>
                </div>
              </div>
            </div>
            
            {loading ? (
              <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-600"></div>
              </div>
            ) : (
              <>
                <div className="bg-white rounded-lg shadow-md p-4 mb-6">
                  <div className="flex flex-wrap justify-between items-center gap-4">
                    <div className="mb-2 md:mb-0">
                      <h2 className="text-lg font-medium text-gray-900">Detection Hotspots</h2>
                      <p className="text-gray-500 text-sm">Displaying {detections.length} detection points</p>
                    </div>
                    {viewMode === 'heatmap' || viewMode === 'both' ? (
                      <div className="flex items-center space-x-4">
                        <div className="flex items-center">
                          <div className="w-4 h-4 bg-gradient-to-r from-blue-500 via-yellow-500 to-red-500 rounded mr-2"></div>
                          <span className="text-sm text-gray-600">Heat Intensity</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <label className="text-sm text-gray-600">Min Confidence:</label>
                          <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.1"
                            value={minConfidence}
                            onChange={(e) => setMinConfidence(parseFloat(e.target.value))}
                            className="w-24"
                          />
                          <span className="text-sm text-gray-600 w-12">{(minConfidence * 100).toFixed(0)}%</span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-4">
                        <div className="flex items-center">
                          <span className="w-3 h-3 rounded-full bg-red-500 mr-1"></span>
                          <span className="text-sm text-gray-600">High Risk</span>
                        </div>
                        <div className="flex items-center">
                          <span className="w-3 h-3 rounded-full bg-yellow-500 mr-1"></span>
                          <span className="text-sm text-gray-600">Medium Risk</span>
                        </div>
                        <div className="flex items-center">
                          <span className="w-3 h-3 rounded-full bg-blue-500 mr-1"></span>
                          <span className="text-sm text-gray-600">Low Risk</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                
                <DetectionMap 
                  detections={detections} 
                  height="700px" 
                  viewMode={viewMode}
                  timeRange={timeRange}
                  minConfidence={minConfidence}
                />
                
                <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-white rounded-lg shadow-md p-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Highest Activity Areas</h3>
                    {activityAreas.length > 0 ? (
                      <ul className="space-y-4">
                        {activityAreas.map((area, index) => {
                          const colors = [
                            'bg-red-100 text-red-800',
                            'bg-orange-100 text-orange-800',
                            'bg-yellow-100 text-yellow-800'
                          ];
                          return (
                            <li key={index} className="flex items-center justify-between">
                              <div className="flex items-center">
                                <span className={`w-6 h-6 rounded-full ${colors[index]} flex items-center justify-center font-bold text-xs mr-2`}>
                                  {index + 1}
                                </span>
                                <span className="text-sm">{area.name}</span>
                              </div>
                              <span className={`${colors[index]} px-2 py-1 rounded text-xs font-medium`}>
                                {area.count} detection{area.count !== 1 ? 's' : ''}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <p className="text-sm text-gray-500">No location data available</p>
                    )}
                  </div>
                  
                  <div className="bg-white rounded-lg shadow-md p-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Species Distribution</h3>
                    {speciesDistribution.length > 0 ? (
                      <div className="space-y-4">
                        {speciesDistribution.map((item, index) => (
                          <div key={index}>
                            <div className="flex justify-between mb-1">
                              <span className="text-sm text-gray-600">{item.species}</span>
                              <span className="text-sm font-medium text-gray-900">
                                {item.percentage.toFixed(1)}% ({item.count})
                              </span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div 
                                className="bg-green-600 h-2 rounded-full transition-all" 
                                style={{ width: `${item.percentage}%` }}
                              ></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">No species data available</p>
                    )}
                  </div>
                  
                  <div className="bg-white rounded-lg shadow-md p-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h3>
                    <div className="space-y-3">
                      <button 
                        onClick={() => alert('Alert Zone feature coming soon! This will allow you to set up geofenced alert areas.')}
                        className="w-full flex items-center justify-center bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded transition-colors"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Add Alert Zone
                      </button>
                      <button 
                        onClick={handleExportData}
                        className="w-full flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded transition-colors"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Export Map Data
                      </button>
                      <button 
                        onClick={() => setShowSafetyTips(true)}
                        className="w-full flex items-center justify-center border border-gray-300 text-gray-700 py-2 px-4 rounded hover:bg-gray-50 transition-colors"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        View Safety Tips
                      </button>
                    </div>
                  </div>
                </div>

                {/* Safety Tips Modal */}
                {showSafetyTips && (
                  <div className="fixed inset-0 z-50 overflow-y-auto">
                    <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center">
                      <div className="fixed inset-0 transition-opacity" onClick={() => setShowSafetyTips(false)}>
                        <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
                      </div>
                      <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
                        <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                          <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-medium text-gray-900">Snake Safety Tips</h3>
                            <button
                              onClick={() => setShowSafetyTips(false)}
                              className="text-gray-400 hover:text-gray-500"
                            >
                              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                          <div className="space-y-4 text-sm text-gray-700">
                            <div>
                              <h4 className="font-semibold text-gray-900 mb-2">If You Encounter a Snake:</h4>
                              <ul className="list-disc list-inside space-y-1 ml-2">
                                <li>Stay calm and move away slowly</li>
                                <li>Do not attempt to handle or kill the snake</li>
                                <li>Keep a safe distance (at least 6 feet)</li>
                                <li>Take a photo if safe to do so for identification</li>
                              </ul>
                            </div>
                            <div>
                              <h4 className="font-semibold text-gray-900 mb-2">If Bitten:</h4>
                              <ul className="list-disc list-inside space-y-1 ml-2">
                                <li>Seek immediate medical attention</li>
                                <li>Keep the affected area immobilized and below heart level</li>
                                <li>Remove tight clothing or jewelry near the bite</li>
                                <li>Do NOT apply a tourniquet or try to suck out venom</li>
                                <li>Note the snake's appearance for identification</li>
                              </ul>
                            </div>
                            <div>
                              <h4 className="font-semibold text-gray-900 mb-2">Prevention:</h4>
                              <ul className="list-disc list-inside space-y-1 ml-2">
                                <li>Wear protective footwear in snake-prone areas</li>
                                <li>Use a flashlight when walking at night</li>
                                <li>Be cautious around tall grass, rocks, and woodpiles</li>
                                <li>Keep your surroundings clean to avoid attracting rodents</li>
                              </ul>
                            </div>
                          </div>
                        </div>
                        <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                          <button
                            onClick={() => setShowSafetyTips(false)}
                            className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-green-600 text-base font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 sm:ml-3 sm:w-auto sm:text-sm"
                          >
                            Close
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}