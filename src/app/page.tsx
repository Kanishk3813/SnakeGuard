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

function ActivityFeedItem({ detection, index }: { detection: SnakeDetection; index: number }) {
  const riskColors: Record<string, string> = {
    critical: 'bg-red-500',
    high: 'bg-orange-500',
    medium: 'bg-amber-500',
    low: 'bg-emerald-500',
  };
  const dotColor = riskColors[detection.risk_level || 'low'] || 'bg-emerald-500';

  return (
    <div
      className="feed-item-enter flex items-start gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors duration-200 cursor-pointer group"
      style={{ animationDelay: `${index * 60 + 300}ms` }}
    >
      <div className="relative flex-shrink-0 mt-0.5">
        <div className={`w-2.5 h-2.5 ${dotColor} rounded-full`} />
        {index === 0 && (
          <div className={`absolute inset-0 w-2.5 h-2.5 ${dotColor} rounded-full animate-ping opacity-50`} />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium text-gray-900 truncate">
            {detection.species || 'New snake detected'}
          </p>
          <button className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-1 rounded-lg hover:bg-gray-100">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-0.5">
          {new Date(detection.timestamp).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })}{' '}
          · {new Date(detection.timestamp).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
        <p className="text-xs text-gray-400 mt-0.5">
          Confidence: {(detection.confidence * 100).toFixed(1)}%
        </p>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="max-w-7xl mx-auto">
      {/* Stats skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white rounded-2xl p-5 border border-gray-100">
            <div className="skeleton-shimmer w-10 h-10 rounded-xl mb-3" />
            <div className="skeleton-shimmer w-16 h-7 rounded-lg mb-2" />
            <div className="skeleton-shimmer w-24 h-3 rounded" />
          </div>
        ))}
      </div>
      {/* Chart skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 p-5">
          <div className="skeleton-shimmer w-48 h-5 rounded-lg mb-4" />
          <div className="skeleton-shimmer w-full h-64 rounded-xl" />
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="skeleton-shimmer w-28 h-5 rounded-lg mb-4" />
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-start gap-3 mb-4">
              <div className="skeleton-shimmer w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1.5" />
              <div className="flex-1">
                <div className="skeleton-shimmer w-3/4 h-3.5 rounded mb-1.5" />
                <div className="skeleton-shimmer w-1/2 h-3 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

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
    <div className="flex h-screen bg-[#f7f8fa]">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto px-4 md:px-6 py-5">
            {/* Page Header */}
            <div className="section-fade-up flex flex-col md:flex-row md:items-center md:justify-between mb-6">
              <div className="mb-4 md:mb-0">
                <h1 className="text-xl font-bold text-gray-900 tracking-tight">
                  Dashboard
                </h1>
                <p className="text-sm text-gray-400 mt-0.5">
                  Real-time monitoring and analytics
                </p>
              </div>
              <div className="flex items-center gap-2">
                <select 
                  className="bg-white border border-gray-200 text-gray-600 py-2 px-3 pr-8 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition-all appearance-none cursor-pointer"
                  value={selectedArea} 
                  onChange={handleAreaChange}
                  style={{
                    backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%239ca3af' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                    backgroundPosition: 'right 0.5rem center',
                    backgroundRepeat: 'no-repeat',
                    backgroundSize: '1.25em 1.25em',
                  }}
                >
                  <option>All Areas</option>
                  <option>North Campus</option>
                  <option>South Campus</option>
                  <option>East Campus</option>
                </select>
                <button 
                  className="bg-emerald-600 hover:bg-emerald-700 text-white py-2 px-4 rounded-xl text-sm font-medium transition-all duration-200 active:scale-95 shadow-sm shadow-emerald-200"
                  onClick={handleFilterClick}
                >
                  Filter
                </button>
              </div>
            </div>
            
            {loading ? (
              <LoadingSkeleton />
            ) : (
              <>
                {/* Stats Cards */}
                <div className="mb-6">
                  <DashboardStats stats={stats} />
                </div>

                {/* Chart + Activity Feed */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
                  <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 overflow-hidden section-fade-up" style={{ animationDelay: '200ms' }}>
                    <TimeSeriesChart 
                      data={timeSeriesData} 
                      title="Snake Detections Over Time" 
                    />
                  </div>
                  
                  {/* Activity Feed */}
                  <div className="bg-white rounded-2xl border border-gray-100 flex flex-col section-fade-up" style={{ animationDelay: '300ms' }}>
                    <div className="px-5 pt-5 pb-3 flex items-center justify-between">
                      <h3 className="text-base font-semibold text-gray-900">Activity Feed</h3>
                      <span className="text-[11px] font-medium text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">
                        Live
                      </span>
                    </div>
                    <div className="flex-1 overflow-y-auto px-2 pb-3 max-h-[340px]">
                      {detections.length > 0 ? (
                        detections.slice(0, 6).map((detection, index) => (
                          <ActivityFeedItem key={detection.id} detection={detection} index={index} />
                        ))
                      ) : (
                        <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 mb-2 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                          </svg>
                          <p className="text-sm">No recent activity</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Recent Detections */}
                <div className="section-fade-up" style={{ animationDelay: '400ms' }}>
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-base font-semibold text-gray-900">Recent Detections</h2>
                    <a 
                      href="/detections" 
                      className="text-emerald-600 hover:text-emerald-700 text-sm font-medium flex items-center gap-1 group transition-colors"
                    >
                      View All
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </a>
                  </div>
                  {detections.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {detections.slice(0, 6).map((detection, index) => (
                        <div
                          key={detection.id}
                          className="detection-card-enter"
                          style={{ animationDelay: `${500 + index * 80}ms` }}
                        >
                          <DetectionCard detection={detection} />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-200 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <p className="text-gray-400 text-sm">No detection data available</p>
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