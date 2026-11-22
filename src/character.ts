import { damage } from "./model";
import { z } from "zod";
import { progressionSchema } from "./progression";

export const bounded = z.number().int().min(0).max(9999);
export const inventorySchema = z
  .array(
    z.object({
      id: z.string().max(80),
      name: z.string().min(1).max(100),
      quantity: bounded,
      equipped: z.boolean(),
    }),
  )
  .max(1000);
export const characterBuildSchema = z.object({
  name: z.string().trim().min(1).max(80),
  ancestry: z.string().trim().min(1).max(80),
  className: z.string().trim().min(1).max(80),
  background: z.string().trim().max(80).optional(),
  lore: z.string().max(30000),
  portrait: z
    .string()
    .max(3000000)
    .regex(/^(|data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+)$/),
  campaignId: z.string().min(1).max(100).nullable(),
  progression: progressionSchema.nullable(),
  // Manual gameplay maximum; a draft preview never overwrites current resources.
  maxHp: bounded.min(1),
});
export const runtimeStateSchema = z.object({
  hp: bounded,
  tempHp: bounded,
  slotsRemaining: z.number().int().min(0).max(2).nullable(),
  inventory: inventorySchema,
  lastDamage: z
    .object({
      id: z.uuid(),
      hp: bounded,
      tempHp: bounded,
      amount: bounded.min(1),
    })
    .optional(),
});
export const characterSchema = z
  .object({
    id: z.string().min(1).max(100),
    kind: z.enum(["demo", "draft", "player"]),
    archivedAt: z.iso.datetime().nullable(),
    build: characterBuildSchema,
    runtime: runtimeStateSchema,
  })
  .refine(
    (c) => c.runtime.hp <= c.build.maxHp,
    "Текущие хиты превышают максимум",
  )
  .refine(
    (c) => c.kind !== "player" || c.build.progression !== null,
    "Для игры нужна сборка",
  )
  .refine((c) => {
    const action = c.runtime.lastDamage;
    if (!action) return true;
    if (c.kind !== "player" || action.hp > c.build.maxHp) return false;
    const after = damage(
      { ...c.runtime, hp: action.hp, tempHp: action.tempHp },
      action.amount,
    );
    return after.hp === c.runtime.hp && after.tempHp === c.runtime.tempHp;
  }, "Запись урона расходится с хитами персонажа");
export type CharacterBuild = z.infer<typeof characterBuildSchema>;
export type RuntimeState = z.infer<typeof runtimeStateSchema>;
export type Character = z.infer<typeof characterSchema>;
