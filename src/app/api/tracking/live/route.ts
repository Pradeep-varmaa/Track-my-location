import { requireAdmin } from "@/lib/auth/session";
import { dbQuery } from "@/lib/db";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import type { LiveVisitor, LiveTrackingResponse } from "@/lib/types/tracking";

// ============================================================
// GET /api/tracking/live
// Return the latest location per rv_id where tracking_active = true
// ============================================================

export async function GET() {
  try {
    // AUTH: Admin-only endpoint for the live map dashboard
    // TODO: Add role check: requireAdmin()
    await requireAdmin();

    // Get latest location per tracked visitor using a lateral join / window function
    const rows = await dbQuery<LiveVisitor>(
      `SELECT
        rv.rv_id,
        COALESCE(v.first_name || ' ' || v.last_name, 'Unknown Visitor') AS visitor_name,
        loc.latitude,
        loc.longitude,
        loc.accuracy_meters,
        loc.recorded_at AS last_ping,
        CASE
          WHEN alerts.id IS NOT NULL THEN TRUE
          ELSE FALSE
        END AS has_geofence_alert,
        alerts.alert_type AS active_alert_type
      FROM vma_request_visitors rv
      JOIN vma_visitors v ON v.visitor_id = rv.visitor_id
      JOIN LATERAL (
        SELECT latitude, longitude, accuracy_meters, recorded_at
        FROM vma_visitor_locations
        WHERE rv_id = rv.rv_id
        ORDER BY recorded_at DESC
        LIMIT 1
      ) loc ON TRUE
      LEFT JOIN LATERAL (
        SELECT id, alert_type
        FROM vma_geofence_alerts
        WHERE rv_id = rv.rv_id AND resolved_at IS NULL
        ORDER BY triggered_at DESC
        LIMIT 1
      ) alerts ON TRUE
      WHERE rv.tracking_active = TRUE
        AND rv.status = 'CHECKED_IN'
      ORDER BY loc.recorded_at DESC`
    );

    const response: LiveTrackingResponse = {
      visitors: rows,
      updated_at: new Date().toISOString(),
    };

    return apiSuccess(response);
  } catch (error) {
    return handleApiError(error);
  }
}
