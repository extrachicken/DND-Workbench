import { z } from "zod";
import {
  characterBuildSchema,
  characterSchema,
  type Character,
} from "./character";
import { campaignSchema, type Campaign } from "./campaign";
export type { Character } from "./character";
const id = z.string().min(1).max(100);
export const appWorkspaceSchema = z
  .object({
    version: z.literal(8),
    campaigns: z.array(campaignSchema).max(1000),
    activeCharacterId: id.nullable(),
    characters: z.array(characterSchema).max(101),
    notes: z
      .array(
        z.object({
          id: z.string().max(80),
          title: z.string().min(1).max(150),
          campaignId: id.nullable(),
          text: z.string().max(30000),
          date: z.iso.datetime(),
        }),
      )
      .max(1000),
    metric: z.boolean(),
  })
  .superRefine((s, context) => {
    const campaignIds = new Set(s.campaigns.map((c) => c.id));
    if (campaignIds.size !== s.campaigns.length)
      context.addIssue({
        code: "custom",
        message: "Повторяющиеся идентификаторы кампаний",
      });
    if (
      s.notes.some(
        (n) => n.campaignId !== null && !campaignIds.has(n.campaignId),
      )
    )
      context.addIssue({
        code: "custom",
        message: "Кампания записи отсутствует",
      });
    if (
      s.characters.some(
        (c) =>
          c.build.campaignId !== null && !campaignIds.has(c.build.campaignId),
      )
    )
      context.addIssue({
        code: "custom",
        message: "Кампания персонажа отсутствует",
      });
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
    build: {
      ...identity,
      lore: "",
      portrait: "",
      maxHp: 1,
      campaignId: null,
      progression: null,
    },
    runtime: { hp: 0, tempHp: 0, slotsRemaining: null, inventory: [] },
  });
}
export const guChenBiography =
  "Гу Чень — Хранитель душ. Его настоящее имя — Синь Дзин. За образом учёного скрывается агент двора Хань.";
export function initialAppWorkspace(): AppWorkspace {
  return {
    version: 8,
    campaigns: [],
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
          campaignId: null,
          progression: null,
          portrait: "",
          lore: guChenBiography,
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
export function saveDraftBuild(
  s: AppWorkspace,
  id: string,
  build: Character["build"],
  baseline: Character["build"],
): AppWorkspace {
  const current = s.characters.find((c) => c.id === id);
  if (
    !current ||
    current.archivedAt ||
    current.kind !== "draft" ||
    Object.keys(characterBuildSchema.shape).some((key) => {
      const field = key as keyof Character["build"];
      return field === "progression"
        ? JSON.stringify(current.build.progression) !==
            JSON.stringify(baseline.progression)
        : current.build[field] !== baseline[field];
    })
  )
    throw new Error("Черновик изменился в другой вкладке.");
  return updateCharacter(s, id, (c) => ({ build, runtime: c.runtime }));
}
// Call only with an already validated workspace. Compact JSON is the export format.
export function serializeBackup(s: AppWorkspace): string {
  const raw = JSON.stringify(s);
  if (new TextEncoder().encode(raw).byteLength > MAX_BACKUP_BYTES)
    throw new Error("Копия превышает 50 МБ. Уменьшите портреты.");
  return raw;
}

export function saveCampaign(
  s: AppWorkspace,
  campaign: Campaign,
  baseline?: Campaign,
): AppWorkspace {
  const current = s.campaigns.find((c) => c.id === campaign.id);
  if (
    baseline
      ? JSON.stringify(current) !== JSON.stringify(baseline)
      : current !== undefined
  )
    throw new Error("Кампания изменена в другой вкладке.");
  return {
    ...s,
    campaigns: baseline
      ? s.campaigns.map((c) => (c.id === campaign.id ? campaign : c))
      : [...s.campaigns, campaign],
  };
}

export type SessionNote = AppWorkspace["notes"][number];

const noteFields = ["title", "text", "campaignId"] as const;

export function sessionNoteConflicts(
  current: SessionNote | undefined,
  baseline: SessionNote,
  draft: SessionNote,
) {
  return (
    !current ||
    noteFields.some(
      (field) =>
        draft[field] !== baseline[field] &&
        current[field] !== baseline[field] &&
        current[field] !== draft[field],
    )
  );
}

// Compare each edited field inside the same transaction as the write. Edits to
// different fields can coexist, even when the two tabs opened the same version.
export function saveSessionNote(
  s: AppWorkspace,
  baseline: SessionNote,
  draft: SessionNote,
): AppWorkspace {
  const current = s.notes.find((note) => note.id === baseline.id);
  if (!current || sessionNoteConflicts(current, baseline, draft))
    throw new Error("Запись изменена в другой вкладке.");
  let merged = current;
  for (const field of noteFields) {
    if (baseline[field] === draft[field]) continue;
    merged = { ...merged, [field]: draft[field] };
  }
  return {
    ...s,
    notes: s.notes.map((note) => (note.id === current.id ? merged : note)),
  };
}
