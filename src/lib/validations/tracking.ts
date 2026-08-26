import { z } from "zod";

// ============================================================
// API Input Validation Schemas (Zod)
// ============================================================

/** POST /api/tracking/consent */
export const ConsentRequestSchema = z.object({
  rv_id: z
    .string()
    .min(1, "rv_id is required")
    .uuid("rv_id must be a valid UUID"),
});

/** POST /api/tracking/ping */
export const PingRequestSchema = z.object({
  rv_id: z
    .string()
    .min(1, "rv_id is required")
    .uuid("rv_id must be a valid UUID"),
  lat: z
    .number()
    .min(-90, "Latitude must be between -90 and 90")
    .max(90, "Latitude must be between -90 and 90"),
  lng: z
    .number()
    .min(-180, "Longitude must be between -180 and 180")
    .max(180, "Longitude must be between -180 and 180"),
  accuracy: z
    .number()
    .min(0, "Accuracy must be non-negative")
    .max(10000, "Accuracy seems unreasonably high"),
});

/** POST /api/tracking/stop */
export const StopTrackingRequestSchema = z.object({
  rv_id: z
    .string()
    .min(1, "rv_id is required")
    .uuid("rv_id must be a valid UUID"),
});

// ============================================================
// Derived Types
// ============================================================

export type ConsentRequestInput = z.infer<typeof ConsentRequestSchema>;
export type PingRequestInput = z.infer<typeof PingRequestSchema>;
export type StopTrackingRequestInput = z.infer<typeof StopTrackingRequestSchema>;
