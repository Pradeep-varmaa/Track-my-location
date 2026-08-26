import { NextRequest } from "next/server";
import { PingRequestSchema } from "@/lib/validations/tracking";
import { requireAdmin } from "@/lib/auth/session";
import { dbQueryOne, dbExecute } from "@/lib/db";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { getGeofenceForProperty, checkGeofenceBreach } from "@/lib/geofence";
import type { RequestVisitor, VisitorLocation } from "@/lib/types/tracking";

// ============================================================
// POST /api/tracking/ping
// Accept { rv_id, lat, lng, accuracy }
// Insert location, check geofence, insert alert if outside
// ============================================================

export async function POST(request: NextRequest) {
  try {
    // AUTH: This endpoint is called by the client-side hook.
    // In production, validate the visitor's session or use a signed token.
    await requireAdmin(); // TODO: Replace with visitor-level auth

    // 1. Validate input
    const body = await request.json();
    const parsed = PingRequestSchema.parse(body);

    // 2. Verify the visitor exists, is CHECKED_IN, has consent, and tracking is active
    const rv = await dbQueryOne<RequestVisitor>(
      `SELECT rv_id, status, location_consent, tracking_active
       FROM vma_request_visitors
       WHERE rv_id = $1`,
      [parsed.rv_id]
    );

    if (!rv) {
      return apiSuccess(
        { success: false, location_id: "", geofence_breach: false, message: "Visitor not found" },
        404
      );
    }

    if (!rv.tracking_active) {
      return apiSuccess(
        {
          success: false,
          location_id: "",
          geofence_breach: false,
          message: "Tracking is not active for this visitor",
        },
        400
      );
    }

    if (!rv.location_consent) {
      return apiSuccess(
        {
          success: false,
          location_id: "",
          geofence_breach: false,
          message: "Visitor has not consented to location tracking",
        },
        403
      );
    }

    if (rv.status !== "CHECKED_IN") {
      return apiSuccess(
        {
          success: false,
          location_id: "",
          geofence_breach: false,
          message: `Visitor status is ${rv.status}, not CHECKED_IN`,
        },
        400
      );
    }

    // 3. Insert location row
    const locationRow = await dbQueryOne<VisitorLocation>(
      `INSERT INTO vma_visitor_locations (rv_id, latitude, longitude, accuracy_meters, recorded_at)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
       RETURNING id, rv_id, latitude, longitude, accuracy_meters, recorded_at`,
      [parsed.rv_id, parsed.lat, parsed.lng, parsed.accuracy]
    );

    const locationId = locationRow?.id ?? "";

    // 4. Look up the property's geofence
    // TODO: Derive propertyId from the gate_pass_request -> property mapping
    const propertyId = "default-property"; // placeholder
    const geofence = await getGeofenceForProperty(propertyId);

    if (!geofence) {
      // No geofence configured — skip breach check
      return apiSuccess({
        success: true,
        location_id: locationId,
        geofence_breach: false,
        message: "Location recorded (no geofence configured)",
      });
    }

    // 5. Check if the point is outside the geofence
    const breach = checkGeofenceBreach(
      { latitude: parsed.lat, longitude: parsed.lng },
      geofence
    );

    if (breach) {
      // 6. Insert a geofence alert
      await dbExecute(
        `INSERT INTO vma_geofence_alerts (rv_id, alert_type, triggered_at)
         VALUES ($1, $2, CURRENT_TIMESTAMP)`,
        [parsed.rv_id, breach]
      );

      return apiSuccess({
        success: true,
        location_id: locationId,
        geofence_breach: true,
        alert_type: breach,
        message: `Geofence breach detected: ${breach}`,
      });
    }

    return apiSuccess({
      success: true,
      location_id: locationId,
      geofence_breach: false,
      message: "Location recorded",
    });
  } catch (error) {
    return handleApiError(error);
  }
}
