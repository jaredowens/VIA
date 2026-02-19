import { z } from "zod";
export const CardIdSchema = z.string().min(2).max(32).regex(/^[A-Za-z0-9_-]+$/, "Invalid card id");
export const UpdateProfileSchema = z.object({ display_name: z.string().min(1).max(40) });
export const ProviderSchema = z.enum(["venmo","cashapp","zelle","paypal","custom"]);
export const PaymentLinkUpsertSchema = z.object({
  id: z.string().uuid().optional(),
  provider: ProviderSchema,
  label: z.string().max(30).optional().default(""),
  value: z.string().min(1).max(120),
  sort_order: z.number().int().min(0).max(999).default(0),
  is_enabled: z.boolean().default(true)
});
export const PaymentLinksBulkSchema = z.object({ links: z.array(PaymentLinkUpsertSchema).max(20) });
