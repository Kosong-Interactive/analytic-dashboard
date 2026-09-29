import { z } from "zod";

const nullableNonnegativeInteger = z.number().int().nonnegative().nullable();

export const appSnapshotSchema = z
  .object({
    storeAppId: z.uuid(),
    capturedAt: z.iso.datetime({ offset: true }),
    rating: z.number().min(0).max(5).nullable(),
    ratingCount: nullableNonnegativeInteger,
    reviewCount: nullableNonnegativeInteger,
    minInstalls: nullableNonnegativeInteger,
    maxInstalls: nullableNonnegativeInteger,
    price: z.number().nonnegative().nullable(),
    currency: z.string().length(3).toUpperCase().nullable(),
    version: z.string().trim().min(1).nullable(),
  })
  .superRefine((snapshot, context) => {
    if (
      snapshot.minInstalls !== null &&
      snapshot.maxInstalls !== null &&
      snapshot.maxInstalls < snapshot.minInstalls
    ) {
      context.addIssue({
        code: "custom",
        message: "maxInstalls must be greater than or equal to minInstalls",
        path: ["maxInstalls"],
      });
    }
  });

export type AppSnapshot = z.infer<typeof appSnapshotSchema>;
