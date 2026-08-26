import type { GeoPoint, GeofencePolygon, GeofenceAlertType } from "@/lib/types/tracking";

// ============================================================
// Geofence Lookup — assumes this function exists per requirements
// ============================================================

/**
 * Look up the geofence polygon for a given property.
 * TODO: Replace with real DB lookup or external service.
 * This is a placeholder that returns a sample polygon.
 */
export async function getGeofenceForProperty(
  propertyId: string
): Promise<GeofencePolygon | null> {
  // TODO: Replace with real implementation
  // Example: SELECT * FROM vma_geofences WHERE property_id = $1
  console.log("[GEOFENCE LOOKUP] propertyId:", propertyId);

  // Sample geofence: a rectangle around a hypothetical building
  return {
    property_id: propertyId,
    name: "Main Building",
    coordinates: [
      { latitude: 28.6139, longitude: 77.209 },  // NW corner
      { latitude: 28.6139, longitude: 77.215 },  // NE corner
      { latitude: 28.610, longitude: 77.215 },   // SE corner
      { latitude: 28.610, longitude: 77.209 },   // SW corner
    ],
  };
}

// ============================================================
// Point-in-Polygon (Ray Casting Algorithm)
// ============================================================

/**
 * Determine if a point (lat/lng) lies inside a polygon.
 * Uses the ray casting algorithm — O(n) where n = number of vertices.
 */
export function isPointInPolygon(point: GeoPoint, polygon: GeoPoint[]): boolean {
  const { latitude: px, longitude: py } = point;
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const { latitude: xi, longitude: yi } = polygon[i];
    const { latitude: xj, longitude: yj } = polygon[j];

    const intersect =
      yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;

    if (intersect) inside = !inside;
  }

  return inside;
}

/**
 * Calculate the distance between two points using the Haversine formula.
 * Returns distance in meters.
 */
export function haversineDistance(a: GeoPoint, b: GeoPoint): number {
  const R = 6371e3; // Earth's radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);

  const sinLat = Math.sin(dLat / 2);
  const sinLon = Math.sin(dLon / 2);

  const h =
    sinLat * sinLat +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * sinLon * sinLon;

  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Check if a point is outside the geofence and determine the alert type.
 * Returns null if inside the geofence, or the appropriate alert type.
 */
export function checkGeofenceBreach(
  point: GeoPoint,
  geofence: GeofencePolygon
): GeofenceAlertType | null {
  if (isPointInPolygon(point, geofence.coordinates)) {
    return null; // Inside the geofence — no breach
  }

  // Find the closest edge to determine alert severity
  const closestDistance = geofence.coordinates.reduce((min, coord, i) => {
    const next = geofence.coordinates[(i + 1) % geofence.coordinates.length];
    const edgeDistance = pointToEdgeDistance(point, coord, next);
    return Math.min(min, edgeDistance);
  }, Infinity);

  // Thresholds for alert classification (in meters)
  const BOUNDARY_THRESHOLD = 100;  // Within 100m of boundary
  const RESTRICTED_THRESHOLD = 200; // Beyond 200m = likely left property

  if (closestDistance > RESTRICTED_THRESHOLD) {
    return "LEFT_PROPERTY";
  }

  if (closestDistance > BOUNDARY_THRESHOLD) {
    return "APPROACHED_BOUNDARY";
  }

  // Close to boundary but outside — likely entering a restricted zone
  return "ENTERED_RESTRICTED_ZONE";
}

/**
 * Calculate the shortest distance from a point to a line segment.
 * Returns distance in meters.
 */
function pointToEdgeDistance(
  point: GeoPoint,
  edgeStart: GeoPoint,
  edgeEnd: GeoPoint
): number {
  const A = point.latitude - edgeStart.latitude;
  const B = point.longitude - edgeStart.longitude;
  const C = edgeEnd.latitude - edgeStart.latitude;
  const D = edgeEnd.longitude - edgeStart.longitude;

  const dot = A * C + B * D;
  const lenSq = C * C + D * D;

  let param = lenSq !== 0 ? dot / lenSq : -1;

  let xx: number, yy: number;

  if (param < 0) {
    xx = edgeStart.latitude;
    yy = edgeStart.longitude;
  } else if (param > 1) {
    xx = edgeEnd.latitude;
    yy = edgeEnd.longitude;
  } else {
    xx = edgeStart.latitude + param * C;
    yy = edgeStart.longitude + param * D;
  }

  return haversineDistance(point, { latitude: xx, longitude: yy });
}
