"use client";

import { useEffect, useState, useCallback } from "react";
import Header from "@/components/ui/header";
import Sidebar from "@/components/ui/sidebar";
import DetectionCard from "@/components/ui/detection-card";
import LocationFilter from "@/components/ui/location-filter";
import { supabase } from "@/lib/supabase";
import { SnakeDetection } from "@/types";
import { calculateDistance } from "@/lib/utils";
import { Download, FileText, Loader2, Search, ChevronLeft, ChevronRight } from "lucide-react";

export default function DetectionsPage() {
  const [loading, setLoading] = useState(true);
  const [detections, setDetections] = useState<SnakeDetection[]>([]);
  const [filter, setFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [userLocation, setUserLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [locationPermissionGranted, setLocationPermissionGranted] =
    useState(false);
  const [selectedRadius, setSelectedRadius] = useState<number>(50);
  const [exporting, setExporting] = useState(false);
  const itemsPerPage = 15;

  useEffect(() => {
    fetchDetections();
  }, [filter]); 

  const fetchDetections = async () => {
    setLoading(true);

    let query = supabase
      .from("snake_detections")
      .select("*")
      .order("timestamp", { ascending: false });

    if (filter === "high") {
      query = query.gte("confidence", 0.7);
    } else if (filter === "low") {
      query = query.lt("confidence", 0.7);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching detections:", error);
    } else {
      setDetections(data as SnakeDetection[]);
    }

    setLoading(false);
  };

  const handleRadiusChange = useCallback((radius: number) => {
    setSelectedRadius(radius);
    setPage(1);
  }, []); 

  const handleLocationPermission = useCallback(
    (granted: boolean, coords?: { lat: number; lng: number }) => {
      setLocationPermissionGranted(granted);
      if (granted && coords) {
        setUserLocation(coords);
      } else {
        setUserLocation(null);
      }
    },
    []
  );

  const handleExport = async (format: 'csv' | 'pdf') => {
    try {
      setExporting(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        alert('Please log in to export data');
        return;
      }

      const params = new URLSearchParams();
      params.set('format', format);

      const headers: HeadersInit = {
        'Authorization': `Bearer ${session.access_token}`,
      };

      const response = await fetch(`/api/export/detections?${params.toString()}`, {
        headers,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Export failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = response.headers.get('Content-Disposition')?.split('filename=')[1]?.replace(/"/g, '') || `detections.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error('Export error:', error);
      alert(`Failed to export: ${error.message}`);
    } finally {
      setExporting(false);
    }
  };


  const filteredDetections = detections.filter((detection) => {
    const matchesSearch = !searchTerm
      ? true
      : (detection.species &&
          detection.species.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (detection.notes &&
          detection.notes.toLowerCase().includes(searchTerm.toLowerCase())) ||
        new Date(detection.timestamp)
          .toLocaleString()
          .toLowerCase()
          .includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    if (locationPermissionGranted && userLocation && selectedRadius > 0) {
      if (detection.latitude == null || detection.longitude == null)
        return false;

      const distance = calculateDistance(
        userLocation.lat,
        userLocation.lng,
        detection.latitude,
        detection.longitude
      );

      return distance <= selectedRadius;
    }

    return true;
  });

  const totalPages = Math.ceil(filteredDetections.length / itemsPerPage);
  const paginatedDetections = filteredDetections.slice(
    (page - 1) * itemsPerPage,
    page * itemsPerPage
  );

  const filterOptions = [
    { label: 'All', value: 'all' },
    { label: 'High Confidence', value: 'high' },
    { label: 'Low Confidence', value: 'low' },
  ];

  // Generate smart page numbers
  const getPageNumbers = () => {
    const pages: (number | 'ellipsis')[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (page > 3) pages.push('ellipsis');
      for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) {
        pages.push(i);
      }
      if (page < totalPages - 2) pages.push('ellipsis');
      pages.push(totalPages);
    }
    return pages;
  };

  return (
    <div className="flex h-screen bg-[#f7f8fa]">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto px-4 md:px-6 py-5">
            {/* Page Title */}
            <div className="section-fade-up mb-6">
              <h1 className="text-xl font-bold text-gray-900 tracking-tight">
                Snake Detections
              </h1>
            </div>

            {/* Filter Bar */}
            <div className="section-fade-up flex flex-col gap-4 mb-6" style={{ animationDelay: '100ms' }}>
              {/* Row 1: Search + Location + Radius */}
              <div className="flex flex-col md:flex-row items-start md:items-center gap-3">
                {/* Search */}
                <div className="relative w-full md:w-72">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search detections..."
                    className="pl-10 pr-4 py-2 w-full bg-white border border-gray-200 rounded-xl text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition-all duration-200"
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setPage(1);
                    }}
                  />
                </div>

                {/* Location + Radius */}
                <LocationFilter
                  onLocationPermission={handleLocationPermission}
                  onRadiusChange={handleRadiusChange}
                />

                {/* Spacer */}
                <div className="hidden md:block flex-1" />

                {/* Confidence Filters */}
                <div className="flex items-center bg-white border border-gray-200 rounded-xl overflow-hidden">
                  {filterOptions.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => {
                        setFilter(opt.value);
                        setPage(1);
                      }}
                      className={`px-4 py-2 text-xs font-medium transition-all duration-200 whitespace-nowrap ${
                        filter === opt.value
                          ? 'bg-gray-900 text-white'
                          : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {loading ? (
              /* Skeleton loader */
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                {Array.from({ length: 10 }).map((_, i) => (
                  <div key={i} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                    <div className="aspect-[4/3] skeleton-shimmer" />
                    <div className="p-4">
                      <div className="skeleton-shimmer w-3/4 h-4 rounded-lg mb-2" />
                      <div className="skeleton-shimmer w-1/2 h-3 rounded mb-2" />
                      <div className="skeleton-shimmer w-2/5 h-3 rounded mb-3" />
                      <div className="flex gap-2 pt-3 border-t border-gray-100">
                        <div className="skeleton-shimmer flex-1 h-8 rounded-xl" />
                        <div className="skeleton-shimmer flex-1 h-8 rounded-xl" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <>
                {filteredDetections.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center section-fade-up">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-14 w-14 text-gray-200 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <h3 className="text-base font-semibold text-gray-900 mb-1">
                      No detections found
                    </h3>
                    <p className="text-sm text-gray-400 max-w-sm mx-auto">
                      {locationPermissionGranted &&
                      userLocation &&
                      selectedRadius > 0
                        ? `No snake detections found within ${selectedRadius} km of your location.`
                        : "Try adjusting your search or filter criteria."}
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Results info + export */}
                    <div className="flex items-center justify-between mb-4 section-fade-up" style={{ animationDelay: '150ms' }}>
                      <p className="text-sm text-gray-500">
                        {locationPermissionGranted &&
                        userLocation &&
                        selectedRadius > 0
                          ? `Showing ${filteredDetections.length} ${
                              filteredDetections.length === 1
                                ? "detection"
                                : "detections"
                            } within ${selectedRadius} km`
                          : `${filteredDetections.length} ${
                              filteredDetections.length === 1
                                ? "detection"
                                : "detections"
                            } found`}
                      </p>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleExport('csv')}
                          disabled={exporting}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-500 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Export as CSV"
                        >
                          {exporting ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Download className="h-3.5 w-3.5" />
                          )}
                          CSV
                        </button>
                        <button
                          onClick={() => handleExport('pdf')}
                          disabled={exporting}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-500 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Export as PDF"
                        >
                          {exporting ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <FileText className="h-3.5 w-3.5" />
                          )}
                          PDF
                        </button>
                      </div>
                    </div>

                    {/* Detection Cards Grid — 5 columns on xl to match reference */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 items-stretch">
                      {paginatedDetections.map((detection, index) => (
                        <div
                          key={detection.id}
                          className="detection-card-enter"
                          style={{ animationDelay: `${200 + index * 50}ms` }}
                        >
                          <DetectionCard
                            detection={detection}
                            userLocation={userLocation}
                          />
                        </div>
                      ))}
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                      <div className="mt-8 flex justify-center items-center gap-1 section-fade-up" style={{ animationDelay: '300ms' }}>
                        <button
                          onClick={() => setPage((p) => Math.max(p - 1, 1))}
                          disabled={page === 1}
                          className={`inline-flex items-center justify-center w-9 h-9 rounded-xl text-sm font-medium transition-all duration-200 ${
                            page === 1
                              ? "text-gray-300 cursor-not-allowed"
                              : "text-gray-500 hover:bg-gray-100 active:scale-95"
                          }`}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </button>

                        {getPageNumbers().map((pageNum, i) => 
                          pageNum === 'ellipsis' ? (
                            <span key={`ellipsis-${i}`} className="w-9 h-9 flex items-center justify-center text-gray-400 text-sm">
                              ···
                            </span>
                          ) : (
                            <button
                              key={pageNum}
                              onClick={() => setPage(pageNum)}
                              className={`inline-flex items-center justify-center w-9 h-9 rounded-xl text-sm font-medium transition-all duration-200 ${
                                page === pageNum
                                  ? "bg-gray-900 text-white shadow-sm"
                                  : "text-gray-500 hover:bg-gray-100 active:scale-95"
                              }`}
                            >
                              {pageNum}
                            </button>
                          )
                        )}

                        <button
                          onClick={() =>
                            setPage((p) => Math.min(p + 1, totalPages))
                          }
                          disabled={page === totalPages}
                          className={`inline-flex items-center justify-center w-9 h-9 rounded-xl text-sm font-medium transition-all duration-200 ${
                            page === totalPages
                              ? "text-gray-300 cursor-not-allowed"
                              : "text-gray-500 hover:bg-gray-100 active:scale-95"
                          }`}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
