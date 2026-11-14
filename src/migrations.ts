import { legacyWorkspaceSchema } from "./legacy";
import { characterSchema as currentCharacterSchema } from "./character";
import { makeCampaign, type Campaign } from "./campaign";
import { z } from "zod";
import {
  appWorkspaceSchema,
  MAX_BACKUP_BYTES,
  makeDraft,
  type AppWorkspace,
} from "./workspace";
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
    .object(legacyWorkspaceSchema.shape)
    .omit({ version: true, notes: true, drafts: true, metric: true })
    .refine((s) => s.hp <= s.maxHp, "Текущие хиты превышают максимум"),
});

const v2Schema = z.object({
  version: z.literal(2),
  activeCharacterId: id.nullable(),
  characters: z.array(characterSchema).max(101),
  notes: legacyWorkspaceSchema.shape.notes,
  metric: z.boolean(),
});

export function migrateV2(raw: unknown): AppWorkspace {
  const old = v2Schema.parse(raw);
  return migrateV3({
    ...old,
    version: 3,
    characters: old.characters.map(
      ({ name, ancestry, className, sheet, ...metadata }) => {
        const { lore, portrait, maxHp, ...runtime } = sheet;
        return {
          ...metadata,
          build: { name, ancestry, className, lore, portrait, maxHp },
          runtime,
        };
      },
    ),
  });
}
export function migrateLegacy(raw: unknown): AppWorkspace {
  const old = legacyWorkspaceSchema.parse(raw);
  const {
    version: _version,
    notes,
    drafts,
    metric,
    lore,
    portrait,
    maxHp,
    ...runtime
  } = old;
  return migrateV3({
    version: 3,
    activeCharacterId: "gu-chen-demo",
    notes,
    metric,
    characters: [
      {
        id: "gu-chen-demo",
        kind: "demo",
        archivedAt: null,
        build: {
          name: "Гу Чень",
          ancestry: "Человек",
          className: "Савант 3 / Волшебник 1",
          lore,
          portrait,
          maxHp,
        },
        runtime,
      },
      ...drafts.map((draft, index) =>
        makeDraft({
          id: `legacy-draft-${index}`,
          name: draft.name.trim() || "Без имени",
          ancestry: draft.ancestry.trim() || "Не выбрано",
          className: draft.className.trim() || "Не выбран",
        }),
      ),
    ],
  });
}
// Historical v3 exists only at the import/upgrade boundary.
const v3Schema = z.object({
  version: z.literal(3),
  activeCharacterId: id.nullable(),
  characters: z.array(currentCharacterSchema).max(101),
  notes: legacyWorkspaceSchema.shape.notes,
  metric: z.boolean(),
});
export function migrateV3(raw: unknown): AppWorkspace {
  const old = v3Schema.parse(raw);
  const byName = new Map<string, Campaign>();
  const notes = old.notes.map(({ campaign: name, ...note }) => {
    let campaign = byName.get(name);
    if (!campaign) {
      campaign = makeCampaign(`legacy-campaign-${byName.size}`, name);
      byName.set(name, campaign);
    }
    return { ...note, campaignId: campaign.id };
  });
  return appWorkspaceSchema.parse({
    ...old,
    version: 4,
    campaigns: [...byName.values()],
    notes,
  });
}
export function decodeBackup(raw: string): AppWorkspace {
  if (new TextEncoder().encode(raw).byteLength > MAX_BACKUP_BYTES)
    throw new Error("Копия превышает 50 МБ");
  const value: unknown = JSON.parse(raw);
  if (typeof value === "object" && value !== null && "version" in value) {
    if (value.version === 1) return migrateLegacy(value);
    if (value.version === 2) return migrateV2(value);
    if (value.version === 3) return migrateV3(value);
  }
  return appWorkspaceSchema.parse(value);
}
