import { z } from "zod";
import { characterSchema, notesSchema, type Character } from "./character";
export type { Character } from "./character";
const id = z.string().min(1).max(100);
export const appWorkspaceSchema = z
  .object({
    version: z.literal(3),
    activeCharacterId: id.nullable(),
    characters: z.array(characterSchema).max(101),
    notes: notesSchema,
    metric: z.boolean(),
  })
  .superRefine((s, context) => {
    if (new Set(s.characters.map((c) => c.id)).size !== s.characters.length)
      context.addIssue({
        code: "custom",
        message: "Повторяющиеся идентификаторы персонажей",
      });
    if (new Set(s.notes.map((n) => n.id)).size !== s.notes.length)
      context.addIssue({
        code: "custom",
        message: "Повторяющиеся идентификаторы записей",
      });
    if (
      s.activeCharacterId !== null &&
      !s.characters.some((c) => c.id === s.activeCharacterId && !c.archivedAt)
    )
      context.addIssue({
        code: "custom",
        message: "Активный персонаж отсутствует или находится в архиве",
      });
  });
export type AppWorkspace = z.infer<typeof appWorkspaceSchema>;
export const MAX_BACKUP_BYTES = 50_000_000;

export function makeDraft(
  profile: Pick<Character["build"], "name" | "ancestry" | "className"> & {
    id: string;
  },
): Character {
  const { id, ...identity } = profile;
  return characterSchema.parse({
    id,
    kind: "draft",
    archivedAt: null,
    build: { ...identity, lore: "", portrait: "", maxHp: 1 },
    runtime: { hp: 0, tempHp: 0, slotsRemaining: null, inventory: [] },
  });
}
export function initialAppWorkspace(): AppWorkspace {
  return {
    version: 3,
    activeCharacterId: "gu-chen-demo",
    metric: false,
    notes: [],
    characters: [
      {
        id: "gu-chen-demo",
        kind: "demo",
        archivedAt: null,
        build: {
          name: "Гу Чень",
          ancestry: "Человек",
          className: "Савант 3 / Волшебник 1",
          maxHp: 30,
          portrait: "",
          lore: "Гу Чень — Хранитель душ. Его настоящее имя — Синь Дзин. За образом учёного скрывается агент двора Хань.\n\nЭто учебная копия. Дополните историю своими заметками.",
        },
        runtime: { hp: 30, tempHp: 0, slotsRemaining: null, inventory: [] },
      },
    ],
  };
}
export function activeCharacter(s: AppWorkspace): Character | undefined {
  return s.characters.find(
    (c) => c.id === s.activeCharacterId && !c.archivedAt,
  );
}
export function selectCharacter(
  s: AppWorkspace,
  characterId: string,
): AppWorkspace {
  if (!s.characters.some((c) => c.id === characterId && !c.archivedAt))
    throw new Error("Персонаж недоступен");
  return { ...s, activeCharacterId: characterId };
}
export function archiveCharacter(
  s: AppWorkspace,
  characterId: string,
  now = new Date().toISOString(),
): AppWorkspace {
  const characters = s.characters.map((c) =>
    c.id === characterId ? { ...c, archivedAt: now } : c,
  );
  return {
    ...s,
    characters,
    activeCharacterId:
      s.activeCharacterId === characterId
        ? (characters.find((c) => !c.archivedAt)?.id ?? null)
        : s.activeCharacterId,
  };
}
export function restoreCharacter(
  s: AppWorkspace,
  characterId: string,
): AppWorkspace {
  const characters = s.characters.map((c) =>
    c.id === characterId ? { ...c, archivedAt: null } : c,
  );
  return {
    ...s,
    characters,
    activeCharacterId:
      s.activeCharacterId ?? characters.find((c) => !c.archivedAt)?.id ?? null,
  };
}
export function updateCharacter(
  s: AppWorkspace,
  characterId: string,
  update: (character: Character) => Pick<Character, "build" | "runtime">,
): AppWorkspace {
  const target = s.characters.find(
    (c) => c.id === characterId && !c.archivedAt,
  );
  if (!target) throw new Error("Персонаж недоступен");
  const { build, runtime } = update(target);
  return {
    ...s,
    characters: s.characters.map((c) =>
      c.id === characterId ? { ...c, build, runtime } : c,
    ),
  };
}
export function encodeBackup(s: AppWorkspace): string {
  return serializeBackup(appWorkspaceSchema.parse(s));
}
// Call only with an already validated workspace. Compact JSON is the export format.
export function serializeBackup(s: AppWorkspace): string {
  const raw = JSON.stringify(s);
  if (new TextEncoder().encode(raw).byteLength > MAX_BACKUP_BYTES)
    throw new Error("Копия превышает 50 МБ. Уменьшите портреты.");
  return raw;
}
