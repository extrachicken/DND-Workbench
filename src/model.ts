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
export const workspaceSchema = z
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
export type Workspace = z.infer<typeof workspaceSchema>;
export const initialWorkspace: Workspace = {
  version: 1,
  hp: 30,
  maxHp: 30,
  tempHp: 0,
  slotsRemaining: null,
  lore: "Гу Чень — Хранитель душ. Его настоящее имя — Синь Дзин. За образом учёного скрывается агент двора Хань.\n\nЭто учебная копия. Дополните историю своими заметками.",
  portrait: "",
  inventory: [],
  notes: [],
  drafts: [],
  metric: false,
};
export function damage(s: Workspace, amount: number): Workspace {
  if (!Number.isInteger(amount) || amount < 0)
    throw new Error("Введите целое неотрицательное число");
  return {
    ...s,
    tempHp: Math.max(0, s.tempHp - amount),
    hp: Math.max(0, s.hp - Math.max(0, amount - s.tempHp)),
  };
}
export function heal(s: Workspace, amount: number): Workspace {
  if (!Number.isInteger(amount) || amount < 0)
    throw new Error("Введите целое неотрицательное число");
  return { ...s, hp: Math.min(s.maxHp, s.hp + amount) };
}
export function parseBackup(raw: string): Workspace {
  if (raw.length > 5_000_000) throw new Error("Резервная копия больше 5 МБ");
  return workspaceSchema.parse(JSON.parse(raw));
}
export const signed = (value: number) =>
  value >= 0 ? `+${value}` : `${value}`;
export const modifier = (score: number) => Math.floor((score - 10) / 2);
export function rollDie(sides: number): number {
  // Rejection sampling prevents modulo bias.
  if (!Number.isInteger(sides) || sides < 2 || sides > 100)
    throw new Error("Неверный кубик");
  const limit = 2 ** 32 - (2 ** 32 % sides);
  const buffer = new Uint32Array(1);
  do {
    crypto.getRandomValues(buffer);
  } while (buffer[0] >= limit);
  return (buffer[0] % sides) + 1;
}
