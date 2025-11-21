"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import { formatDate } from "@/lib/utils";
import {
  AlertTriangle,
  ChevronRight,
  Search,
  Filter,
  MapPin,
  Sparkles,
} from "lucide-react";

export default function DetectionsPage() {
  const [detections, setDetections] = useState<any[]>([]);
  const [filteredDetections, setFilteredDetections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  useEffect(() => {
    const fetchDetections = async () => {
      try {
        const { data, error } = await supabase
          .from("snake_detections")
          .select("*")
          .order("updated_at", { ascending: false });

        if (error) throw error;
        setDetections(data || []);
        setFilteredDetections(data || []);
      } catch (err) {
        setError("Failed to load detections");
      } finally {
        setLoading(false);
      }
    };

    fetchDetections();
  }, []);

  useEffect(() => {
    let results = detections;

    if (statusFilter !== "all") {
      results = results.filter((d) => d.status === statusFilter);
    }

    if (searchQuery.trim()) {
      results = results.filter((d) => {
        const query = searchQuery.toLowerCase();
        return (
          d.species?.toLowerCase().includes(query) ||
          d.id?.toLowerCase().includes(query) ||
          d.status?.toLowerCase().includes(query)
        );
      });
    }

    setFilteredDetections(results);
  }, [searchQuery, statusFilter, detections]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-600"></div>
      </div>
    );
  }

  if (error) {
    return <div className="p-4 bg-red-50 text-red-700 rounded-lg">{error}</div>;
  }

  return (
    <div className="space-y-10">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-emerald-600 to-green-500 px-6 py-8 text-white shadow">
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-emerald-100">Operations</p>
            <h1 className="mt-2 text-3xl font-bold leading-tight">Detections Console</h1>
            <p className="mt-3 text-emerald-50 max-w-xl">
              Monitor every incident, apply playbooks, and coordinate responses in real-time.
              Fast filters and status cues keep your team in sync.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                onClick={() => setStatusFilter("pending")}
                className="inline-flex items-center rounded-full bg-white/15 px-4 py-2 text-sm font-medium hover:bg-white/25"
              >
                <AlertTriangle className="mr-2 h-4 w-4" />
                Pending queue
              </button>
              <Link
                href="/admin/map"
                className="inline-flex items-center rounded-full bg-white text-emerald-700 px-4 py-2 text-sm font-semibold shadow hover:bg-emerald-50"
              >
                <MapPin className="mr-2 h-4 w-4" />
                Map overview
              </Link>
            </div>
          </div>
          <div className="rounded-2xl bg-white/10 backdrop-blur px-4 py-4 border border-white/30">
            <div className="flex items-center justify-between text-sm text-emerald-100">
              <span>Active detections</span>
              <span>{filteredDetections.length} currently displayed</span>
            </div>
            <div className="mt-4 rounded-2xl bg-white px-4 py-3 text-gray-900 shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm uppercase tracking-wider text-gray-500">Filter by status</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {statusFilter === "all" ? "All statuses" : statusFilter}
                  </p>
                </div>
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => setStatusFilter("all")}
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      statusFilter === "all" ? "bg-emerald-100 text-emerald-700" : "bg-gray-100"
                    }`}
                  >
                    Clear filters
                  </button>
                  <div className="rounded-full bg-emerald-50 px-4 py-1 text-xs font-semibold text-emerald-700">
                    {detections.length} total
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 items-center gap-3 rounded-2xl border border-gray-200 px-4 py-2">
            <Search className="h-4 w-4 text-gray-400" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by species, status, or detection ID..."
              className="flex-1 bg-transparent text-sm focus:outline-none"
            />
          </div>
          <div className="flex flex-wrap gap-3">
            {["all", "pending", "reviewed", "captured", "false_alarm"].map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`inline-flex items-center rounded-full border px-4 py-1.5 text-sm font-medium transition ${
                  statusFilter === status
                    ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                    : "border-gray-200 text-gray-600 hover:border-emerald-200"
                }`}
              >
                <Filter className="mr-2 h-3.5 w-3.5" />
                {status === "all" ? "All statuses" : status.replace("_", " ")}
              </button>
            ))}
          </div>
          <div className="flex rounded-full border border-gray-200 p-1">
            {(["cards", "table"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`rounded-full px-4 py-1 text-sm font-medium ${
                  viewMode === mode ? "bg-emerald-500 text-white" : "text-gray-500"
                }`}
              >
                {mode === "cards" ? "Card view" : "Table view"}
              </button>
            ))}
          </div>
        </div>

        {viewMode === "cards" ? (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {filteredDetections.map((detection) => (
              <DetectionCard key={detection.id} detection={detection} />
            ))}
            {filteredDetections.length === 0 && (
              <div className="col-span-full rounded-2xl border border-dashed border-gray-200 bg-gray-50 py-12 text-center text-gray-500">
                No detections match your filters.
              </div>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-gray-100">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 text-gray-500 uppercase tracking-wider text-xs">
                <tr>
                  <th className="px-4 py-3 text-left">ID</th>
                  <th className="px-4 py-3 text-left">Species</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Confidence</th>
                  <th className="px-4 py-3 text-left">Updated</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {filteredDetections.map((detection) => (
                  <tr key={detection.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-500">#{detection.id.slice(0, 8)}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {detection.species || "Unknown"}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={detection.status} />
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {(detection.confidence * 100).toFixed(1)}%
                    </td>
                    <td className="px-4 py-3 text-gray-500">{formatDate(detection.updated_at)}</td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/detections/${detection.id}`}
                        className="inline-flex items-center rounded-full border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:border-emerald-200"
                      >
                        View <ChevronRight className="ml-1 h-3.5 w-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))}
                {filteredDetections.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                      No detections match your filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

interface DetectionCardProps {
  detection: any;
}

function DetectionCard({ detection }: DetectionCardProps) {
  return (
    <div className="rounded-3xl border border-gray-100 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg flex flex-col">
      <div className="relative h-48 w-full overflow-hidden rounded-t-3xl bg-gray-100">
        {detection.image_url ? (
          <Image
            src={detection.image_url}
            alt={detection.species || "Snake detection"}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 33vw"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm text-gray-400">
            No image
          </div>
        )}
        <div className="absolute top-4 left-4 rounded-full bg-black/60 px-3 py-1 text-xs font-semibold text-white">
          {(detection.confidence * 100).toFixed(1)}% confidence
        </div>
      </div>
      <div className="flex flex-1 flex-col space-y-3 p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-wider text-gray-400">Species</p>
            <p className="text-lg font-semibold text-gray-900">
              {detection.species || "Unknown species"}
            </p>
          </div>
          <StatusBadge status={detection.status} />
        </div>
        <div className="text-sm text-gray-500">
          <p className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-emerald-500" />
            Detected {formatDate(detection.timestamp)}
          </p>
          <p className="mt-1 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Last updated {formatDate(detection.updated_at)}
          </p>
        </div>
        <div className="mt-auto flex items-center justify-between">
          <Link
            href={`/admin/detections/${detection.id}`}
            className="inline-flex items-center rounded-full bg-emerald-50 px-4 py-1.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-100"
          >
            View incident
            <ChevronRight className="ml-1.5 h-4 w-4" />
          </Link>
          <IndicatorChip status={detection.status} />
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800",
    reviewed: "bg-blue-100 text-blue-800",
    captured: "bg-green-100 text-green-800",
    false_alarm: "bg-gray-100 text-gray-800",
  };
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${styles[status] || "bg-gray-100 text-gray-800"}`}>
      {status.replace("_", " ")}
    </span>
  );
}

function IndicatorChip({ status }: { status: string }) {
  if (status === "captured") {
    return <span className="text-xs font-semibold text-green-600">Resolved</span>;
  }
  if (status === "pending") {
    return <span className="text-xs font-semibold text-amber-600">Awaiting review</span>;
  }
  return <span className="text-xs font-semibold text-gray-500">In progress</span>;
}
