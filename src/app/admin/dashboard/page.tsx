// src/app/admin/dashboard/page.tsx

"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  BarChart3,
  Clipboard,
  AlertTriangle,
  Users,
  MapPin,
  Activity,
  TrendingUp,
  Shield,
} from "lucide-react";
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
        // Fetch stats using count queries (much faster) - run in parallel
        const [
          totalResult,
          pendingResult,
          capturedResult,
          falseAlarmResult,
          usersResult,
          recentResult
        ] = await Promise.all([
          // Total detections count
          supabase
            .from("snake_detections")
            .select("*", { count: 'exact', head: true }),
          
          // Pending review count
          supabase
            .from("snake_detections")
            .select("*", { count: 'exact', head: true })
            .eq("status", "pending"),
          
          // Captured count
          supabase
            .from("snake_detections")
            .select("*", { count: 'exact', head: true })
            .eq("status", "captured"),
          
          // False alarms count
          supabase
            .from("snake_detections")
            .select("*", { count: 'exact', head: true })
            .eq("status", "false_alarm"),
          
          // Total users count (using user_profiles table)
          supabase
            .from("user_profiles")
            .select("*", { count: 'exact', head: true }),
          
          // Recent detections (only fetch 5 most recent)
          supabase
            .from("snake_detections")
            .select("id, image_url, species, timestamp, updated_at, status")
            .order("updated_at", { ascending: false })
            .limit(5)
        ]);
        
        setStats({
          totalDetections: totalResult.count || 0,
          pendingReview: pendingResult.count || 0,
          capturedSnakes: capturedResult.count || 0,
          falseAlarms: falseAlarmResult.count || 0,
          totalUsers: usersResult.count || 0,
        });
        
        setRecentDetections(recentResult.data || []);
        
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
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-green-700 via-emerald-600 to-green-500 px-6 py-10 text-white shadow-lg">
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-green-100/90">
              Command Center
            </p>
            <h1 className="mt-2 text-3xl font-bold leading-tight">
              Operational Dashboard
            </h1>
            <p className="mt-3 text-green-50 max-w-xl">
              Live overview of detections, response workload, and team performance. Stay ahead of
              critical incidents with real-time intelligence.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/admin/detections"
                className="inline-flex items-center rounded-full bg-white/10 px-4 py-2 text-sm font-medium hover:bg-white/20"
              >
                <MapPin className="mr-2 h-4 w-4" />
                View Detections
              </Link>
              <Link
                href="/admin/settings"
                className="inline-flex items-center rounded-full bg-white text-green-700 px-4 py-2 text-sm font-semibold shadow hover:bg-green-50"
              >
                <Shield className="mr-2 h-4 w-4" />
                Manage Playbooks
              </Link>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl bg-white/10 backdrop-blur px-4 py-3 border border-white/40">
              <div className="flex items-center justify-between text-sm text-green-100">
                <span>System Health</span>
                <span className="flex items-center space-x-1">
                  <TrendingUp className="h-3.5 w-3.5" />
                  <span>Optimal</span>
                </span>
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <div>
                  <p className="text-3xl font-semibold">{stats.totalDetections}</p>
                  <p className="text-xs text-green-50 uppercase tracking-widest">
                    Total detections tracked
                  </p>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20">
                    <Activity className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-xs text-green-100/80">Live feed</p>
                    <p className="text-sm font-semibold text-white">Online</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-2xl bg-white/10 backdrop-blur px-4 py-3 border border-white/30">
                <p className="text-xs uppercase tracking-widest text-green-100/80">
                  Pending review
                </p>
                <p className="mt-2 text-2xl font-semibold">{stats.pendingReview}</p>
                <span className="text-xs text-green-100/70">Across all districts</span>
              </div>
              <div className="rounded-2xl bg-white/10 backdrop-blur px-4 py-3 border border-white/30">
                <p className="text-xs uppercase tracking-widest text-green-100/80">
                  Capture Success
                </p>
                <p className="mt-2 text-2xl font-semibold">{stats.capturedSnakes}</p>
                <span className="text-xs text-green-100/70">Incidents resolved</span>
              </div>
            </div>
          </div>
        </div>
        <div className="pointer-events-none absolute -right-28 -top-16 h-64 w-64 rounded-full bg-white/15 blur-3xl"></div>
      </section>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Total Detections"
          value={stats.totalDetections}
          icon={<BarChart3 className="h-5 w-5 text-white" />}
          accent="from-green-500 to-emerald-500"
          footer="View all incidents"
          href="/admin/detections"
        />
        <StatCard
          title="Pending Review"
          value={stats.pendingReview}
          icon={<AlertTriangle className="h-5 w-5 text-white" />}
          accent="from-amber-500 to-orange-500"
          footer="Review queue"
          href="/admin/detections?status=pending"
        />
        <StatCard
          title="Captured Snakes"
          value={stats.capturedSnakes}
          icon={<Clipboard className="h-5 w-5 text-white" />}
          accent="from-emerald-500 to-lime-500"
          footer="Completed incidents"
          href="/admin/detections?status=captured"
        />
        <StatCard
          title="Active Users"
          value={stats.totalUsers}
          icon={<Users className="h-5 w-5 text-white" />}
          accent="from-sky-500 to-indigo-500"
          footer="Manage teams"
          href="/admin/users"
        />
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[2fr,1fr]">
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm">
          <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-gray-400">Recent detections</p>
              <h3 className="text-lg font-semibold text-gray-900">Live incident feed</h3>
              <p className="text-sm text-gray-500">
                Latest detections across the network, auto-refreshed.
              </p>
            </div>
            <Link
              href="/admin/detections"
              className="inline-flex items-center rounded-full border border-gray-200 px-4 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              View all →
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Image
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Species
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Timestamp
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
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
                        <div className="h-12 w-12 rounded-2xl overflow-hidden bg-gray-100">
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
                        {formatDate(detection.timestamp || detection.updated_at)}
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
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5">
            <h3 className="text-base font-semibold text-gray-900">Live Activity</h3>
            <p className="text-sm text-gray-500">
              Snapshot of the last 5 classified detections, showing status progression.
            </p>
            <div className="mt-4 space-y-4">
              {recentDetections.slice(0, 5).map((item) => (
                <div key={item.id} className="flex items-start space-x-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-green-50 text-green-600">
                    <Activity className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">
                      {item.species || "Unknown species"}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatDate(item.timestamp || item.updated_at)}
                    </p>
                  </div>
                  <span
                    className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      statusColors[item.status as keyof typeof statusColors] ||
                      "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {item.status}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5">
            <h3 className="text-base font-semibold text-gray-900">Responder Network</h3>
            <p className="text-sm text-gray-500 mb-4">
              Quick snapshot of your active operations and teams online.
            </p>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-3xl font-semibold text-gray-900">{stats.totalUsers}</p>
                <p className="text-xs text-gray-500 uppercase tracking-widest">
                  Registered responders
                </p>
              </div>
              <Link
                href="/admin/users"
                className="inline-flex items-center rounded-full border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Manage team →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface StatCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  accent: string;
  footer: string;
  href: string;
}

function StatCard({ title, value, icon, accent, footer, href }: StatCardProps) {
  return (
    <Link
      href={href}
      className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="mt-2 text-3xl font-semibold text-gray-900">{value}</p>
        </div>
        <div
          className={`h-12 w-12 rounded-2xl bg-gradient-to-br ${accent} flex items-center justify-center shadow-lg`}
        >
          {icon}
        </div>
      </div>
      <p className="mt-4 text-sm font-semibold text-green-600">{footer} →</p>
    </Link>
  );
}