// src/app/admin/dashboard/page.tsx

"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { BarChart3, Clipboard, AlertTriangle, Users, MapPin } from "lucide-react";
import Link from "next/link";

interface DashboardStats {
  totalDetections: number;
  pendingReview: number;
  capturedSnakes: number;
  falseAlarms: number;
  totalUsers: number;
}

export default function AdminDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    totalDetections: 0,
    pendingReview: 0,
    capturedSnakes: 0,
    falseAlarms: 0,
    totalUsers: 0,
  });
  const [recentDetections, setRecentDetections] = useState<any[]>([]);
  const [debugInfo, setDebugInfo] = useState<string>("");

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        console.log("Supabase client:", supabase);
        
        console.log("Testing basic query...");
        const testQuery = await supabase.from("snake_detections").select("id").limit(1);
        console.log("Test query result:", testQuery);
        
        if (testQuery.error) {
          console.error("Basic query failed:", testQuery.error);
          setDebugInfo(`Connection error: ${JSON.stringify(testQuery.error)}`);
          setLoading(false);
          return;
        }
        
        const { data: allDetections, error: detectionsError } = await supabase
          .from("snake_detections")
          .select("*");
          
        if (detectionsError) {
          console.error("Error fetching all detections:", detectionsError);
          setDebugInfo(`Detections error: ${JSON.stringify(detectionsError)}`);
          setLoading(false);
          return;
        }
        
        const { data: usersData, error: usersError } = await supabase
          .from("users")
          .select("*");
          
        if (usersError) {
          console.error("Error fetching users:", usersError);
        }
        
        const pendingCount = allDetections?.filter(d => d.status === "pending").length || 0;
        const capturedCount = allDetections?.filter(d => d.status === "captured").length || 0;
        const falseAlarmCount = allDetections?.filter(d => d.status === "false_alarm").length || 0;
        const totalCount = allDetections?.length || 0;
        
        const recentData = allDetections
          ?.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, 5) || [];

        console.log("Detections retrieved:", allDetections?.length);
        console.log("Users retrieved:", usersData?.length);
        
        setStats({
          totalDetections: totalCount,
          pendingReview: pendingCount,
          capturedSnakes: capturedCount,
          falseAlarms: falseAlarmCount,
          totalUsers: usersData?.length || 0,
        });
        
        setRecentDetections(recentData);
        
      } catch (error) {
        console.error("Unexpected error in fetchDashboardData:", error);
        setDebugInfo(`Unexpected error: ${JSON.stringify(error)}`);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const formatDate = (dateString: string) => {
    if (!dateString) return "N/A";
    
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "Invalid Date";
    
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
    });
  };

  const statusColors = {
    pending: "bg-yellow-100 text-yellow-800",
    reviewed: "bg-blue-100 text-blue-800",
    captured: "bg-green-100 text-green-800",
    false_alarm: "bg-gray-100 text-gray-800",
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-600"></div>
      </div>
    );
  }

  if (debugInfo) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
        <h2 className="text-xl font-semibold text-red-800 mb-4">Dashboard Error</h2>
        <p className="mb-4">There was a problem loading the dashboard data. Technical details:</p>
        <pre className="bg-white p-4 rounded border border-red-200 overflow-auto text-sm">
          {debugInfo}
        </pre>
        <p className="mt-4">
          Please check your database connection and schema. If the error persists, contact technical support.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="pb-5 border-b border-gray-200 mb-6">
        <h1 className="text-2xl font-bold leading-tight text-gray-900">Dashboard</h1>
        <p className="mt-2 max-w-4xl text-sm text-gray-500">
          Overview of snake detection system activity and statistics.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-green-100 rounded-md p-3">
                <BarChart3 className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Total Detections</dt>
                  <dd>
                    <div className="text-lg font-medium text-gray-900">{stats.totalDetections}</div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
          <div className="bg-gray-50 px-5 py-3">
            <div className="text-sm">
              <Link
                href="/admin/detections"
                className="font-medium text-green-700 hover:text-green-900"
              >
                View all
              </Link>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-yellow-100 rounded-md p-3">
                <AlertTriangle className="h-6 w-6 text-yellow-600" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Pending Review</dt>
                  <dd>
                    <div className="text-lg font-medium text-gray-900">{stats.pendingReview}</div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
          <div className="bg-gray-50 px-5 py-3">
            <div className="text-sm">
              <Link
                href="/admin/detections?status=pending"
                className="font-medium text-green-700 hover:text-green-900"
              >
                View pending
              </Link>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-green-100 rounded-md p-3">
                <Clipboard className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Captured Snakes</dt>
                  <dd>
                    <div className="text-lg font-medium text-gray-900">{stats.capturedSnakes}</div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
          <div className="bg-gray-50 px-5 py-3">
            <div className="text-sm">
              <Link
                href="/admin/detections?status=captured"
                className="font-medium text-green-700 hover:text-green-900"
              >
                View captured
              </Link>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-blue-100 rounded-md p-3">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Total Users</dt>
                  <dd>
                    <div className="text-lg font-medium text-gray-900">{stats.totalUsers}</div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
          <div className="bg-gray-50 px-5 py-3">
            <div className="text-sm">
              <Link
                href="/admin/users"
                className="font-medium text-green-700 hover:text-green-900"
              >
                View users
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Detections */}
      <div className="bg-white shadow rounded-lg mb-6">
        <div className="px-4 py-5 border-b border-gray-200 sm:px-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900">Recent Detections</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  ID
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Image
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Species
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Timestamp
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Status
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {recentDetections.length > 0 ? (
                recentDetections.map((detection) => (
                  <tr key={detection.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {detection.id && typeof detection.id === 'string' 
                        ? detection.id.substring(0, 8) + '...'
                        : 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="h-12 w-12 rounded overflow-hidden bg-gray-100">
                        {detection.image_url && (
                          <img
                            src={detection.image_url}
                            alt="Snake detection"
                            className="h-full w-full object-cover"
                          />
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {detection.species || "Unknown Species"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(detection.timestamp || detection.created_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          statusColors[detection.status as keyof typeof statusColors] ||
                          "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {detection.status
                          ? detection.status.replace("_", " ").charAt(0).toUpperCase() +
                            detection.status.replace("_", " ").slice(1)
                          : "Pending"}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <Link
                        href={`/admin/detections/${detection.id}`}
                        className="text-green-600 hover:text-green-900"
                      >
                        View Details
                      </Link>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-4 text-center text-sm text-gray-500">
                    No recent detections found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="bg-gray-50 px-4 py-4 sm:px-6">
          <div className="text-sm">
            <Link
              href="/admin/detections"
              className="font-medium text-green-700 hover:text-green-900"
            >
              View all detections
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}