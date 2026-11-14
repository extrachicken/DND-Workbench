import { z } from "zod";

const bounded = z.number().int().min(0).max(9999);
const entry = z.object({
  id: z.string().max(80),
  name: z.string().min(1).max(100),
  quantity: bounded,
  equipped: z.boolean(),
});
const note = z.object({
  id: z.string().max(80),
  title: z.string().min(1).max(150),
  campaign: z.string().min(1).max(100),
  text: z.string().max(30000),
  date: z.iso.datetime(),
});
const draft = z.object({
  id: z.string().max(80),
  name: z.string().min(1).max(80),
  ancestry: z.string().max(80),
  className: z.string().max(80),
});
export const legacyWorkspaceSchema = z
  .object({
    version: z.literal(1),
    hp: bounded,
    maxHp: bounded.min(1),
    tempHp: bounded,
    slotsRemaining: z.number().int().min(0).max(2).nullable(),
    lore: z.string().max(30000),
    portrait: z
      .string()
      .max(3000000)
      .regex(/^(|data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+)$/),
    inventory: z.array(entry).max(1000),
    notes: z.array(note).max(1000),
    drafts: z.array(draft).max(100),
    metric: z.boolean(),
  })
  .refine((s) => s.hp <= s.maxHp, "Текущие хиты превышают максимум");
export type LegacyWorkspace = z.infer<typeof legacyWorkspaceSchema>;
