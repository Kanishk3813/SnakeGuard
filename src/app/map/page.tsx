// src/app/map/page.tsx

'use client';

import { useEffect, useState } from 'react';
import Header from '@/components/ui/header';
import Sidebar from '@/components/ui/sidebar';
import DetectionMap from '@/components/ui/detection-map';
import { supabase } from '@/lib/supabase';
import { SnakeDetection } from '@/types';

export default function MapPage() {
  const [loading, setLoading] = useState(true);
  const [detections, setDetections] = useState<SnakeDetection[]>([]);
  const [timeRange, setTimeRange] = useState<'all' | 'week' | 'month' | 'year'>('all');
  const [viewMode, setViewMode] = useState<'markers' | 'heatmap' | 'both'>('heatmap');
  const [minConfidence, setMinConfidence] = useState(0);

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
        setDetections(data as SnakeDetection[]);
      }
      
      setLoading(false);
    }
    
    fetchData();
  }, [timeRange]);

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
                    <ul className="space-y-4">
                      <li className="flex items-center justify-between">
                        <div className="flex items-center">
                          <span className="w-6 h-6 rounded-full bg-red-100 text-red-800 flex items-center justify-center font-bold text-xs mr-2">1</span>
                          <span>North Campus</span>
                        </div>
                        <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-xs font-medium">
                          12 detections
                        </span>
                      </li>
                      <li className="flex items-center justify-between">
                        <div className="flex items-center">
                          <span className="w-6 h-6 rounded-full bg-orange-100 text-orange-800 flex items-center justify-center font-bold text-xs mr-2">2</span>
                          <span>East Woods</span>
                        </div>
                        <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded text-xs font-medium">
                          8 detections
                        </span>
                      </li>
                      <li className="flex items-center justify-between">
                        <div className="flex items-center">
                          <span className="w-6 h-6 rounded-full bg-yellow-100 text-yellow-800 flex items-center justify-center font-bold text-xs mr-2">3</span>
                          <span>South Pond</span>
                        </div>
                        <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs font-medium">
                          5 detections
                        </span>
                      </li>
                    </ul>
                  </div>
                  
                  <div className="bg-white rounded-lg shadow-md p-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Species Distribution</h3>
                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between mb-1">
                          <span className="text-sm text-gray-600">Cobra</span>
                          <span className="text-sm font-medium text-gray-900">64%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div className="bg-green-600 h-2 rounded-full" style={{ width: '64%' }}></div>
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between mb-1">
                          <span className="text-sm text-gray-600">Python</span>
                          <span className="text-sm font-medium text-gray-900">22%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div className="bg-green-600 h-2 rounded-full" style={{ width: '22%' }}></div>
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between mb-1">
                          <span className="text-sm text-gray-600">Viper</span>
                          <span className="text-sm font-medium text-gray-900">14%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div className="bg-green-600 h-2 rounded-full" style={{ width: '14%' }}></div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-white rounded-lg shadow-md p-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h3>
                    <div className="space-y-3">
                      <button className="w-full flex items-center justify-center bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Add Alert Zone
                      </button>
                      <button className="w-full flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Export Map Data
                      </button>
                      <button className="w-full flex items-center justify-center border border-gray-300 text-gray-700 py-2 px-4 rounded hover:bg-gray-50 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        View Safety Tips
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}