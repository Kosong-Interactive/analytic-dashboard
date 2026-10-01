import { z } from "zod";

export const steamManualLabelInputSchema = z.object({
  steamAppId: z.uuid(),
  labelId: z.uuid(),
  intent: z.enum(["confirm", "reject", "clear"]),
});
