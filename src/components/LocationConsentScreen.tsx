"use client";

import { useState, useCallback } from "react";
import { useLocationTracking } from "@/hooks/useLocationTracking";
import type {
  ConsentResponse,
  TrackingStatus,
  PingResponse,
} from "@/lib/types/tracking";

// ============================================================
// Props
// ============================================================

interface LocationConsentScreenProps {
  /** The request_visitor ID for this visitor */
  rv_id: string;
  /** Visitor's display name (shown in the UI) */
  visitorName?: string;
  /** Called when tracking is activated */
  onTrackingStarted?: () => void;
  /** Called when visitor declines */
  onDeclined?: () => void;
  /** Called on geofence breach */
  onGeofenceBreach?: (response: PingResponse) => void;
}

// ============================================================
// Consent Screen Component
// ============================================================

export function LocationConsentScreen({
  rv_id,
  visitorName = "Visitor",
  onTrackingStarted,
  onDeclined,
  onGeofenceBreach,
}: LocationConsentScreenProps) {
  const [consentState, setConsentState] = useState<
    "pending" | "granting" | "granted" | "declined" | "error"
  >("pending");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pingCount, setPingCount] = useState(0);

  const tracking = useLocationTracking({
    rv_id,
    active: consentState === "granted",
    onPingSuccess: (response) => {
      setPingCount((prev) => prev + 1);
    },
    onGeofenceBreach,
    onStatusChange: (status) => {
      // Could update UI based on tracking status changes
    },
  });

  // Grant consent
  const handleGrantConsent = useCallback(async () => {
    setConsentState("granting");
    setErrorMessage(null);

    try {
      const res = await fetch("/api/tracking/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rv_id }),
      });

      const data: ConsentResponse = await res.json();

      if (data.success) {
        setConsentState("granted");
        onTrackingStarted?.();
      } else {
        setConsentState("error");
        setErrorMessage(data.message);
      }
    } catch {
      setConsentState("error");
      setErrorMessage("Failed to connect to server. Please try again.");
    }
  }, [rv_id, onTrackingStarted]);

  // Decline consent
  const handleDecline = useCallback(() => {
    setConsentState("declined");
    onDeclined?.();
  }, [onDeclined]);

  // ============================================================
  // Render: Declined
  // ============================================================

  if (consentState === "declined") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8 text-center">
          <div className="text-4xl mb-4">📍</div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">
            Tracking Not Enabled
          </h1>
          <p className="text-gray-500 text-sm">
            You have chosen not to share your location. This will not affect
            your visit. If you change your mind, please ask the front desk.
          </p>
        </div>
      </div>
    );
  }

  // ============================================================
  // Render: Error
  // ============================================================

  if (consentState === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8 text-center">
          <div className="text-4xl mb-4">⚠️</div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">
            Something Went Wrong
          </h1>
          <p className="text-gray-500 text-sm mb-6">{errorMessage}</p>
          <button
            onClick={handleGrantConsent}
            className="w-full py-3 px-4 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // ============================================================
  // Render: Tracking Active (dashboard)
  // ============================================================

  if (consentState === "granted") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-green-100 rounded-full mb-4">
              <svg
                className="w-7 h-7 text-green-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h1 className="text-xl font-semibold text-gray-900 mb-1">
              Tracking Active
            </h1>
            <p className="text-gray-500 text-sm">
              Welcome, {visitorName}. Your location is being shared for safety.
            </p>
          </div>

          {/* Status Cards */}
          <div className="space-y-3">
            {/* Permission Status */}
            <StatusRow
              label="Location Permission"
              value={
                tracking.permissionGranted
                  ? "Granted"
                  : tracking.status === "permission_denied"
                    ? "Denied"
                    : "Checking..."
              }
              color={
                tracking.permissionGranted
                  ? "green"
                  : tracking.status === "permission_denied"
                    ? "red"
                    : "yellow"
              }
            />

            {/* Tracking Status */}
            <StatusRow
              label="Tracking Status"
              value={formatTrackingStatus(tracking.status)}
              color={
                tracking.status === "active"
                  ? "green"
                  : tracking.status === "permission_denied"
                    ? "red"
                    : "yellow"
              }
            />

            {/* Accuracy */}
            <StatusRow
              label="GPS Accuracy"
              value={
                tracking.lowAccuracy
                  ? "Low — move outdoors for better signal"
                  : tracking.lastPingResponse
                    ? "Good"
                    : "Awaiting first fix"
              }
              color={
                tracking.lowAccuracy
                  ? "yellow"
                  : tracking.lastPingResponse
                    ? "green"
                    : "gray"
              }
            />

            {/* Ping Count */}
            <StatusRow
              label="Locations Sent"
              value={`${pingCount}`}
              color="gray"
            />
          </div>

          {/* Status Message */}
          <div className="mt-4 p-3 bg-gray-50 rounded-xl">
            <p className="text-xs text-gray-500 text-center">
              {tracking.statusMessage}
            </p>
          </div>

          {/* Permission Denied CTA */}
          {tracking.status === "permission_denied" && (
            <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
              <p className="text-sm text-amber-800 mb-3">
                Location permission was denied. To enable tracking, please
                allow location access in your browser settings and tap below.
              </p>
              <button
                onClick={tracking.requestPermission}
                className="w-full py-2.5 px-4 bg-amber-600 text-white rounded-xl text-sm font-medium hover:bg-amber-700 transition-colors"
              >
                Request Permission Again
              </button>
            </div>
          )}

          {/* Footer Note */}
          <p className="mt-6 text-[11px] text-gray-400 text-center leading-relaxed">
            Your location is only tracked while you are checked in. You can
            request to stop tracking at any time by visiting the front desk.
          </p>
        </div>
      </div>
    );
  }

  // ============================================================
  // Render: Consent Prompt (default)
  // ============================================================

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8">
        {/* Icon */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
            <svg
              className="w-8 h-8 text-blue-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"
              />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-gray-900 mb-1">
            Location Sharing
          </h1>
          <p className="text-gray-500 text-sm">
            Hi {visitorName}, would you like to share your location?
          </p>
        </div>

        {/* What we track */}
        <div className="bg-gray-50 rounded-xl p-4 mb-6">
          <h2 className="text-sm font-medium text-gray-700 mb-3">
            What this means:
          </h2>
          <ul className="space-y-2.5">
            <ConsentItem
              icon="📡"
              text="Your phone will periodically send your location to our system"
            />
            <ConsentItem
              icon="🔒"
              text="Location is only shared while you are checked in at the property"
            />
            <ConsentItem
              icon="⏱"
              text="Updates are sent roughly every 30 seconds (or when you move)"
            />
            <ConsentItem
              icon="🛑"
              text="Tracking stops automatically when you check out"
            />
            <ConsentItem
              icon="🗺"
              text="Used for safety: alerts if you leave the designated area"
            />
          </ul>
        </div>

        {/* Privacy note */}
        <div className="bg-blue-50 rounded-xl p-4 mb-6">
          <p className="text-xs text-blue-800 leading-relaxed">
            <strong>Privacy:</strong> Your location data is stored securely and
            is only visible to authorized property staff. It is deleted after
            your visit concludes. You may request deletion at any time.
          </p>
        </div>

        {/* Loading spinner */}
        {consentState === "granting" && (
          <div className="mb-4 flex items-center justify-center gap-2 text-sm text-gray-500">
            <svg
              className="animate-spin w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            Activating tracking...
          </div>
        )}

        {/* Buttons */}
        <div className="space-y-3">
          <button
            onClick={handleGrantConsent}
            disabled={consentState === "granting"}
            className="w-full py-3.5 px-4 bg-blue-600 text-white rounded-xl font-medium
              hover:bg-blue-700 active:bg-blue-800 transition-colors
              disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {consentState === "granting"
              ? "Activating..."
              : "Allow Location Sharing"}
          </button>
          <button
            onClick={handleDecline}
            disabled={consentState === "granting"}
            className="w-full py-3 px-4 bg-white text-gray-600 border border-gray-200
              rounded-xl font-medium hover:bg-gray-50 active:bg-gray-100
              transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            No, Thanks
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Sub-components
// ============================================================

function ConsentItem({ icon, text }: { icon: string; text: string }) {
  return (
    <li className="flex items-start gap-2.5">
      <span className="text-base mt-0.5 shrink-0">{icon}</span>
      <span className="text-sm text-gray-600 leading-relaxed">{text}</span>
    </li>
  );
}

function StatusRow({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: "green" | "yellow" | "red" | "gray";
}) {
  const colorMap = {
    green: "bg-green-100 text-green-700",
    yellow: "bg-amber-100 text-amber-700",
    red: "bg-red-100 text-red-700",
    gray: "bg-gray-100 text-gray-600",
  };

  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
      <span className="text-sm text-gray-600">{label}</span>
      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${colorMap[color]}`}>
        {value}
      </span>
    </div>
  );
}

// ============================================================
// Helpers
// ============================================================

function formatTrackingStatus(status: TrackingStatus): string {
  switch (status) {
    case "idle":
      return "Not Started";
    case "requesting_permission":
      return "Requesting Access";
    case "active":
      return "Active";
    case "permission_denied":
      return "Permission Denied";
    case "low_accuracy":
      return "Low Accuracy";
    case "error":
      return "Error";
    default:
      return "Unknown";
  }
}
