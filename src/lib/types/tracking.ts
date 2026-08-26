// ============================================================
// Database Entity Types
// ============================================================

/** Represents a row from vma_request_visitors (extended with tracking columns) */
export interface RequestVisitor {
  rv_id: string;
  gate_pass_request_id: string;
  visitor_id: string;
  status: "PENDING" | "CHECKED_IN" | "CHECKED_OUT" | "EXPIRED";
  location_consent: boolean;
  location_consent_at: string | null;
  tracking_active: boolean;
}

/** Represents a row from vma_visitor_locations */
export interface VisitorLocation {
  id: string;
  rv_id: string;
  latitude: number;
  longitude: number;
  accuracy_meters: number;
  recorded_at: string;
}

/** Represents a row from vma_geofence_alerts */
export interface GeofenceAlert {
  id: string;
  rv_id: string;
  alert_type: GeofenceAlertType;
  triggered_at: string;
  resolved_at: string | null;
}

export type GeofenceAlertType =
  | "ENTERED_RESTRICTED_ZONE"
  | "LEFT_PROPERTY"
  | "APPROACHED_BOUNDARY"
  | "GEOFENCE_BREACH";

// ============================================================
// API Payload Types
// ============================================================

/** POST /api/tracking/consent */
export interface ConsentRequest {
  rv_id: string;
}

export interface ConsentResponse {
  success: boolean;
  message: string;
  tracking_active: boolean;
}

/** POST /api/tracking/ping */
export interface PingRequest {
  rv_id: string;
  lat: number;
  lng: number;
  accuracy: number;
}

export interface PingResponse {
  success: boolean;
  location_id: string;
  geofence_breach: boolean;
  alert_type?: GeofenceAlertType;
  message: string;
}

/** GET /api/tracking/live */
export interface LiveVisitor {
  rv_id: string;
  visitor_name: string;
  latitude: number;
  longitude: number;
  accuracy_meters: number;
  last_ping: string;
  has_geofence_alert: boolean;
  active_alert_type: GeofenceAlertType | null;
}

export interface LiveTrackingResponse {
  visitors: LiveVisitor[];
  updated_at: string;
}

/** POST /api/tracking/stop */
export interface StopTrackingRequest {
  rv_id: string;
}

export interface StopTrackingResponse {
  success: boolean;
  message: string;
}

// ============================================================
// Geofence Types
// ============================================================

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export interface GeofencePolygon {
  property_id: string;
  coordinates: GeoPoint[];
  name: string;
}

// ============================================================
// Geolocation Permission States
// ============================================================

export type LocationPermissionState = "prompt" | "granted" | "denied" | "unavailable";

export type TrackingStatus =
  | "idle"
  | "requesting_permission"
  | "active"
  | "permission_denied"
  | "low_accuracy"
  | "error";
