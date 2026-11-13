import { z } from "zod";
import {
  initialWorkspace,
  workspaceSchema,
  type Workspace as LegacyWorkspace,
} from "./model";

const id = z.string().min(1).max(100);
const characterSchema = z.object({
  id,
  name: z.string().trim().min(1).max(80),
  ancestry: z.string().trim().min(1).max(80),
  className: z.string().trim().min(1).max(80),
  kind: z.enum(["demo", "draft"]),
  archivedAt: z.iso.datetime().nullable(),
  // The first gameplay sheet is still a limited fixture. Drafts do not expose it.
  sheet: z
    .object(workspaceSchema.shape)
    .omit({ version: true, notes: true, drafts: true, metric: true })
    .refine((s) => s.hp <= s.maxHp, "Текущие хиты превышают максимум"),
});
export type Character = z.infer<typeof characterSchema>;
export const appWorkspaceSchema = z
  .object({
    version: z.literal(2),
    activeCharacterId: id.nullable(),
    characters: z.array(characterSchema).max(101),
    notes: workspaceSchema.shape.notes,
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

export function migrateLegacy(raw: unknown): AppWorkspace {
  const legacy = workspaceSchema.parse(raw);
  const { version: _version, notes, drafts, metric, ...sheet } = legacy;
  return appWorkspaceSchema.parse({
    version: 2,
    activeCharacterId: "gu-chen-demo",
    metric,
    notes,
    characters: [
      {
        id: "gu-chen-demo",
        name: "Гу Чень",
        ancestry: "Человек",
        className: "Савант 3 / Волшебник 1",
        kind: "demo",
        archivedAt: null,
        sheet,
      },
      ...drafts.map((draft, index) =>
        makeDraft({
          ...draft,
          // Legacy IDs were not required to be unique. Assign migration IDs without losing entries.
          id: `legacy-draft-${index}`,
          name: draft.name.trim() || "Без имени",
          ancestry: draft.ancestry.trim() || "Не выбрано",
          className: draft.className.trim() || "Не выбран",
        }),
      ),
    ],
  });
}
export function makeDraft(
  profile: Pick<Character, "id" | "name" | "ancestry" | "className">,
): Character {
  return characterSchema.parse({
    ...profile,
    kind: "draft",
    archivedAt: null,
    sheet: {
      hp: 0,
      maxHp: 1,
      tempHp: 0,
      slotsRemaining: null,
      lore: "",
      portrait: "",
      inventory: [],
    },
  });
}
export function initialAppWorkspace(): AppWorkspace {
  return migrateLegacy(structuredClone(initialWorkspace));
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
// Adapter isolates the original single-character prototype while its screens are decomposed.
export function sheetView(s: AppWorkspace): LegacyWorkspace {
  const character = activeCharacter(s);
  return {
    ...initialWorkspace,
    ...character?.sheet,
    version: 1,
    notes: s.notes,
    metric: s.metric,
    drafts: [],
  };
}
export function updateSheet(
  s: AppWorkspace,
  characterId: string | null,
  update: (v: LegacyWorkspace) => LegacyWorkspace,
): AppWorkspace {
  const target = s.characters.find(
    (c) => c.id === characterId && !c.archivedAt,
  );
  if (characterId !== null && !target) throw new Error("Персонаж недоступен");
  const previous = {
    ...initialWorkspace,
    ...target?.sheet,
    notes: s.notes,
    metric: s.metric,
    drafts: [],
  };
  const {
    version: _version,
    notes,
    metric,
    drafts: _drafts,
    ...sheet
  } = workspaceSchema.parse(update(previous));
  return {
    ...s,
    notes,
    metric,
    characters: s.characters.map((c) =>
      c.id === target?.id ? { ...c, sheet } : c,
    ),
  };
}
export function decodeBackup(raw: string): AppWorkspace {
  if (new TextEncoder().encode(raw).byteLength > MAX_BACKUP_BYTES)
    throw new Error("Копия превышает 50 МБ");
  const value: unknown = JSON.parse(raw);
  if (
    typeof value === "object" &&
    value !== null &&
    "version" in value &&
    value.version === 1
  )
    return migrateLegacy(value);
  return appWorkspaceSchema.parse(value);
}
export function encodeBackup(s: AppWorkspace): string {
  const raw = JSON.stringify(appWorkspaceSchema.parse(s), null, 2);
  if (new TextEncoder().encode(raw).byteLength > MAX_BACKUP_BYTES)
    throw new Error("Копия превышает 50 МБ. Уменьшите портреты.");
  return raw;
}
