"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { LocationConsentScreen } from "@/components/LocationConsentScreen";

// ============================================================
// Visitor Tracking Page
// Accessible at: /visitor/tracking?rv_id=<uuid>
//
// TODO: In production, the rv_id should come from a session token
// or a signed URL parameter, NOT an unvalidated query string.
// ============================================================

function TrackingPageContent() {
  const searchParams = useSearchParams();
  const rv_id = searchParams.get("rv_id");

  // Missing rv_id
  if (!rv_id) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8 text-center">
          <div className="text-4xl mb-4">🔍</div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">
            Invalid Link
          </h1>
          <p className="text-gray-500 text-sm">
            This tracking link is missing required information. Please use the
            link provided at check-in, or contact the front desk for assistance.
          </p>
        </div>
      </div>
    );
  }

  return (
    <LocationConsentScreen
      rv_id={rv_id}
      visitorName="Visitor"
      onGeofenceBreach={(response) => {
        console.warn("[Geofence Breach]", response);
        // TODO: Show in-app notification to the visitor
      }}
      onTrackingStarted={() => {
        console.log("[Tracking] Started");
      }}
      onDeclined={() => {
        console.log("[Tracking] Declined by visitor");
      }}
    />
  );
}

// ============================================================
// Page with Suspense boundary (required for useSearchParams)
// ============================================================

export default function VisitorTrackingPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-gray-400 text-sm">Loading...</div>
        </div>
      }
    >
      <TrackingPageContent />
    </Suspense>
  );
}
