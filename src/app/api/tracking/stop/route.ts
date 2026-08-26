import { NextRequest } from "next/server";
import { StopTrackingRequestSchema } from "@/lib/validations/tracking";
import { requireAdmin } from "@/lib/auth/session";
import { dbQueryOne, dbExecute } from "@/lib/db";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import type { RequestVisitor } from "@/lib/types/tracking";

// ============================================================
// POST /api/tracking/stop
// Set tracking_active = false on checkout/expiry
// ============================================================

export async function POST(request: NextRequest) {
  try {
    // AUTH: Admin-only — called on checkout or expiry
    // TODO: Add role check: requireAdmin()
    await requireAdmin();

    // 1. Validate input
    const body = await request.json();
    const parsed = StopTrackingRequestSchema.parse(body);

    // 2. Check the visitor exists and is currently tracked
    const rv = await dbQueryOne<RequestVisitor>(
      `SELECT rv_id, tracking_active
       FROM vma_request_visitors
       WHERE rv_id = $1`,
      [parsed.rv_id]
    );

    if (!rv) {
      return apiSuccess(
        { success: false, message: "Request visitor not found" },
        404
      );
    }

    if (!rv.tracking_active) {
      return apiSuccess({
        success: true,
        message: "Tracking was already inactive",
      });
    }

    // 3. Deactivate tracking
    await dbExecute(
      `UPDATE vma_request_visitors
       SET tracking_active = FALSE
       WHERE rv_id = $1`,
      [parsed.rv_id]
    );

    // 4. Resolve any open geofence alerts for this visitor
    await dbExecute(
      `UPDATE vma_geofence_alerts
       SET resolved_at = CURRENT_TIMESTAMP
       WHERE rv_id = $1 AND resolved_at IS NULL`,
      [parsed.rv_id]
    );

    return apiSuccess({
      success: true,
      message: "Tracking deactivated, open alerts resolved",
    });
  } catch (error) {
    return handleApiError(error);
  }
}
