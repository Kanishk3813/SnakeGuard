'use client';

import { SetStateAction, useEffect, useState } from 'react';
import Header from '@/components/ui/header';
import Sidebar from '@/components/ui/sidebar';
import DashboardStats from '@/components/ui/dashboard-stats';
import DetectionCard from '@/components/ui/detection-card';
import TimeSeriesChart from '@/components/ui/time-series-chart';
import { supabase } from '@/lib/supabase';
import { DashboardStats as DashboardStatsType, SnakeDetection, TimeSeriesData } from '@/types';
import { RealtimeChannel } from '@supabase/supabase-js';

export default function Home() {
  const [loading, setLoading] = useState(true);
  const [detections, setDetections] = useState<SnakeDetection[]>([]);
  const [stats, setStats] = useState<DashboardStatsType>({
    totalDetections: 0,
    recentDetections: 0,
    highConfidenceDetections: 0,
    avgConfidence: 0
  });
  const [timeSeriesData, setTimeSeriesData] = useState<TimeSeriesData[]>([]);
  const [selectedArea, setSelectedArea] = useState('All Areas');
  
  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      
      try {
        const { data: detectionData, error: detectionError } = await supabase
          .from('snake_detections')
          .select('*')
          .order('timestamp', { ascending: false })
          .limit(50);
        
        if (detectionError) {
          console.error('Error fetching detections:', detectionError);
          return;
        }
        
        if (detectionData) {
          setDetections(detectionData as SnakeDetection[]);
          
          const total = detectionData.length;
          const now = new Date();
          const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          
          const recent = detectionData.filter(d => 
            new Date(d.timestamp) > oneDayAgo
          ).length;
          
          const highConfidence = detectionData.filter(d => 
            d.confidence >= 0.7
          ).length;
          
          const avgConf = detectionData.reduce((sum, d) => 
            sum + d.confidence, 0
          ) / (total || 1);
          
          setStats({
            totalDetections: total,
            recentDetections: recent,
            highConfidenceDetections: highConfidence,
            avgConfidence: avgConf
          });
          
          const timeSeriesMap = new Map<string, number>();
          const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          
          for (let i = 0; i < 7; i++) {
            const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
            const dateStr = date.toISOString().split('T')[0];
            timeSeriesMap.set(dateStr, 0);
          }

          detectionData.forEach(detection => {
            const date = new Date(detection.timestamp);
            if (date > sevenDaysAgo) {
              const dateStr = date.toISOString().split('T')[0];
              const count = timeSeriesMap.get(dateStr) || 0;
              timeSeriesMap.set(dateStr, count + 1);
            }
          });
          
          const timeSeriesArray = Array.from(timeSeriesMap.entries())
            .map(([date, detections]) => ({ date, detections }))
            .sort((a, b) => a.date.localeCompare(b.date));
          
          setTimeSeriesData(timeSeriesArray);
        }
      } catch (error) {
        console.error("Failed to fetch data:", error);
      } finally {
        setLoading(false);
      }
    }
    
    fetchData();
    
    const subscription: RealtimeChannel = supabase
      .channel('public:snake_detections')
      .on(
        'postgres_changes', 
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'snake_detections' 
        }, 
        (payload: { new: SnakeDetection }) => {
          setDetections(current => [payload.new, ...current]);
          setStats(current => ({
            ...current,
            totalDetections: current.totalDetections + 1,
            recentDetections: current.recentDetections + 1,
            highConfidenceDetections: payload.new.confidence >= 0.7 
              ? current.highConfidenceDetections + 1 
              : current.highConfidenceDetections,
            avgConfidence: (current.avgConfidence * current.totalDetections + payload.new.confidence) / (current.totalDetections + 1)
          }));
          
          const today = new Date().toISOString().split('T')[0];
          setTimeSeriesData(current => {
            const todayIndex = current.findIndex(item => item.date === today);
            if (todayIndex >= 0) {
              const newData = [...current];
              newData[todayIndex] = {
                ...newData[todayIndex],
                detections: newData[todayIndex].detections + 1
              };
              return newData;
            }
            return current;
          });
        }
      )
      .subscribe();
    
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleAreaChange = (e: { target: { value: SetStateAction<string>; }; }) => {
    setSelectedArea(e.target.value);
  };

  const handleFilterClick = () => {
    console.log(`Filtering by: ${selectedArea}`);
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
              <div className="mb-4 md:mb-0">
                <h1 className="text-2xl font-bold text-gray-900">Snake Detection Dashboard</h1>
                <p className="text-sm text-gray-500">Real-time monitoring and analytics of snake detections</p>
              </div>
              <div className="flex">
                <select 
                  className="bg-white border border-gray-300 text-gray-700 py-2 px-3 rounded-l shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  value={selectedArea} 
                  onChange={handleAreaChange}
                >
                  <option>All Areas</option>
                  <option>North Campus</option>
                  <option>South Campus</option>
                  <option>East Campus</option>
                </select>
                <button 
                  className="bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-r transition-colors"
                  onClick={handleFilterClick}
                >
                  Filter
                </button>
              </div>
            </div>
            
            {loading ? (
              <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-600"></div>
              </div>
            ) : (
              <>
                <DashboardStats stats={stats} />
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6 mt-6">
                  <div className="lg:col-span-2 bg-white rounded-lg shadow-md overflow-hidden">
                    <TimeSeriesChart 
                      data={timeSeriesData} 
                      title="Snake Detections Over Time" 
                    />
                  </div>
                  <div className="bg-white rounded-lg shadow-md p-4 md:p-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Activity Feed</h3>
                    {detections.length > 0 ? (
                      detections.slice(0, 5).map((detection, index) => (
                        <div key={detection.id} className="flex items-start mb-4 last:mb-0">
                          <div className="bg-green-100 p-2 rounded-full flex-shrink-0">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </div>
                          <div className="ml-3">
                            <p className="text-sm font-medium text-gray-900">
                              New snake detected
                            </p>
                            <p className="text-xs text-gray-500">
                              {new Date(detection.timestamp).toLocaleString()}
                            </p>
                            <p className="text-xs text-gray-500">
                              Confidence: {(detection.confidence * 100).toFixed(1)}%
                            </p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-gray-500">No recent activity to display</p>
                    )}
                  </div>
                </div>
                
                <div className="mt-6">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-gray-900">Recent Detections</h2>
                    <a href="/detections" className="text-green-600 hover:text-green-800 text-sm font-medium flex items-center">
                      View All
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </a>
                  </div>
                  {detections.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                      {detections.slice(0, 6).map((detection) => (
                        <DetectionCard key={detection.id} detection={detection} />
                      ))}
                    </div>
                  ) : (
                    <div className="bg-white rounded-lg shadow-md p-6 text-center">
                      <p className="text-gray-500">No detection data available</p>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}