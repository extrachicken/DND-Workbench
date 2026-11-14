import type { LegacyWorkspace } from "./legacy";
export const initialLegacyWorkspace: LegacyWorkspace = {
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

export function legacyV2Fixture() {
  const {
    version: _version,
    notes,
    drafts: _drafts,
    metric,
    ...sheet
  } = structuredClone(initialLegacyWorkspace);
  return {
    version: 2 as const,
    activeCharacterId: "gu-chen-demo",
    notes,
    metric,
    characters: [
      {
        id: "gu-chen-demo",
        name: "Гу Чень",
        ancestry: "Человек",
        className: "Савант 3 / Волшебник 1",
        kind: "demo",
        archivedAt: null as string | null,
        sheet,
      },
    ],
  };
}

export function legacyV3Fixture() {
  const old = legacyV2Fixture();
  return {
    ...old,
    version: 3 as const,
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
  };
}
