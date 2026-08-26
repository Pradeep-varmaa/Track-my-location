"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { TrackingStatus, PingResponse } from "@/lib/types/tracking";

// ============================================================
// Configuration
// ============================================================

const PING_INTERVAL_MS = 30_000; // 30 seconds minimum between pings
const DISTANCE_FILTER_METERS = 10; // Only ping if moved > 10m
const MAX_ACCURACY_METERS = 100; // Warn if accuracy is worse than this

// ============================================================
// useLocationTracking Hook
// ============================================================

interface UseLocationTrackingOptions {
  /** The request_visitor ID to track */
  rv_id: string;
  /** Whether tracking should be active (controls start/stop) */
  active: boolean;
  /** Callback when a ping succeeds */
  onPingSuccess?: (response: PingResponse) => void;
  /** Callback when a geofence breach is detected */
  onGeofenceBreach?: (response: PingResponse) => void;
  /** Callback for status changes */
  onStatusChange?: (status: TrackingStatus) => void;
}

interface UseLocationTrackingReturn {
  /** Current tracking status */
  status: TrackingStatus;
  /** Human-readable status message */
  statusMessage: string;
  /** Whether geolocation permission is granted */
  permissionGranted: boolean;
  /** Whether the device has low GPS accuracy */
  lowAccuracy: boolean;
  /** Last successful ping response */
  lastPingResponse: PingResponse | null;
  /** Total number of pings sent */
  pingCount: number;
  /** Request permission manually */
  requestPermission: () => void;
}

export function useLocationTracking({
  rv_id,
  active,
  onPingSuccess,
  onGeofenceBreach,
  onStatusChange,
}: UseLocationTrackingOptions): UseLocationTrackingReturn {
  const [status, setStatus] = useState<TrackingStatus>("idle");
  const [statusMessage, setStatusMessage] = useState("Tracking not started");
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [lowAccuracy, setLowAccuracy] = useState(false);
  const [lastPingResponse, setLastPingResponse] = useState<PingResponse | null>(null);
  const [pingCount, setPingCount] = useState(0);

  const watchIdRef = useRef<number | null>(null);
  const lastPingTimeRef = useRef<number>(0);
  const lastPositionRef = useRef<{ lat: number; lng: number } | null>(null);
  const activeRef = useRef(active);

  // Keep active ref in sync
  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  // Update status and notify
  const updateStatus = useCallback(
    (newStatus: TrackingStatus, message: string) => {
      setStatus(newStatus);
      setStatusMessage(message);
      onStatusChange?.(newStatus);
    },
    [onStatusChange]
  );

  // Send a ping to the server
  const sendPing = useCallback(
    async (lat: number, lng: number, accuracy: number) => {
      const now = Date.now();

      // Throttle: don't ping more than once per 30 seconds
      if (now - lastPingTimeRef.current < PING_INTERVAL_MS) {
        return;
      }

      // Distance filter: don't ping if barely moved
      if (lastPositionRef.current) {
        const distance = haversineDistance(
          lastPositionRef.current,
          { lat, lng }
        );
        if (distance < DISTANCE_FILTER_METERS) {
          return;
        }
      }

      lastPingTimeRef.current = now;
      lastPositionRef.current = { lat, lng };

      // Check accuracy
      if (accuracy > MAX_ACCURACY_METERS) {
        setLowAccuracy(true);
      } else {
        setLowAccuracy(false);
      }

      try {
        const response = await fetch("/api/tracking/ping", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rv_id, lat, lng, accuracy }),
        });

        const data: PingResponse = await response.json();

        if (data.success) {
          setLastPingResponse(data);
          setPingCount((prev) => prev + 1);
          onPingSuccess?.(data);

          if (data.geofence_breach) {
            onGeofenceBreach?.(data);
          }
        } else {
          console.warn("[Tracking] Ping failed:", data.message);

          if (data.message.includes("not active")) {
            updateStatus("idle", "Tracking deactivated by server");
            stopTracking();
          }
        }
      } catch (error) {
        console.error("[Tracking] Ping error:", error);
        // Don't change status — network hiccup, keep trying
      }
    },
    [rv_id, onPingSuccess, onGeofenceBreach, updateStatus]
  );

  // Handle geolocation position updates
  const handlePosition = useCallback(
    (position: GeolocationPosition) => {
      const { latitude, longitude, accuracy } = position.coords;
      sendPing(latitude, longitude, accuracy);
    },
    [sendPing]
  );

  // Handle geolocation errors
  const handleError = useCallback(
    (error: GeolocationPositionError) => {
      switch (error.code) {
        case error.PERMISSION_DENIED:
          updateStatus(
            "permission_denied",
            "Location permission denied. Please enable location access in your browser settings."
          );
          setPermissionGranted(false);
          break;

        case error.POSITION_UNAVAILABLE:
          updateStatus(
            "error",
            "Location information unavailable. Please check your device's GPS."
          );
          break;

        case error.TIMEOUT:
          updateStatus(
            "error",
            "Location request timed out. Retrying..."
          );
          // Don't stop — watchPosition will retry automatically
          break;
      }
    },
    [updateStatus]
  );

  // Start watching position
  const startTracking = useCallback(() => {
    if (!navigator.geolocation) {
      updateStatus("unavailable" as TrackingStatus, "Geolocation is not supported by this browser");
      return;
    }

    updateStatus("requesting_permission", "Requesting location permission...");

    const options: PositionOptions = {
      enableHighAccuracy: true,
      timeout: 15_000,
      maximumAge: 5_000, // Accept cached positions up to 5s old
    };

    // First try getCurrentPosition to check permission
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setPermissionGranted(true);
        updateStatus("active", "Tracking active");
        handlePosition(position);

        // Start continuous watching
        watchIdRef.current = navigator.geolocation.watchPosition(
          handlePosition,
          handleError,
          options
        );
      },
      (error) => {
        handleError(error);
      },
      options
    );
  }, [updateStatus, handlePosition, handleError]);

  // Stop watching position
  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    lastPingTimeRef.current = 0;
    lastPositionRef.current = null;
  }, []);

  // Start/stop based on `active` prop
  useEffect(() => {
    if (active) {
      startTracking();
    } else {
      stopTracking();
      if (status === "active") {
        updateStatus("idle", "Tracking stopped");
      }
    }

    return () => {
      stopTracking();
    };
  }, [active]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopTracking();
    };
  }, [stopTracking]);

  // Manual permission request
  const requestPermission = useCallback(() => {
    if (!active) return;
    startTracking();
  }, [active, startTracking]);

  return {
    status,
    statusMessage,
    permissionGranted,
    lowAccuracy,
    lastPingResponse,
    pingCount,
    requestPermission,
  };
}

// ============================================================
// Haversine distance helper (copied from geofence module for client bundle)
// ============================================================

function haversineDistance(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const R = 6371e3;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lng - a.lng);
  const sinLat = Math.sin(dLat / 2);
  const sinLon = Math.sin(dLon / 2);
  const h =
    sinLat * sinLat +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLon * sinLon;
  return 2 * R * Math.asin(Math.sqrt(h));
}
