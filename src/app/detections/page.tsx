"use client";

import { useEffect, useState, useCallback } from "react";
import Header from "@/components/ui/header";
import Sidebar from "@/components/ui/sidebar";
import DetectionCard from "@/components/ui/detection-card";
import LocationFilter from "@/components/ui/location-filter";
import { supabase } from "@/lib/supabase";
import { SnakeDetection } from "@/types";
import { calculateDistance } from "@/lib/utils";

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
  const itemsPerPage = 12;

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

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-7xl mx-auto">
            <h1 className="text-2xl font-bold text-gray-900 mb-8">
              Snake Detections
            </h1>

            <div className="flex flex-col md:flex-row items-center justify-between mb-6 gap-4">
              <div className="w-full md:w-1/2 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5 text-gray-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                </div>
                <input
                  type="text"
                  placeholder="Search detections..."
                  className="pl-10 w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <div className="flex w-full md:w-auto">
                <button
                  onClick={() => setFilter("all")}
                  className={`px-4 py-2 rounded-l-lg ${
                    filter === "all"
                      ? "bg-green-600 text-white"
                      : "bg-white text-gray-700 border border-gray-300"
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setFilter("high")}
                  className={`px-4 py-2 ${
                    filter === "high"
                      ? "bg-green-600 text-white"
                      : "bg-white text-gray-700 border-t border-b border-gray-300"
                  }`}
                >
                  High Confidence
                </button>
                <button
                  onClick={() => setFilter("low")}
                  className={`px-4 py-2 rounded-r-lg ${
                    filter === "low"
                      ? "bg-green-600 text-white"
                      : "bg-white text-gray-700 border border-gray-300"
                  }`}
                >
                  Low Confidence
                </button>
              </div>
            </div>

            <LocationFilter
              onLocationPermission={handleLocationPermission}
              onRadiusChange={handleRadiusChange}
            />

            {loading ? (
              <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-600"></div>
              </div>
            ) : (
              <>
                {filteredDetections.length === 0 ? (
                  <div className="bg-white rounded-lg shadow-md p-6 text-center">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-12 w-12 text-gray-400 mx-auto mb-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1}
                        d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <h3 className="text-lg font-medium text-gray-900">
                      No detections found
                    </h3>
                    <p className="text-gray-500 mt-2">
                      {locationPermissionGranted &&
                      userLocation &&
                      selectedRadius > 0
                        ? `No snake detections found within ${selectedRadius} km of your location.`
                        : "Try adjusting your search or filter criteria."}
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between items-center mb-4">
                      <p className="text-sm text-gray-600">
                        {locationPermissionGranted &&
                        userLocation &&
                        selectedRadius > 0
                          ? `Showing ${filteredDetections.length} ${
                              filteredDetections.length === 1
                                ? "detection"
                                : "detections"
                            } within ${selectedRadius} km of your location`
                          : `Showing ${filteredDetections.length} ${
                              filteredDetections.length === 1
                                ? "detection"
                                : "detections"
                            }`}
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 items-stretch">
                      {paginatedDetections.map((detection) => (
                        <DetectionCard
                          key={detection.id}
                          detection={detection}
                          userLocation={userLocation}
                        />
                      ))}
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                      <div className="mt-8 flex justify-center">
                        <nav
                          className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px"
                          aria-label="Pagination"
                        >
                          <button
                            onClick={() => setPage((p) => Math.max(p - 1, 1))}
                            disabled={page === 1}
                            className={`relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium ${
                              page === 1
                                ? "text-gray-300"
                                : "text-gray-500 hover:bg-gray-50"
                            }`}
                          >
                            <span className="sr-only">Previous</span>
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-5 w-5"
                              viewBox="0 0 20 20"
                              fill="currentColor"
                            >
                              <path
                                fillRule="evenodd"
                                d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
                                clipRule="evenodd"
                              />
                            </svg>
                          </button>

                          {Array.from(
                            { length: totalPages },
                            (_, i) => i + 1
                          ).map((pageNum) => (
                            <button
                              key={pageNum}
                              onClick={() => setPage(pageNum)}
                              className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                                page === pageNum
                                  ? "z-10 bg-green-50 border-green-500 text-green-600"
                                  : "bg-white border-gray-300 text-gray-500 hover:bg-gray-50"
                              }`}
                            >
                              {pageNum}
                            </button>
                          ))}

                          <button
                            onClick={() =>
                              setPage((p) => Math.min(p + 1, totalPages))
                            }
                            disabled={page === totalPages}
                            className={`relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium ${
                              page === totalPages
                                ? "text-gray-300"
                                : "text-gray-500 hover:bg-gray-50"
                            }`}
                          >
                            <span className="sr-only">Next</span>
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-5 w-5"
                              viewBox="0 0 20 20"
                              fill="currentColor"
                            >
                              <path
                                fillRule="evenodd"
                                d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                                clipRule="evenodd"
                              />
                            </svg>
                          </button>
                        </nav>
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
