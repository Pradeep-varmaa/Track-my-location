"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Circle,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { LiveVisitor, LiveTrackingResponse } from "@/lib/types/tracking";

// ============================================================
// Configuration
// ============================================================

const POLL_INTERVAL_MS = 15_000; // Poll every 15 seconds
const DEFAULT_CENTER: [number, number] = [28.6139, 77.209]; // Delhi fallback
const DEFAULT_ZOOM = 16;

// ============================================================
// Custom Marker Icons
// ============================================================

function createVisitorIcon(isAlert: boolean): L.DivIcon {
  const color = isAlert ? "#ef4444" : "#22c55e"; // red for alerts, green for normal
  const pulseClass = isAlert ? "animate-pulse" : "";

  return L.divIcon({
    className: "",
    html: `
      <div class="${pulseClass}" style="
        width: 24px;
        height: 24px;
        background: ${color};
        border: 3px solid white;
        border-radius: 50%;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
      "></div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

// ============================================================
// Auto-fit bounds helper component
// ============================================================

function FitBounds({ visitors }: { visitors: LiveVisitor[] }) {
  const map = useMap();

  useEffect(() => {
    if (visitors.length === 0) return;

    const bounds = L.latLngBounds(
      visitors.map((v) => [v.latitude, v.longitude] as [number, number])
    );
    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 18 });
  }, [visitors, map]);

  return null;
}

// ============================================================
// Visitor Marker Component
// ============================================================

function VisitorMarker({ visitor }: { visitor: LiveVisitor }) {
  const icon = createVisitorIcon(visitor.has_geofence_alert);
  const lastPing = new Date(visitor.last_ping);
  const timeAgo = getTimeAgo(lastPing);

  return (
    <Marker
      position={[visitor.latitude, visitor.longitude]}
      icon={icon}
    >
      <Popup>
        <div className="p-1 min-w-[180px]">
          <div className="font-semibold text-sm">{visitor.visitor_name}</div>
          <div className="text-xs text-gray-500 mt-1">
            Last ping: {timeAgo}
          </div>
          <div className="text-xs text-gray-400">
            Accuracy: ±{visitor.accuracy_meters.toFixed(0)}m
          </div>
          {visitor.has_geofence_alert && (
            <div className="mt-2 px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded">
              ⚠ {formatAlertType(visitor.active_alert_type)}
            </div>
          )}
          <div className="text-[10px] text-gray-400 mt-1">
            rv_id: {visitor.rv_id.slice(0, 8)}…
          </div>
        </div>
      </Popup>
      {/* Geofence breach indicator ring */}
      {visitor.has_geofence_alert && (
        <Circle
          center={[visitor.latitude, visitor.longitude]}
          radius={50}
          pathOptions={{
            color: "#ef4444",
            fillColor: "#ef4444",
            fillOpacity: 0.1,
            weight: 1,
          }}
        />
      )}
    </Marker>
  );
}

// ============================================================
// Main Live Map Page
// ============================================================

export default function AdminTrackingPage() {
  const [visitors, setVisitors] = useState<LiveVisitor[]>([]);
  const [updatedAt, setUpdatedAt] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch live tracking data
  const fetchLive = useCallback(async () => {
    try {
      const res = await fetch("/api/tracking/live");
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data: LiveTrackingResponse = await res.json();
      setVisitors(data.visitors);
      setUpdatedAt(data.updated_at);
      setError(null);
    } catch (err) {
      setError(`Failed to fetch live data: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }, []);

  // Initial fetch + polling
  useEffect(() => {
    fetchLive();

    if (isPolling) {
      intervalRef.current = setInterval(fetchLive, POLL_INTERVAL_MS);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [fetchLive, isPolling]);

  // Toggle polling
  const togglePolling = () => {
    setIsPolling((prev) => !prev);
  };

  const alertCount = visitors.filter((v) => v.has_geofence_alert).length;

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header className="bg-white border-b px-4 py-3 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-lg font-semibold">Live Visitor Tracking</h1>
          <p className="text-xs text-gray-500">
            {visitors.length} active visitor{visitors.length !== 1 ? "s" : ""}
            {alertCount > 0 && (
              <span className="ml-2 text-red-600 font-medium">
                ⚠ {alertCount} geofence alert{alertCount !== 1 ? "s" : ""}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400">
            {updatedAt && `Updated ${getTimeAgo(new Date(updatedAt))}`}
          </span>
          <button
            onClick={togglePolling}
            className={`px-3 py-1 text-xs rounded font-medium transition-colors ${
              isPolling
                ? "bg-green-100 text-green-700 hover:bg-green-200"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {isPolling ? "● Live" : "○ Paused"}
          </button>
          <button
            onClick={fetchLive}
            className="px-3 py-1 text-xs rounded bg-blue-100 text-blue-700 hover:bg-blue-200 font-medium"
          >
            ↻ Refresh
          </button>
        </div>
      </header>

      {/* Error Banner */}
      {error && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Map */}
      <div className="flex-1 relative">
        <MapContainer
          center={DEFAULT_CENTER}
          zoom={DEFAULT_ZOOM}
          className="h-full w-full"
          scrollWheelZoom
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {visitors.length > 0 && <FitBounds visitors={visitors} />}

          {visitors.map((visitor) => (
            <VisitorMarker key={visitor.rv_id} visitor={visitor} />
          ))}
        </MapContainer>

        {/* Empty state */}
        {visitors.length === 0 && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-[1000]">
            <div className="text-center text-gray-500">
              <div className="text-4xl mb-2">📍</div>
              <div className="font-medium">No active visitors</div>
              <div className="text-sm mt-1">
                Visitors will appear here once they check in and start tracking
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Visitor List Sidebar (mobile: bottom sheet) */}
      {visitors.length > 0 && (
        <aside className="bg-white border-t px-4 py-2 max-h-32 overflow-y-auto shrink-0">
          <div className="flex gap-3 overflow-x-auto">
            {visitors.map((v) => (
              <div
                key={v.rv_id}
                className={`shrink-0 px-3 py-2 rounded-lg border text-xs ${
                  v.has_geofence_alert
                    ? "border-red-300 bg-red-50"
                    : "border-gray-200 bg-gray-50"
                }`}
              >
                <div className="font-medium">{v.visitor_name}</div>
                <div className="text-gray-500 mt-0.5">
                  {getTimeAgo(new Date(v.last_ping))}
                </div>
                {v.has_geofence_alert && (
                  <div className="text-red-600 font-medium mt-0.5">
                    ⚠ Alert
                  </div>
                )}
              </div>
            ))}
          </div>
        </aside>
      )}
    </div>
  );
}

// ============================================================
// Utility Functions
// ============================================================

function getTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

  if (seconds < 10) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function formatAlertType(type: string | null): string {
  switch (type) {
    case "LEFT_PROPERTY":
      return "Left Property";
    case "APPROACHED_BOUNDARY":
      return "Approached Boundary";
    case "ENTERED_RESTRICTED_ZONE":
      return "Restricted Zone";
    case "GEOFENCE_BREACH":
      return "Geofence Breach";
    default:
      return "Unknown Alert";
  }
}
