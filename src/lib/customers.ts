import { z } from "zod";

/**
 * Customer objects accept arbitrary metadata and additional server-validated
 * fields beyond the well-known ones below, so both schemas use `.passthrough()`
 * rather than rejecting fields the API otherwise accepts.
 */
export const CustomerCreateInputSchema = z
  .object({
    externalId: z.string().min(1),
    email: z.string().email().optional(),
    name: z.string().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();

export const CustomerUpdateInputSchema = CustomerCreateInputSchema.partial();
