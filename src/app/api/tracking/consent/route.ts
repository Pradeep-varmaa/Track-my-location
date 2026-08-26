import { NextRequest } from "next/server";
import { ConsentRequestSchema } from "@/lib/validations/tracking";
import { getSession, requireAdmin } from "@/lib/auth/session";
import { dbQueryOne, dbExecute } from "@/lib/db";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import type { RequestVisitor } from "@/lib/types/tracking";

// ============================================================
// POST /api/tracking/consent
// Accept { rv_id }, record consent, set tracking_active = true
// ============================================================

export async function POST(request: NextRequest) {
  try {
    // AUTH: Allow either admin or the visitor themselves to grant consent.
    // Visitors can consent to their own tracking; admins can consent on behalf of any visitor.
    const session = await getSession();
    if (!session) {
      // TODO: In production, require auth. For dev, we allow unauthenticated consent.
      // throw new UnauthorizedError("Authentication required");
    }

    // 1. Validate input
    const body = await request.json();
    const parsed = ConsentRequestSchema.parse(body);

    // 2. Look up the request_visitor row
    const rv = await dbQueryOne<RequestVisitor>(
      `SELECT rv_id, status, tracking_active
       FROM vma_request_visitors
       WHERE rv_id = $1`,
      [parsed.rv_id]
    );

    if (!rv) {
      return apiSuccess(
        { success: false, message: "Request visitor not found", tracking_active: false },
        404
      );
    }

    // 3. Only allow consent for CHECKED_IN visitors
    if (rv.status !== "CHECKED_IN") {
      return apiSuccess(
        {
          success: false,
          message: `Cannot start tracking — visitor status is ${rv.status} (must be CHECKED_IN)`,
          tracking_active: false,
        },
        400
      );
    }

    // 4. Record consent and activate tracking
    await dbExecute(
      `UPDATE vma_request_visitors
       SET location_consent = TRUE,
           location_consent_at = CURRENT_TIMESTAMP,
           tracking_active = TRUE
       WHERE rv_id = $1`,
      [parsed.rv_id]
    );

    return apiSuccess({
      success: true,
      message: "Consent recorded, tracking activated",
      tracking_active: true,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
